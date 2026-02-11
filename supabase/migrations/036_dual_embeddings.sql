-- ============================================================
-- Quoth v3.1: Dual Embeddings (Text + Code)
-- ============================================================
-- Adds support for specialized code embeddings using jina-code-embeddings-1.5b
-- while maintaining backward compatibility with existing jina-embeddings-v3 embeddings.
--
-- Decision: Use single 512d embedding column via Matryoshka representation learning.
-- Both models support 512 dimensions:
--   - jina-embeddings-v3: native 512d
--   - jina-code-embeddings-1.5b: 896d truncated to 512d (matryoshka: 64,128,256,512,896)
--
-- Safe: Idempotent, non-destructive. Existing embeddings continue working.

-- ============================================================
-- 1. Add embedding_model column to track which model generated each embedding
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_embeddings' 
    AND column_name = 'embedding_model'
  ) THEN
    ALTER TABLE document_embeddings 
    ADD COLUMN embedding_model TEXT DEFAULT 'jina-embeddings-v3';
    
    -- Add comment
    COMMENT ON COLUMN document_embeddings.embedding_model IS
      'Identifies which Jina model generated this embedding. Values: jina-embeddings-v3 (text), jina-code-embeddings-1.5b (code).';
  END IF;
END $$;

-- ============================================================
-- 2. Backfill existing embeddings with 'jina-embeddings-v3' model tag
-- ============================================================
UPDATE document_embeddings
SET embedding_model = 'jina-embeddings-v3'
WHERE embedding_model IS NULL;

-- ============================================================
-- 3. Update match_documents to filter by embedding_model
-- ============================================================
-- This ensures we don't mix embeddings from different models in search results.
-- Query embedding must match document embedding model.

DROP FUNCTION IF EXISTS match_documents(vector(512), float, int, uuid);

CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(512),
  match_threshold float,
  match_count int,
  filter_project_id uuid,
  filter_embedding_model text DEFAULT 'jina-embeddings-v3'
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content_chunk text,
  similarity float,
  file_path text,
  title text,
  metadata jsonb
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.document_id,
    de.content_chunk,
    1 - (de.embedding <=> query_embedding) as similarity,
    d.file_path,
    d.title,
    de.metadata
  FROM document_embeddings de
  JOIN documents d ON de.document_id = d.id
  WHERE d.project_id = filter_project_id
  AND de.embedding_model = filter_embedding_model
  AND 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_documents TO authenticated, service_role;

COMMENT ON FUNCTION match_documents IS
  'Semantic search with embedding model filtering. 
   Pass filter_embedding_model to ensure query and document embeddings are from the same model.
   Default: jina-embeddings-v3 (text). Use jina-code-embeddings-1.5b for code search.';

-- ============================================================
-- 4. Update match_shared_documents to filter by embedding_model
-- ============================================================
DROP FUNCTION IF EXISTS match_shared_documents(vector(512), uuid, int, text[], uuid);

CREATE OR REPLACE FUNCTION match_shared_documents(
  query_embedding vector(512),
  p_organization_id UUID,
  match_count INT,
  filter_tags TEXT[] DEFAULT NULL,
  filter_agent_id UUID DEFAULT NULL,
  filter_embedding_model TEXT DEFAULT 'jina-embeddings-v3'
)
RETURNS TABLE (
  document_id UUID,
  content_chunk TEXT,
  similarity FLOAT,
  title TEXT,
  project_slug TEXT,
  agent_id UUID,
  agent_name TEXT,
  tags TEXT[]
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.document_id,
    de.content_chunk,
    1 - (de.embedding <=> query_embedding) AS similarity,
    d.title,
    p.slug AS project_slug,
    d.agent_id,
    a.agent_name,
    d.tags
  FROM document_embeddings de
  JOIN documents d ON de.document_id = d.id
  JOIN projects p ON d.project_id = p.id
  LEFT JOIN agents a ON d.agent_id = a.id
  WHERE d.visibility = 'shared'
    AND p.organization_id = p_organization_id
    AND de.embedding_model = filter_embedding_model
    AND (filter_tags IS NULL OR d.tags && filter_tags)
    AND (filter_agent_id IS NULL OR d.agent_id = filter_agent_id)
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_shared_documents TO authenticated, service_role;

COMMENT ON FUNCTION match_shared_documents IS
  'Search shared documents within an organization with embedding model filtering.
   Respects visibility=shared filter and embedding_model parameter.';

-- ============================================================
-- 5. Create index on embedding_model for faster filtering
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_document_embeddings_model 
  ON document_embeddings(embedding_model);

-- ============================================================
-- 6. Add helper function to detect content type (optional, for future use)
-- ============================================================
-- This could be used by tools to auto-select the right embedding model
-- based on document tags or content analysis.

COMMENT ON TABLE document_embeddings IS
  'Stores vector embeddings for document chunks.
   Supports dual embedding models: jina-embeddings-v3 (text) and jina-code-embeddings-1.5b (code).
   Both use 512d via Matryoshka representation learning.
   Use embedding_model column to filter searches by model type.';
