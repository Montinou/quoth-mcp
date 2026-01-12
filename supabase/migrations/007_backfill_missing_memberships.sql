-- ==============================================
-- Migration 004: Backfill Missing Project Memberships
-- Fixes users who were created without project_members entries
-- ==============================================

-- Insert missing project_members entries for users with default_project_id
-- These users should be admins of their own default projects
INSERT INTO public.project_members (project_id, user_id, role)
SELECT
  p.default_project_id,
  p.id,
  'admin'
FROM public.profiles p
WHERE p.default_project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.user_id = p.id
      AND pm.project_id = p.default_project_id
  );

-- Log the number of rows inserted for verification
DO $$
DECLARE
  inserted_count integer;
BEGIN
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % missing project_members entries', inserted_count;
END $$;

-- ==============================================
-- Migration complete
-- ==============================================
