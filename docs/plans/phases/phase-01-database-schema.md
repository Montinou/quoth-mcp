# Phase 1: Database Schema Migration

**Status:** 🔴 Not Started  
**Risk Level:** Low  
**Estimated Time:** 30 minutes  
**Dependencies:** Supabase project access

---

## Overview

This phase adds the infrastructure for document versioning and incremental re-indexing. No existing functionality is broken—only new columns, tables, and triggers are added.

---

## Files to Create/Modify

### [NEW] supabase/migrations/006_genesis_versioning.sql

**Location:** `supabase/migrations/006_genesis_versioning.sql`

**Full SQL:**

```sql
-- ============================================================
-- Quoth Genesis Migration: Versioning & Incremental Indexing
-- ============================================================

-- 1. Add version column to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version int DEFAULT 1;

-- 2. Add require_approval setting to projects (configurable governance)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS require_approval boolean DEFAULT true;
COMMENT ON COLUMN projects.require_approval IS 
  'If true, proposals require human approval. If false, AI updates apply directly.';

-- 3. Create document_history table for backups
CREATE TABLE IF NOT EXISTS document_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  title text NOT NULL,
  version int NOT NULL,
  archived_at timestamptz DEFAULT now()
);

-- 4. Create indexes for efficient history queries
CREATE INDEX IF NOT EXISTS idx_document_history_document_id 
  ON document_history(document_id);
CREATE INDEX IF NOT EXISTS idx_document_history_archived_at 
  ON document_history(archived_at DESC);

-- 5. Add chunk_hash to document_embeddings for incremental re-indexing
ALTER TABLE document_embeddings 
  ADD COLUMN IF NOT EXISTS chunk_hash text;
CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_hash 
  ON document_embeddings(document_id, chunk_hash);
COMMENT ON COLUMN document_embeddings.chunk_hash IS 
  'MD5 hash of content_chunk for incremental re-indexing optimization';

-- 6. Trigger function to auto-backup before update
CREATE OR REPLACE FUNCTION backup_document_before_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Save the old version to history
  INSERT INTO document_history (document_id, content, title, version)
  VALUES (OLD.id, OLD.content, OLD.title, OLD.version);
  
  -- Increment version on the new record
  NEW.version = OLD.version + 1;
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Attach trigger to documents table
DROP TRIGGER IF EXISTS on_document_update ON documents;
CREATE TRIGGER on_document_update
  BEFORE UPDATE ON documents
  FOR EACH ROW 
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION backup_document_before_update();

-- 8. Comments
COMMENT ON TABLE document_history IS 
  'Version history of documents, automatically populated by trigger';
COMMENT ON FUNCTION backup_document_before_update IS 
  'Trigger function that saves old document content before updates';
```

---

## Step-by-Step Instructions

### Step 1.1: Run Migration

**Option A: Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Paste the SQL above
3. Click "Run"

**Option B: Supabase CLI**
```bash
cd /Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp
supabase db push
```

### Step 1.2: Verify Migration

Run these verification queries in SQL Editor:

```sql
-- Check version column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'documents' AND column_name = 'version';

-- Check document_history table exists
SELECT * FROM document_history LIMIT 1;

-- Check require_approval column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'require_approval';

-- Check chunk_hash column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'document_embeddings' AND column_name = 'chunk_hash';
```

### Step 1.3: Test Trigger

```sql
-- Insert a test document
INSERT INTO documents (project_id, file_path, title, content, checksum, version)
VALUES (
  (SELECT id FROM projects LIMIT 1),
  'test/trigger-test.md', 
  'Trigger Test', 
  'Version 1 content', 
  'abc123', 
  1
);

-- Update it to trigger the backup
UPDATE documents 
SET content = 'Version 2 content', checksum = 'def456'
WHERE file_path = 'test/trigger-test.md';

-- Verify: version should be 2
SELECT version, content FROM documents WHERE file_path = 'test/trigger-test.md';
-- Expected: version = 2, content = 'Version 2 content'

-- Verify: history should have version 1
SELECT version, content FROM document_history 
WHERE document_id = (SELECT id FROM documents WHERE file_path = 'test/trigger-test.md');
-- Expected: version = 1, content = 'Version 1 content'

-- Cleanup test data
DELETE FROM documents WHERE file_path = 'test/trigger-test.md';
```

---

## Checklist

- [ ] Create migration file `006_genesis_versioning.sql`
- [ ] Run migration in Supabase
- [ ] Verify `documents.version` column exists
- [ ] Verify `projects.require_approval` column exists
- [ ] Verify `document_history` table exists
- [ ] Verify `document_embeddings.chunk_hash` column exists
- [ ] Test trigger with insert/update/verify/cleanup
- [ ] Delete test data
- [ ] Update [status.md](./status.md) - mark Phase 1 complete
- [ ] Commit changes: `git commit -m "Phase 1: Database schema migration"`

---

## Rollback Instructions

If something goes wrong:

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS on_document_update ON documents;
DROP FUNCTION IF EXISTS backup_document_before_update();

-- Remove new columns
ALTER TABLE documents DROP COLUMN IF EXISTS version;
ALTER TABLE projects DROP COLUMN IF EXISTS require_approval;
ALTER TABLE document_embeddings DROP COLUMN IF EXISTS chunk_hash;

-- Remove history table
DROP TABLE IF EXISTS document_history;
```

---

## Next Phase

Once this phase is complete, proceed to [Phase 2: Genesis Tool](./phase-02-genesis-tool.md).
