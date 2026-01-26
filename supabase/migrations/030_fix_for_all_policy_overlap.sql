-- Migration: Fix FOR ALL policy overlap with action-specific policies
-- Problem: FOR ALL policies overlap with action-specific policies causing
-- "multiple_permissive_policies" warnings. FOR ALL = SELECT + INSERT + UPDATE + DELETE,
-- so when we have both a FOR ALL policy and a FOR SELECT policy for the same role,
-- Postgres sees two SELECT policies for that role.
--
-- Solution: Replace FOR ALL policies with explicit FOR INSERT, FOR UPDATE, FOR DELETE
-- to avoid overlap with existing FOR SELECT policies.

BEGIN;

-- =============================================
-- COVERAGE_SNAPSHOT: Replace FOR ALL with specific actions
-- =============================================

DROP POLICY IF EXISTS "coverage_service_role_write" ON coverage_snapshot;

-- Service role needs INSERT, UPDATE, DELETE (SELECT already in coverage_select_policy)
CREATE POLICY "coverage_service_role_insert" ON coverage_snapshot
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "coverage_service_role_update" ON coverage_snapshot
  FOR UPDATE
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "coverage_service_role_delete" ON coverage_snapshot
  FOR DELETE
  USING ((select auth.role()) = 'service_role');

-- =============================================
-- DOCUMENT_EMBEDDINGS: Remove redundant SELECT policy
-- "Editors can manage embeddings" FOR ALL already covers SELECT for editors
-- =============================================

DROP POLICY IF EXISTS "embeddings_select_policy" ON document_embeddings;

-- =============================================
-- DOCUMENT_HISTORY: Replace FOR ALL with specific actions
-- =============================================

DROP POLICY IF EXISTS "Service role can manage all document history" ON document_history;

-- Service role INSERT (no existing policy covers this)
CREATE POLICY "document_history_service_role_insert" ON document_history
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- Service role UPDATE (no existing policy covers this)
CREATE POLICY "document_history_service_role_update" ON document_history
  FOR UPDATE
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Note: SELECT is covered by document_history_select_policy
-- Note: DELETE is covered by document_history_delete_policy (which includes service_role check)

COMMIT;
