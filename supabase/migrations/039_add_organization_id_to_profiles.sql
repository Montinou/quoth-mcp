-- ============================================================
-- Migration 039: Add organization_id to profiles
-- ============================================================
-- This column was referenced in migration 032 but never actually added

-- Add organization_id column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);

-- Comment
COMMENT ON COLUMN public.profiles.organization_id IS
  'Organization this user belongs to. All users are part of exactly one organization in multi-tenant architecture.';
