/**
 * Knowledge Base Search API
 * POST /api/knowledge-base/search
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { searchDocuments } from '@/lib/quoth/search';
import { logActivity } from '@/lib/quoth/activity';

export async function POST(request: Request) {
  try {
    const authSupabase = await createServerSupabaseClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's project membership
    const { data: membership } = await authSupabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return Response.json({ error: 'No project access' }, { status: 403 });
    }

    const { query } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Query is required' }, { status: 400 });
    }

    const startTime = Date.now();
    const results = await searchDocuments(query, membership.project_id);
    const responseTimeMs = Date.now() - startTime;

    // Log search activity with result_count (non-blocking)
    const avgRelevance = results.length > 0
      ? results.reduce((sum, r) => sum + (r.relevance || 0), 0) / results.length
      : 0;

    logActivity({
      projectId: membership.project_id,
      userId: user.id,
      eventType: 'search',
      query,
      resultCount: results.length,
      relevanceScore: avgRelevance,
      responseTimeMs,
      toolName: 'web_search_api',
    });
    
    return Response.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
