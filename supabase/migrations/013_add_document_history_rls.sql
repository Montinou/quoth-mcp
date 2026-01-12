-- Migration 013: Add RLS policies to document_history table
-- Problem: document_history table has no RLS policies, potential data exposure
-- Solution: Enable RLS and add policies based on project access

-- Enable RLS on document_history table
ALTER TABLE public.document_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view history for documents in projects they have access to
CREATE POLICY "Users can view document history for accessible projects"
  ON public.document_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_history.document_id
        AND public.has_project_access(d.project_id)
    )
  );

-- Policy: Service role can manage all document history (for triggers)
CREATE POLICY "Service role can manage all document history"
  ON public.document_history
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON POLICY "Users can view document history for accessible projects"
  ON public.document_history IS
  'Users can only view history for documents in projects where they have access';

COMMENT ON POLICY "Service role can manage all document history"
  ON public.document_history IS
  'Allows triggers and service operations to manage document history';
