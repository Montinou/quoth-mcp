/**
 * Drift Detection API
 * GET: Fetch drift timeline and summary
 * POST: Record a new drift event or resolve existing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  getDriftTimeline,
  getDriftSummary,
  detectDrift,
  resolveDrift,
} from '@/lib/quoth/drift';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const includeResolved = searchParams.get('includeResolved') === 'true';

    // Verify authentication
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project membership
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a project member' }, { status: 403 });
    }

    const [timeline, summary] = await Promise.all([
      getDriftTimeline(projectId, days, includeResolved),
      getDriftSummary(projectId),
    ]);

    return NextResponse.json({
      timeline,
      summary,
    });
  } catch (error) {
    console.error('[Drift API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch drift data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;

    // Verify authentication
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project membership with editor+ role
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['admin', 'editor'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'resolve') {
      const success = await resolveDrift(data.driftId, user.id, data.note);
      if (success) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'Failed to resolve drift' }, { status: 500 });
    }

    // Default: detect new drift
    const driftEvent = await detectDrift({
      projectId,
      ...data,
    });

    return NextResponse.json({ drift: driftEvent });
  } catch (error) {
    console.error('[Drift API] POST error:', error);
    return NextResponse.json({ error: 'Failed to process drift event' }, { status: 500 });
  }
}
