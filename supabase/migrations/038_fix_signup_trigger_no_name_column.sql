-- ============================================================
-- Migration 038: Fix handle_new_user trigger (remove name column)
-- ============================================================
-- The projects table doesn't have a 'name' column, only 'slug'
-- This was causing signup failures

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id uuid;
  new_project_id uuid;
  username_val text;
  org_slug text;
  org_name text;
  project_slug text;
BEGIN
  -- Extract username from metadata
  username_val := NEW.raw_user_meta_data->>'username';
  
  IF username_val IS NULL OR username_val = '' THEN
    RAISE EXCEPTION 'Username is required in user metadata';
  END IF;

  -- Step 1: Create organization
  org_slug := username_val;
  org_name := username_val;

  INSERT INTO public.organizations (slug, name, owner_user_id)
  VALUES (org_slug, org_name, NEW.id)
  RETURNING id INTO new_org_id;

  -- Step 2: Create profile linked to organization
  INSERT INTO public.profiles (
    id, 
    email, 
    username, 
    full_name, 
    avatar_url, 
    organization_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    username_val,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    new_org_id
  );

  -- Step 3: Create default project linked to organization
  -- NOTE: projects table only has 'slug', not 'name'
  project_slug := username_val || '-knowledge-base';

  INSERT INTO public.projects (
    slug, 
    github_repo, 
    is_public, 
    owner_id, 
    created_by,
    organization_id
  )
  VALUES (
    project_slug,
    '', 
    false, 
    NEW.id, 
    NEW.id,
    new_org_id
  )
  RETURNING id INTO new_project_id;

  -- Step 4: Add user as admin of the project
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (new_project_id, NEW.id, 'admin');

  -- Step 5: Set as default project in profile
  UPDATE public.profiles
  SET default_project_id = new_project_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Re-attach trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS
  'Auto-creates organization, profile, and default project when user signs up. Fixed: removed name column from projects insert.';
