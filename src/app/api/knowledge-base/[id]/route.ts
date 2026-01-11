/**
 * Knowledge Base Document API
 * GET /api/knowledge-base/[id]
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authSupabase = await createServerSupabaseClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify user has access to this project
    const { data: membership } = await authSupabase
      .from('project_members')
      .select('role')
      .eq('project_id', doc.project_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get version history
    const { data: history } = await supabase
      .from('document_history')
      .select('id, version, content, title, archived_at')
      .eq('document_id', id)
      .order('version', { ascending: false });

    return Response.json({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      version: doc.version || 1,
      lastUpdated: doc.last_updated,
      path: doc.file_path,
      history: (history || []).map(h => ({
        id: h.id,
        version: h.version,
        content: h.content,
        title: h.title,
        archivedAt: h.archived_at
      })),
    });
  } catch (error) {
    console.error('Document fetch error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch document' },
      { status: 500 }
    );
  }
}
