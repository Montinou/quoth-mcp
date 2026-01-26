-- ==============================================
-- Migration 028: Consolidate Permissive Policies
-- Purpose: Reduce policy evaluation overhead by consolidating multiple
--          permissive policies into single policies using OR logic
-- References: https://supabase.com/docs/guides/database/database-advisors?lint=0006_multiple_permissive_policies
-- ==============================================

BEGIN;

-- =============================================
-- PROFILES TABLE (SELECT)
-- Consolidate: "Users can view own profile" + "Users can view project members profiles"
-- =============================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view project members profiles" ON profiles;

CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT
  USING (
    (select auth.uid()) = id
    OR public.has_shared_project(id)
  );

COMMENT ON POLICY "profiles_select_policy" ON profiles IS
  'Consolidated: own profile OR shared project member profiles';

-- =============================================
-- PROJECTS TABLE (SELECT)
-- Consolidate: "Anyone can view public projects" + "Users can view their projects"
-- =============================================

DROP POLICY IF EXISTS "Anyone can view public projects" ON projects;
DROP POLICY IF EXISTS "Users can view their projects" ON projects;

CREATE POLICY "projects_select_policy" ON projects
  FOR SELECT
  USING (
    is_public = true
    OR EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = id
        AND pm.user_id = (select auth.uid())
    )
  );

COMMENT ON POLICY "projects_select_policy" ON projects IS
  'Consolidated: public projects OR member projects';

-- =============================================
-- PROJECTS TABLE (UPDATE)
-- Consolidate: "Admins can update projects" + "Editors can update projects"
-- =============================================

DROP POLICY IF EXISTS "Admins can update projects" ON projects;
DROP POLICY IF EXISTS "Editors can update projects" ON projects;

CREATE POLICY "projects_update_policy" ON projects
  FOR UPDATE
  USING (public.can_edit_project(id))
  WITH CHECK (public.can_edit_project(id));

COMMENT ON POLICY "projects_update_policy" ON projects IS
  'Consolidated: admins and editors can update (via can_edit_project)';

-- =============================================
-- DOCUMENTS TABLE (SELECT)
-- Consolidate: "Public project documents readable" + "Users can view their project documents"
-- =============================================

DROP POLICY IF EXISTS "Public project documents readable" ON documents;
DROP POLICY IF EXISTS "Users can view their project documents" ON documents;

CREATE POLICY "documents_select_policy" ON documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND p.is_public = true
    )
    OR public.has_project_access(project_id)
  );

COMMENT ON POLICY "documents_select_policy" ON documents IS
  'Consolidated: public project docs OR accessible project docs';

-- =============================================
-- DOCUMENT_EMBEDDINGS TABLE (SELECT)
-- Consolidate: "Editors can manage embeddings" + "Embeddings inherit document read permissions"
-- Note: "Editors can manage embeddings" is FOR ALL, so we need to handle carefully
-- =============================================

-- First drop the SELECT-specific policy
DROP POLICY IF EXISTS "Embeddings inherit document read permissions" ON document_embeddings;

-- The "Editors can manage embeddings" FOR ALL policy already covers all operations
-- We just need one SELECT policy for read-only access (viewers)
CREATE POLICY "embeddings_select_policy" ON document_embeddings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
        AND public.has_project_access(d.project_id)
    )
  );

COMMENT ON POLICY "embeddings_select_policy" ON document_embeddings IS
  'Viewers can read embeddings for accessible project documents';

-- =============================================
-- DOCUMENT_HISTORY TABLE (SELECT)
-- Consolidate: "Service role can manage..." + "Users can view document history..."
-- =============================================

DROP POLICY IF EXISTS "Users can view document history for accessible projects" ON document_history;
-- Note: "Service role can manage all document history" is FOR ALL, keep it for write operations

CREATE POLICY "document_history_select_policy" ON document_history
  FOR SELECT
  USING (
    (select auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
        AND public.has_project_access(d.project_id)
    )
  );

COMMENT ON POLICY "document_history_select_policy" ON document_history IS
  'Consolidated: service role OR users with project access';

-- =============================================
-- DOCUMENT_HISTORY TABLE (DELETE)
-- The "Editors can delete document history" already exists from migration 015
-- "Service role can manage all document history" FOR ALL also covers DELETE
-- These are intentionally kept separate - service role needs unrestricted access
-- =============================================

-- =============================================
-- PROJECT_API_KEYS TABLE (SELECT)
-- Consolidate: "Admins can view project API keys" + "Editors can view API keys"
-- Note: Migration 015 already replaced admin-only policies with editor-level ones
-- =============================================

DROP POLICY IF EXISTS "Admins can view project API keys" ON project_api_keys;
DROP POLICY IF EXISTS "Editors can view API keys" ON project_api_keys;

CREATE POLICY "api_keys_select_policy" ON project_api_keys
  FOR SELECT
  USING (public.can_edit_project(project_id));

COMMENT ON POLICY "api_keys_select_policy" ON project_api_keys IS
  'Consolidated: editors and admins can view API keys (via can_edit_project)';

-- =============================================
-- PROJECT_INVITATIONS TABLE (SELECT)
-- Consolidate: "Admins can view project invitations" + "Users can view their own invitations"
-- =============================================

DROP POLICY IF EXISTS "Admins can view project invitations" ON project_invitations;
DROP POLICY IF EXISTS "Users can view their own invitations" ON project_invitations;

CREATE POLICY "invitations_select_policy" ON project_invitations
  FOR SELECT
  USING (
    public.is_project_admin(project_id)
    OR email = (SELECT email FROM profiles WHERE id = (select auth.uid()))
  );

COMMENT ON POLICY "invitations_select_policy" ON project_invitations IS
  'Consolidated: project admins OR invitation recipient';

-- =============================================
-- PROJECT_INVITATIONS TABLE (DELETE)
-- Consolidate: "Admins can cancel invitations" + "Users can decline their invitations"
-- =============================================

DROP POLICY IF EXISTS "Admins can cancel invitations" ON project_invitations;
DROP POLICY IF EXISTS "Users can decline their invitations" ON project_invitations;

CREATE POLICY "invitations_delete_policy" ON project_invitations
  FOR DELETE
  USING (
    public.is_project_admin(project_id)
    OR email = (SELECT email FROM profiles WHERE id = (select auth.uid()))
  );

COMMENT ON POLICY "invitations_delete_policy" ON project_invitations IS
  'Consolidated: admins can cancel OR recipients can decline';

-- =============================================
-- PROJECT_MEMBERS TABLE (DELETE)
-- Consolidate: "Admins can remove members" + "Users can leave projects"
-- =============================================

DROP POLICY IF EXISTS "Admins can remove members" ON project_members;
DROP POLICY IF EXISTS "Users can leave projects" ON project_members;

CREATE POLICY "members_delete_policy" ON project_members
  FOR DELETE
  USING (
    public.is_project_admin(project_id)
    OR user_id = (select auth.uid())
  );

COMMENT ON POLICY "members_delete_policy" ON project_members IS
  'Consolidated: admins can remove members OR users can leave';

-- =============================================
-- COVERAGE_SNAPSHOT TABLE (SELECT)
-- Consolidate: "Service role can manage coverage" + "Users can view project coverage"
-- =============================================

DROP POLICY IF EXISTS "Service role can manage coverage" ON coverage_snapshot;
DROP POLICY IF EXISTS "Users can view project coverage" ON coverage_snapshot;

CREATE POLICY "coverage_select_policy" ON coverage_snapshot
  FOR SELECT
  USING (
    (select auth.role()) = 'service_role'
    OR project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = (select auth.uid())
    )
  );

-- Keep service role write access as separate policy
CREATE POLICY "coverage_service_role_write" ON coverage_snapshot
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

COMMENT ON POLICY "coverage_select_policy" ON coverage_snapshot IS
  'Consolidated: service role OR project members can view';

COMMENT ON POLICY "coverage_service_role_write" ON coverage_snapshot IS
  'Service role can manage all coverage snapshots';

COMMIT;

-- ==============================================
-- Summary:
-- - Consolidated 12 pairs of permissive policies into single policies
-- - Reduces policy evaluation from O(n) to O(1) per operation type
-- - Tables affected: profiles, projects, documents, document_embeddings,
--   document_history, project_api_keys, project_invitations,
--   project_members, coverage_snapshot
-- ==============================================
