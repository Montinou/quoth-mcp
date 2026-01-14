-- Migration: Custom Access Token Hook for MCP Claims Injection
-- This hook injects project_id and mcp_role into Supabase-issued JWTs
-- enabling the OAuth Server to work with MCP authentication
--
-- NOTE: Function is created in public schema. Configure in Supabase Dashboard:
-- Authentication > Hooks > Custom Access Token > Select "custom_access_token_hook"

-- Create the custom access token hook function in public schema
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims JSONB;
  v_user_id UUID;
  v_default_project_id UUID;
  v_role TEXT;
BEGIN
  -- Extract user_id from the event
  v_user_id := (event->>'user_id')::UUID;

  -- If no user_id, return event unchanged
  IF v_user_id IS NULL THEN
    RETURN event;
  END IF;

  -- Get user's default project from profiles
  SELECT default_project_id
  INTO v_default_project_id
  FROM public.profiles
  WHERE id = v_user_id;

  -- If no default project, return event unchanged
  IF v_default_project_id IS NULL THEN
    RETURN event;
  END IF;

  -- Get user's role in their default project
  SELECT pm.role
  INTO v_role
  FROM public.project_members pm
  WHERE pm.user_id = v_user_id
    AND pm.project_id = v_default_project_id;

  -- Default to 'viewer' if no membership found
  IF v_role IS NULL THEN
    v_role := 'viewer';
  END IF;

  -- Extract existing claims
  claims := event->'claims';

  -- Ensure app_metadata exists
  IF claims->'app_metadata' IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  -- Inject MCP-specific claims into app_metadata
  claims := jsonb_set(claims, '{app_metadata, project_id}',
                      to_jsonb(v_default_project_id::TEXT));
  claims := jsonb_set(claims, '{app_metadata, mcp_role}',
                      to_jsonb(v_role));

  -- Update claims in event and return
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute permission to supabase_auth_admin (required for hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from other roles for security (only auth system should call this)
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Custom Access Token Hook: Injects project_id and mcp_role claims into Supabase JWTs for MCP authentication. Configure in Dashboard > Authentication > Hooks.';
