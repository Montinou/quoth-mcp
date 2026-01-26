-- ==============================================
-- Migration 026: Optimize RLS InitPlan
-- Purpose: Wrap auth.uid(), auth.jwt(), auth.role() with (select ...)
--          to enable Postgres InitPlan caching (O(1) instead of O(n))
-- References: https://supabase.com/docs/guides/database/database-advisors?lint=0003_auth_rls_initplan
-- ==============================================

BEGIN;

-- =============================================
-- HELPER FUNCTIONS: Update to use InitPlan pattern
-- These functions use auth.uid() internally, but since they're
-- SECURITY DEFINER, they already execute with elevated privileges.
-- The InitPlan optimization applies to the calling context.
-- =============================================

-- Update has_shared_project to use InitPlan pattern
CREATE OR REPLACE FUNCTION public.has_shared_project(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check if the current user shares any project with the target user
  -- Using (select auth.uid()) for InitPlan caching
  RETURN EXISTS (
    SELECT 1
    FROM public.project_members pm1
    JOIN public.project_members pm2 ON pm1.project_id = pm2.project_id
    WHERE pm1.user_id = (select auth.uid())
      AND pm2.user_id = target_user_id
  );
END;
$$;

-- Update has_project_access to use InitPlan pattern
CREATE OR REPLACE FUNCTION public.has_project_access(target_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Public projects accessible to all
  IF EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = target_project_id AND is_public = true
  ) THEN
    RETURN true;
  END IF;

  -- Private projects require membership
  -- Using (select auth.uid()) for InitPlan caching
  RETURN EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = (select auth.uid()) AND project_id = target_project_id
  );
END;
$$;

-- Update is_project_admin to use InitPlan pattern
CREATE OR REPLACE FUNCTION public.is_project_admin(target_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Using (select auth.uid()) for InitPlan caching
  RETURN EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = (select auth.uid())
      AND project_id = target_project_id
      AND role = 'admin'
  );
END;
$$;

-- Update can_edit_project to use InitPlan pattern
CREATE OR REPLACE FUNCTION public.can_edit_project(target_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Using (select auth.uid()) for InitPlan caching
  RETURN EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = (select auth.uid())
      AND project_id = target_project_id
      AND role IN ('admin', 'editor')
  );
END;
$$;

-- Update get_user_project_ids to use InitPlan pattern
CREATE OR REPLACE FUNCTION public.get_user_project_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Using (select auth.uid()) for InitPlan caching
  RETURN QUERY SELECT project_id FROM public.project_members WHERE user_id = (select auth.uid());
END;
$$;

-- =============================================
-- PROFILES TABLE
-- =============================================

-- Drop and recreate "Users can update own profile" with InitPlan
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- =============================================
-- PROJECTS TABLE
-- =============================================

-- Drop and recreate "Authenticated users can create projects" with InitPlan
DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;
CREATE POLICY "Authenticated users can create projects" ON projects
  FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- =============================================
-- PROJECT_MEMBERS TABLE
-- =============================================

-- Drop and recreate "Users can leave projects" with InitPlan
DROP POLICY IF EXISTS "Users can leave projects" ON project_members;
CREATE POLICY "Users can leave projects" ON project_members
  FOR DELETE
  USING (user_id = (select auth.uid()));

-- =============================================
-- PROJECT_INVITATIONS TABLE
-- =============================================

-- Drop and recreate "Users can view their own invitations" with InitPlan
DROP POLICY IF EXISTS "Users can view their own invitations" ON project_invitations;
CREATE POLICY "Users can view their own invitations" ON project_invitations
  FOR SELECT
  USING (
    email = (SELECT email FROM profiles WHERE id = (select auth.uid()))
  );

-- Drop and recreate "Users can decline their invitations" with InitPlan
DROP POLICY IF EXISTS "Users can decline their invitations" ON project_invitations;
CREATE POLICY "Users can decline their invitations" ON project_invitations
  FOR DELETE
  USING (
    email = (SELECT email FROM profiles WHERE id = (select auth.uid()))
  );

-- =============================================
-- DOCUMENT_HISTORY TABLE
-- =============================================

-- Drop and recreate "Service role can manage all document history" with InitPlan
DROP POLICY IF EXISTS "Service role can manage all document history" ON document_history;
CREATE POLICY "Service role can manage all document history" ON document_history
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- =============================================
-- QUOTH_ACTIVITY TABLE
-- =============================================

-- Drop and recreate "Users can view activity for their projects" with InitPlan
DROP POLICY IF EXISTS "Users can view activity for their projects" ON quoth_activity;
CREATE POLICY "Users can view activity for their projects" ON quoth_activity
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = quoth_activity.project_id
        AND pm.user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = quoth_activity.project_id
        AND p.is_public = true
    )
  );

-- =============================================
-- COVERAGE_SNAPSHOT TABLE
-- =============================================

-- Drop and recreate "Users can view project coverage" with InitPlan
DROP POLICY IF EXISTS "Users can view project coverage" ON coverage_snapshot;
CREATE POLICY "Users can view project coverage" ON coverage_snapshot
  FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = (select auth.uid())
    )
  );

COMMIT;

-- ==============================================
-- Summary:
-- - Updated 5 helper functions to use (select auth.uid()) pattern
-- - Updated 8 policies to use InitPlan caching pattern
-- - This prevents per-row function evaluation, improving query performance
-- ==============================================
