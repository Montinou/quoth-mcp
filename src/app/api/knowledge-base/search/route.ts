/**
 * Knowledge Base Search API
 * POST /api/knowledge-base/search
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { searchDocuments } from '@/lib/quoth/search';

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

    const results = await searchDocuments(query, membership.project_id);
    
    return Response.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
