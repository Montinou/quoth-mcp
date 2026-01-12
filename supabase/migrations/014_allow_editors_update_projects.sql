-- Migration 014: Allow editors to update projects they are members of
-- Problem: Only admins can update projects, editors should also be able to update
-- Solution: Add policy for editors to update projects

-- Allow editors to update projects (not just admins)
CREATE POLICY "Editors can update projects"
  ON public.projects FOR UPDATE
  USING (public.can_edit_project(id))
  WITH CHECK (public.can_edit_project(id));

COMMENT ON POLICY "Editors can update projects" ON public.projects IS
  'Allows users with editor or admin role to update project settings';
