-- ==============================================
-- Migration 027: Add Foreign Key Indexes
-- Purpose: Add indexes for unindexed foreign keys to improve JOIN
--          performance and cascading DELETE/UPDATE operations
-- References: https://supabase.com/docs/guides/database/database-advisors?lint=0001_unindexed_foreign_keys
-- ==============================================

-- Note: Using CREATE INDEX (not CONCURRENTLY) inside transaction
-- For production with large tables, consider running CONCURRENTLY outside a transaction

BEGIN;

-- document_proposals.document_id -> documents(id)
CREATE INDEX IF NOT EXISTS idx_document_proposals_document_id
  ON document_proposals(document_id);

-- project_api_keys.created_by -> profiles(id)
CREATE INDEX IF NOT EXISTS idx_project_api_keys_created_by
  ON project_api_keys(created_by);

-- project_invitations.invited_by -> profiles(id)
CREATE INDEX IF NOT EXISTS idx_project_invitations_invited_by
  ON project_invitations(invited_by);

-- project_members.invited_by -> profiles(id)
CREATE INDEX IF NOT EXISTS idx_project_members_invited_by
  ON project_members(invited_by);

-- projects.created_by -> profiles(id)
CREATE INDEX IF NOT EXISTS idx_projects_created_by
  ON projects(created_by);

-- projects.owner_id -> profiles(id)
CREATE INDEX IF NOT EXISTS idx_projects_owner_id
  ON projects(owner_id);

-- quoth_activity.document_id -> documents(id)
CREATE INDEX IF NOT EXISTS idx_quoth_activity_document_id
  ON quoth_activity(document_id);

-- quoth_activity.user_id -> profiles(id)
CREATE INDEX IF NOT EXISTS idx_quoth_activity_user_id
  ON quoth_activity(user_id);

COMMIT;

-- ==============================================
-- Summary:
-- - Added 8 indexes for unindexed foreign key columns
-- - Improves JOIN performance on these columns
-- - Improves cascading DELETE/UPDATE operations
-- ==============================================
