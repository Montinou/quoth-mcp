-- Migration 015: Full CRUD access for project members
-- Problem: Only admins can delete documents and manage proposals
-- Solution: Allow editors (project members with edit rights) full CRUD access
-- Constraint: Only project deletion remains admin-only

-- ===========================================
-- DOCUMENTS: Allow editors to delete
-- ===========================================

-- Drop restrictive admin-only delete policy
DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;

-- Create new policy allowing editors to delete
CREATE POLICY "Editors can delete documents"
  ON public.documents FOR DELETE
  USING (public.can_edit_project(project_id));

COMMENT ON POLICY "Editors can delete documents" ON public.documents IS
  'Users with editor or admin role can delete documents in their projects';

-- ===========================================
-- DOCUMENT_PROPOSALS: Allow editors to update and delete
-- ===========================================

-- Drop restrictive admin-only update policy
DROP POLICY IF EXISTS "Admins can manage proposals" ON public.document_proposals;

-- Create policy allowing editors to update proposals
CREATE POLICY "Editors can update proposals"
  ON public.document_proposals FOR UPDATE
  USING (public.can_edit_project(project_id))
  WITH CHECK (public.can_edit_project(project_id));

-- Create policy allowing editors to delete proposals
CREATE POLICY "Editors can delete proposals"
  ON public.document_proposals FOR DELETE
  USING (public.can_edit_project(project_id));

COMMENT ON POLICY "Editors can update proposals" ON public.document_proposals IS
  'Users with editor or admin role can update proposals in their projects';

COMMENT ON POLICY "Editors can delete proposals" ON public.document_proposals IS
  'Users with editor or admin role can delete proposals in their projects';

-- ===========================================
-- DOCUMENT_EMBEDDINGS: Allow editors to manage (for document syncing)
-- ===========================================

-- Check if policy exists, if not create it
DO $$
BEGIN
  -- Drop existing restrictive policies if any
  DROP POLICY IF EXISTS "Editors can manage embeddings" ON public.document_embeddings;

  -- Create full access for editors
  CREATE POLICY "Editors can manage embeddings"
    ON public.document_embeddings FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_embeddings.document_id
          AND public.can_edit_project(d.project_id)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_embeddings.document_id
          AND public.can_edit_project(d.project_id)
      )
    );
END $$;

COMMENT ON POLICY "Editors can manage embeddings" ON public.document_embeddings IS
  'Users with editor or admin role can manage embeddings for documents in their projects';

-- ===========================================
-- DOCUMENT_HISTORY: Allow editors to delete old history if needed
-- ===========================================

-- Add delete policy for editors (SELECT was added in migration 013)
CREATE POLICY "Editors can delete document history"
  ON public.document_history FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_history.document_id
        AND public.can_edit_project(d.project_id)
    )
  );

COMMENT ON POLICY "Editors can delete document history" ON public.document_history IS
  'Users with editor or admin role can clean up document history in their projects';

-- ===========================================
-- PROJECT_API_KEYS: Allow editors to manage API keys
-- ===========================================

-- Drop existing admin-only policies
DROP POLICY IF EXISTS "Admins can view API keys" ON public.project_api_keys;
DROP POLICY IF EXISTS "Admins can create API keys" ON public.project_api_keys;
DROP POLICY IF EXISTS "Admins can delete API keys" ON public.project_api_keys;

-- Create editor-level access policies
CREATE POLICY "Editors can view API keys"
  ON public.project_api_keys FOR SELECT
  USING (public.can_edit_project(project_id));

CREATE POLICY "Editors can create API keys"
  ON public.project_api_keys FOR INSERT
  WITH CHECK (public.can_edit_project(project_id));

CREATE POLICY "Editors can delete API keys"
  ON public.project_api_keys FOR DELETE
  USING (public.can_edit_project(project_id));

COMMENT ON POLICY "Editors can view API keys" ON public.project_api_keys IS
  'Users with editor or admin role can view API keys in their projects';

COMMENT ON POLICY "Editors can create API keys" ON public.project_api_keys IS
  'Users with editor or admin role can create API keys in their projects';

COMMENT ON POLICY "Editors can delete API keys" ON public.project_api_keys IS
  'Users with editor or admin role can delete API keys in their projects';

-- ===========================================
-- Summary: Project member access matrix
-- ===========================================
--
-- Resource            | Viewer | Editor | Admin
-- --------------------|--------|--------|-------
-- Project (view)      |   ✓    |   ✓    |   ✓
-- Project (edit)      |   ✗    |   ✓    |   ✓
-- Project (delete)    |   ✗    |   ✗    |   ✓  ← Only admins can delete projects
-- Documents (CRUD)    |   R    |  CRUD  | CRUD
-- Proposals (CRUD)    |   R    |  CRUD  | CRUD
-- Embeddings (CRUD)   |   R    |  CRUD  | CRUD
-- History (view/del)  |   R    |   RD   |  RD
-- API Keys (CRUD)     |   ✗    |  CRUD  | CRUD
-- Members (manage)    |   ✗    |   ✗    |   ✓
-- Invitations         |   ✗    |   ✗    |   ✓
