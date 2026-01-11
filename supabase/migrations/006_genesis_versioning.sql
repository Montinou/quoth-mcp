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
