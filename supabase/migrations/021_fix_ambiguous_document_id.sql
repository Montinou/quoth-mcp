-- Fix ambiguous column reference in get_chunks_by_ids
-- The subquery for total_chunks had an unqualified document_id

CREATE OR REPLACE FUNCTION get_chunks_by_ids(
  chunk_ids uuid[],
  filter_project_id uuid
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  document_path text,
  content_chunk text,
  chunk_index int,
  metadata jsonb,
  total_chunks int
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id as chunk_id,
    de.document_id,
    d.title as document_title,
    d.file_path as document_path,
    de.content_chunk,
    COALESCE((de.metadata->>'chunk_index')::int, 0) as chunk_index,
    de.metadata,
    (SELECT COUNT(*)::int FROM document_embeddings sub WHERE sub.document_id = de.document_id) as total_chunks
  FROM document_embeddings de
  JOIN documents d ON de.document_id = d.id
  WHERE de.id = ANY(chunk_ids)
    AND d.project_id = filter_project_id
  ORDER BY d.file_path, COALESCE((de.metadata->>'chunk_index')::int, 0);
END;
$$;
