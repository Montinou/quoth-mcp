/**
 * Document Rollback API
 * POST /api/knowledge-base/[id]/rollback
 * Admin only - restores a previous version
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabase } from '@/lib/supabase';
import { syncDocument } from '@/lib/sync';

export async function POST(
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

    const { historyId } = await request.json();
    
    if (!historyId) {
      return Response.json({ error: 'historyId is required' }, { status: 400 });
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

    // Check admin role
    const { data: membership } = await authSupabase
      .from('project_members')
      .select('role')
      .eq('project_id', doc.project_id)
      .eq('user_id', user.id)
      .single();

    if (membership?.role !== 'admin') {
      return Response.json(
        { error: 'Only admins can rollback documents' },
        { status: 403 }
      );
    }

    // Get history version
    const { data: historyVersion, error: historyError } = await supabase
      .from('document_history')
      .select('content, title')
      .eq('id', historyId)
      .eq('document_id', id)
      .single();

    if (historyError || !historyVersion) {
      return Response.json({ error: 'Version not found' }, { status: 404 });
    }

    // Rollback using syncDocument (this will trigger versioning)
    const { document, chunksIndexed, chunksReused } = await syncDocument(
      doc.project_id,
      doc.file_path,
      historyVersion.title || doc.title,
      historyVersion.content
    );

    return Response.json({
      success: true,
      message: 'Document rolled back successfully',
      document: {
        id: document.id,
        version: document.version,
        chunksIndexed,
        chunksReused,
      },
    });
  } catch (error) {
    console.error('Rollback error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Rollback failed' },
      { status: 500 }
    );
  }
}
