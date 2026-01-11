-- Quoth Vector Schema
-- Run this in Supabase SQL Editor to set up the database

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Projects table (Multi-tenant support)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, -- e.g., "quoth-knowledge-base"
  github_repo text not null, -- e.g., "org/repo"
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Documents table (Markdown files)
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  file_path text not null, -- e.g., "patterns/backend-unit.md"
  title text not null,
  content text not null, -- Raw content for direct reading
  checksum text not null, -- MD5 hash to detect changes
  last_updated timestamp with time zone default timezone('utc'::text, now()),

  unique(project_id, file_path)
);

-- 4. Document Embeddings table (Vector storage)
create table if not exists document_embeddings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  content_chunk text not null, -- The text fragment that was embedded
  -- CRITICAL: 768 dimensions is the fixed output of Gemini text-embedding-004
  embedding vector(768),
  metadata jsonb -- e.g., { "chunk_index": 0, "source": "markdown-h2-split" }
);

-- 5. Create index for vector similarity search (CRITICAL for performance)
create index if not exists document_embeddings_embedding_idx
  on document_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 6. Semantic Search Function (RPC)
-- Called from Supabase client as: supabase.rpc('match_documents', {...})
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_project_id uuid
)
returns table (
  id uuid,
  document_id uuid,
  content_chunk text,
  similarity float,
  file_path text,
  title text
)
language plpgsql stable
as $$
begin
  return query
  select
    de.id,
    de.document_id,
    de.content_chunk,
    1 - (de.embedding <=> query_embedding) as similarity,
    d.file_path,
    d.title
  from document_embeddings de
  join documents d on de.document_id = d.id
  where d.project_id = filter_project_id
  and 1 - (de.embedding <=> query_embedding) > match_threshold
  order by de.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 7. Helper function to get document by path
create or replace function get_document_by_path (
  p_project_id uuid,
  p_file_path text
)
returns table (
  id uuid,
  file_path text,
  title text,
  content text,
  last_updated timestamp with time zone
)
language plpgsql stable
as $$
begin
  return query
  select
    d.id,
    d.file_path,
    d.title,
    d.content,
    d.last_updated
  from documents d
  where d.project_id = p_project_id
  and d.file_path = p_file_path;
end;
$$;
