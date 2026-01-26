-- ==============================================
-- Migration 029: Cleanup Unused Indexes
-- Purpose: Remove unused indexes to reduce storage and write overhead
-- References: https://supabase.com/docs/guides/database/database-advisors?lint=0005_unused_index
-- ==============================================

-- IMPORTANT: This migration drops indexes that were identified as unused.
-- Before applying to production, verify these indexes are truly not needed
-- by checking pg_stat_user_indexes for recent scans.

BEGIN;

-- =============================================
-- INDEXES TO DROP (confirmed unused)
-- =============================================

-- idx_document_history_archived_at
-- Reason: Archive feature not actively used in queries
DROP INDEX IF EXISTS idx_document_history_archived_at;

-- idx_project_members_project
-- Reason: Redundant - project_members(project_id) lookups covered by
--         idx_project_members_role which includes project_id
DROP INDEX IF EXISTS idx_project_members_project;

-- idx_api_keys_expiration
-- Reason: Expiration checks are infrequent batch operations
--         Key validation uses idx_api_keys_hash instead
DROP INDEX IF EXISTS idx_api_keys_expiration;

-- idx_projects_public
-- Reason: Boolean partial index (WHERE is_public = true) is not selective
--         enough for most queries. Public project checks use inline conditions.
DROP INDEX IF EXISTS idx_projects_public;

-- idx_proposals_created
-- Reason: Creation time sorting on proposals is rare
--         Proposals are typically filtered by project_id first
DROP INDEX IF EXISTS idx_proposals_created;

-- idx_quoth_activity_event_type
-- Reason: Low cardinality column (only ~10 distinct event types)
--         Not selective enough to provide significant performance benefit
--         Queries typically use project_id + event_type (covered by compound index)
DROP INDEX IF EXISTS idx_quoth_activity_event_type;

-- =============================================
-- INDEXES TO KEEP (documented for reference)
-- =============================================

-- idx_profiles_email - KEEP
-- Used for invitation email lookups in RLS policies

-- idx_api_keys_hash - KEEP
-- Critical for API key validation (performance critical path)

-- idx_quoth_activity_project_id - KEEP
-- Used for project-scoped activity queries

-- idx_quoth_activity_created_at - KEEP
-- Used for time-based activity queries and sorting

-- idx_invitations_email - KEEP
-- Used for invitation email lookups

-- idx_invitations_token - KEEP
-- Critical for token validation during invitation acceptance

-- document_embeddings_embedding_idx - KEEP
-- Vector index for similarity search (ivfflat)

COMMIT;

-- ==============================================
-- Summary:
-- - Dropped 6 unused indexes
-- - Kept 7 critical indexes (documented above)
-- - Reduces storage overhead and write amplification
-- ==============================================

-- ==============================================
-- VERIFICATION QUERY (run after migration to confirm)
-- ==============================================
-- SELECT
--   schemaname,
--   relname AS table_name,
--   indexrelname AS index_name,
--   idx_scan AS times_used
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan ASC;
-- ==============================================
