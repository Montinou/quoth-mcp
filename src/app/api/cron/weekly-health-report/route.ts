// src/app/api/cron/weekly-health-report/route.ts
/**
 * Weekly Health Report Cron Job
 * Sends documentation health reports to project admins
 * Schedule: Every Monday at 9:00 AM UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getProjectHealth } from '@/lib/quoth/health';
import { getDriftSummary } from '@/lib/quoth/drift';
import { getMissRateTrends, getTopMissedQueries } from '@/lib/quoth/activity';
import { sendWeeklyHealthReport } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Type for project member with profile (Supabase returns profiles as object or array)
interface ProjectMember {
  user_id: string;
  role: string;
  profiles: {
    email: string;
  } | { email: string }[] | null;
}

// Type for project with members
interface ProjectWithMembers {
  id: string;
  slug: string;
  github_repo: string | null;
  project_members: ProjectMember[];
}

/**
 * Extract email from profiles (handles both single object and array from Supabase)
 */
function extractEmail(profiles: ProjectMember['profiles']): string | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) {
    return profiles[0]?.email || null;
  }
  return profiles.email || null;
}

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In production, require authorization
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all projects with admin members
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        slug,
        github_repo,
        project_members!inner(
          user_id,
          role,
          profiles(email)
        )
      `)
      .eq('project_members.role', 'admin');

    if (projectsError || !projects) {
      console.error('[Cron] Failed to fetch projects:', projectsError);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const periodStart = weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const periodEnd = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    let sentCount = 0;
    const errors: string[] = [];

    for (const project of projects as ProjectWithMembers[]) {
      try {
        // Fetch all metrics in parallel for better performance
        const [health, drift, missRateTrends, topMissed] = await Promise.all([
          getProjectHealth(project.id),
          getDriftSummary(project.id),
          getMissRateTrends(project.id, 7),
          getTopMissedQueries(project.id, 5),
        ]);

        // Extract admin emails using helper function
        const adminEmails = project.project_members
          .map((pm) => extractEmail(pm.profiles))
          .filter((email): email is string => Boolean(email));

        if (adminEmails.length === 0) {
          console.log(`[Cron] No admin emails for project ${project.slug}, skipping`);
          continue;
        }

        // Derive project name from github_repo or slug
        const projectName = project.github_repo?.split('/').pop() || project.slug;

        await sendWeeklyHealthReport({
          projectName,
          projectSlug: project.slug,
          periodStart,
          periodEnd,
          health: {
            overallScore: health.overallScore,
            totalDocs: health.totalDocs,
            freshDocs: health.freshDocs,
            agingDocs: health.agingDocs,
            staleDocs: health.staleDocs,
            criticalDocs: health.criticalDocs,
          },
          drift: {
            total: drift.total,
            critical: drift.critical,
            warning: drift.warning,
            unresolvedCount: drift.unresolvedCount,
          },
          missRate: {
            averageMissRate: missRateTrends.averageMissRate,
            trend: missRateTrends.trend,
            topMissedQueries: topMissed.map((q) => ({ query: q.query, missCount: q.missCount })),
          },
          recipients: adminEmails,
        });

        sentCount++;
        console.log(`[Cron] Weekly report sent for project ${project.slug}`);
      } catch (projectError) {
        const errorMessage = projectError instanceof Error ? projectError.message : 'Unknown error';
        console.error(`[Cron] Error processing project ${project.slug}:`, errorMessage);
        errors.push(`${project.slug}: ${errorMessage}`);
      }
    }

    return NextResponse.json({
      success: true,
      projectsProcessed: projects.length,
      reportsSent: sentCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Cron] Weekly report error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
