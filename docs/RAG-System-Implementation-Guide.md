# RAG System Implementation Guide

A comprehensive guide to implementing a production-ready Retrieval-Augmented Generation (RAG) system using vector embeddings, semantic search, and reranking.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Database Schema](#database-schema)
4. [Embedding Generation](#embedding-generation)
5. [Document Chunking](#document-chunking)
6. [Indexing Pipeline](#indexing-pipeline)
7. [Search Pipeline](#search-pipeline)
8. [Incremental Re-indexing](#incremental-re-indexing)
9. [Rate Limiting](#rate-limiting)
10. [Environment Variables](#environment-variables)
11. [Dependencies](#dependencies)

---

## Architecture Overview

The RAG system follows a three-stage pipeline:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   INDEXING      │     │    RETRIEVAL    │     │   RERANKING     │
│                 │     │                 │     │                 │
│ Documents       │     │ Query           │     │ Candidates      │
│     ↓           │     │     ↓           │     │     ↓           │
│ Chunking (AST)  │     │ Embed Query     │     │ Cohere Rerank   │
│     ↓           │     │     ↓           │     │     ↓           │
│ Embeddings      │     │ Vector Search   │     │ Filtered        │
│     ↓           │     │     ↓           │     │   Results       │
│ Supabase        │────▶│ Top-N Matches   │────▶│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Key Design Decisions

1. **Asymmetric Embeddings**: Different task types for documents vs queries
2. **Two-Stage Retrieval**: Vector search (recall) + Reranking (precision)
3. **Incremental Indexing**: Only re-embed changed chunks (90% token savings)
4. **Multi-tenant Isolation**: Project-scoped data access

---

## Tech Stack

### Vector Database
- **Supabase** with `pgvector` extension
- HNSW index for fast approximate nearest neighbor search
- PostgreSQL RPC functions for similarity queries

### Embedding Models

| Model | Provider | Dimensions | Best For |
|-------|----------|------------|----------|
| `jina-embeddings-v3` | Jina AI | 512 (Matryoshka) | Code & Documentation |
| `text-embedding-004` | Google Gemini | 768 | General text (fallback) |

### Generative Model (RAG Answers)
- **Gemini 2.0 Flash** (`gemini-2.0-flash-exp`) for generating AI answers from retrieved context

### Reranking
- **Cohere** `rerank-english-v3.0` for semantic reranking

### Chunking
- **web-tree-sitter** for AST-based code chunking
- Header-based splitting for Markdown documents

---

## Database Schema

### Enable pgvector Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Projects Table (Multi-tenant)

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
```

### Documents Table

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  checksum TEXT NOT NULL,  -- MD5 hash for change detection
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),

  UNIQUE(project_id, file_path)
);
```

### Embeddings Table

```sql
CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content_chunk TEXT NOT NULL,
  chunk_hash TEXT,  -- For incremental indexing
  embedding VECTOR(512),  -- Jina v3 Matryoshka dimensions
  metadata JSONB
);
```

### HNSW Index (Recommended)

```sql
CREATE INDEX document_embeddings_embedding_idx
ON document_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Vector Search Function (RPC)

```sql
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding VECTOR(512),
  match_threshold FLOAT,
  match_count INT,
  filter_project_id UUID
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content_chunk TEXT,
  similarity FLOAT,
  file_path TEXT,
  title TEXT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.document_id,
    de.content_chunk,
    1 - (de.embedding <=> query_embedding) AS similarity,
    d.file_path,
    d.title
  FROM document_embeddings de
  JOIN documents d ON de.document_id = d.id
  WHERE d.project_id = filter_project_id
  AND 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## Embedding Generation

### Jina Embeddings v3 (Primary)

Jina v3 supports **asymmetric search** with different task types:

```typescript
// For storing documents (passages)
async function generateDocumentEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JINA_API_KEY}`
    },
    body: JSON.stringify({
      model: 'jina-embeddings-v3',
      task: 'retrieval.passage',  // Optimized for document storage
      dimensions: 512,            // Matryoshka truncation
      input: [text]
    })
  });

  const data = await response.json();
  return data.data[0].embedding;
}

// For search queries
async function generateQueryEmbedding(query: string): Promise<number[]> {
  const response = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JINA_API_KEY}`
    },
    body: JSON.stringify({
      model: 'jina-embeddings-v3',
      task: 'retrieval.query',  // Optimized for queries
      dimensions: 512,
      input: [query]
    })
  });

  const data = await response.json();
  return data.data[0].embedding;
}
```

### Google Gemini (Fallback)

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

async function generateEmbedding(text: string): Promise<number[]> {
  const cleanText = text.replace(/\n+/g, " ").trim();
  const result = await model.embedContent(cleanText);
  return result.embedding.values;  // 768 dimensions
}
```

---

## Document Chunking

### Strategy Overview

| File Type | Chunking Method | Tool |
|-----------|----------------|------|
| TypeScript/JavaScript | AST-based (functions, classes, exports) | web-tree-sitter |
| Python | AST-based (functions, classes, decorators) | web-tree-sitter |
| Markdown | Header-based (## sections) | Regex split |
| Other | Double-newline blocks | Regex split |

### AST Chunking Implementation

```typescript
import TreeSitter from "web-tree-sitter";

interface CodeChunk {
  content: string;
  type: string;
  startLine: number;
  endLine: number;
  metadata: {
    language: string;
    filePath: string;
    parentContext?: string;
  };
}

// Extractable node types by language
const EXTRACTABLE_TYPES = {
  typescript: [
    "function_declaration",
    "class_declaration",
    "method_definition",
    "arrow_function",
    "interface_declaration",
    "type_alias_declaration",
    "export_statement",
  ],
  javascript: [
    "function_declaration",
    "class_declaration",
    "method_definition",
    "arrow_function",
    "export_statement",
  ],
  python: [
    "function_definition",
    "class_definition",
    "decorated_definition",
  ],
};

class ASTChunker {
  private parser: TreeSitter.Parser;
  private languages: Map<string, TreeSitter.Language> = new Map();

  async init() {
    await TreeSitter.init();
    this.parser = new TreeSitter();

    // Load language grammars
    const tsLang = await TreeSitter.Language.load('tree-sitter-typescript.wasm');
    this.languages.set('typescript', tsLang);
  }

  async chunkFile(filePath: string, content: string): Promise<CodeChunk[]> {
    const lang = this.getLanguageFromPath(filePath);

    if (lang === 'markdown') {
      return this.chunkMarkdown(content, filePath);
    }

    const language = this.languages.get(lang);
    if (!language) {
      return this.fallbackChunking(content, filePath);
    }

    this.parser.setLanguage(language);
    const tree = this.parser.parse(content);
    return this.extractChunks(tree, content, lang, filePath);
  }

  private chunkMarkdown(content: string, filePath: string): CodeChunk[] {
    const sections = content.split(/^## /gm);
    return sections
      .filter(s => s.trim())
      .map((section, i) => ({
        content: i === 0 ? section : `## ${section}`,
        type: 'markdown_section',
        startLine: 1,
        endLine: section.split('\n').length,
        metadata: { language: 'markdown', filePath }
      }));
  }
}
```

---

## Indexing Pipeline

### Full Indexing Script

```typescript
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import matter from "gray-matter";
import fs from "fs";
import path from "path";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function calculateChecksum(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

async function indexKnowledgeBase(basePath: string, projectSlug: string) {
  // 1. Get or create project
  const { data: project } = await supabase
    .from("projects")
    .upsert({ slug: projectSlug }, { onConflict: "slug" })
    .select()
    .single();

  // 2. Find all markdown files
  const files = getMarkdownFiles(basePath);

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf-8");
    const relativePath = path.relative(basePath, filePath);
    const checksum = calculateChecksum(content);

    // 3. Check if unchanged
    const { data: existing } = await supabase
      .from("documents")
      .select("id, checksum")
      .eq("project_id", project.id)
      .eq("file_path", relativePath)
      .single();

    if (existing?.checksum === checksum) {
      console.log(`Skipping unchanged: ${relativePath}`);
      continue;
    }

    // 4. Parse frontmatter
    const { data: frontmatter, content: markdownContent } = matter(content);
    const title = frontmatter.id || path.basename(filePath, ".md");

    // 5. Upsert document
    const { data: doc } = await supabase
      .from("documents")
      .upsert({
        project_id: project.id,
        file_path: relativePath,
        title,
        content: markdownContent,
        checksum,
      }, { onConflict: "project_id, file_path" })
      .select()
      .single();

    // 6. Delete old embeddings
    await supabase
      .from("document_embeddings")
      .delete()
      .eq("document_id", doc.id);

    // 7. Chunk and embed
    const chunks = chunkByHeaders(markdownContent);

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateDocumentEmbedding(chunks[i]);

      await supabase.from("document_embeddings").insert({
        document_id: doc.id,
        content_chunk: chunks[i],
        chunk_hash: calculateChecksum(chunks[i]),
        embedding,
        metadata: { chunk_index: i, source: "indexer" }
      });

      // Rate limiting
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}
```

---

## Search Pipeline

### Two-Stage Retrieval with Reranking

```typescript
import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({ token: COHERE_API_KEY });

const SEARCH_CONFIG = {
  initialFetchCount: 50,   // Fetch more for reranking
  finalMatchCount: 15,     // Return top results
  minRerankScore: 0.5,     // Relevance threshold
};

async function searchDocuments(query: string, projectId: string) {
  // 1. Generate query embedding (with query task type)
  const queryEmbedding = await generateQueryEmbedding(query);

  // 2. Vector search (high recall)
  const { data: candidates } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.1,  // Low threshold for recall
    match_count: SEARCH_CONFIG.initialFetchCount,
    filter_project_id: projectId,
  });

  if (!candidates?.length) return [];

  // 3. Rerank with Cohere (high precision)
  const docsForRerank = candidates.map(doc => ({
    id: doc.id,
    text: doc.content_chunk,
  }));

  const rerankResponse = await cohere.rerank({
    model: "rerank-english-v3.0",
    query: query,
    documents: docsForRerank,
    topN: SEARCH_CONFIG.finalMatchCount,
  });

  // 4. Filter and transform results
  return rerankResponse.results
    .filter(r => r.relevanceScore >= SEARCH_CONFIG.minRerankScore)
    .map(result => ({
      ...candidates[result.index],
      relevance: result.relevanceScore,
    }));
}
```

---

## Incremental Re-indexing

Avoid re-embedding unchanged content by using chunk hashes:

```typescript
async function syncDocument(projectId: string, filePath: string, content: string) {
  const checksum = calculateChecksum(content);

  // 1. Check document checksum
  const { data: existing } = await supabase
    .from("documents")
    .select("id, checksum")
    .eq("project_id", projectId)
    .eq("file_path", filePath)
    .single();

  if (existing?.checksum === checksum) {
    return { chunksIndexed: 0, chunksReused: 0 };  // No changes
  }

  // 2. Upsert document
  const { data: doc } = await supabase
    .from("documents")
    .upsert({ project_id: projectId, file_path: filePath, content, checksum })
    .select()
    .single();

  // 3. Chunk content
  const chunks = await astChunker.chunkFile(filePath, content);
  const chunkData = chunks.map((chunk, i) => ({
    content: chunk.content,
    hash: calculateChecksum(chunk.content),
    index: i,
  }));

  // 4. Get existing embeddings
  const { data: existingEmbeddings } = await supabase
    .from("document_embeddings")
    .select("id, chunk_hash")
    .eq("document_id", doc.id);

  const existingHashes = new Set(existingEmbeddings?.map(e => e.chunk_hash));
  const newHashes = new Set(chunkData.map(c => c.hash));

  // 5. Find changed chunks only
  const chunksToEmbed = chunkData.filter(c => !existingHashes.has(c.hash));

  // 6. Delete orphaned embeddings (removed sections)
  const orphanedIds = existingEmbeddings
    ?.filter(e => !newHashes.has(e.chunk_hash))
    .map(e => e.id);

  if (orphanedIds?.length) {
    await supabase.from("document_embeddings").delete().in("id", orphanedIds);
  }

  // 7. Embed only new/changed chunks
  for (const chunk of chunksToEmbed) {
    const embedding = await generateDocumentEmbedding(chunk.content);

    await supabase.from("document_embeddings").insert({
      document_id: doc.id,
      content_chunk: chunk.content,
      chunk_hash: chunk.hash,
      embedding,
      metadata: { chunk_index: chunk.index, source: "incremental-sync" }
    });
  }

  return {
    chunksIndexed: chunksToEmbed.length,
    chunksReused: chunks.length - chunksToEmbed.length,
  };
}
```

---

## Rate Limiting

### API Rate Limits

| Provider | Rate Limit | Recommended Delay |
|----------|------------|-------------------|
| Jina AI | 500 RPM | 200ms between requests |
| Google Gemini | 15 RPM | 4000ms between requests |
| Cohere Rerank | 100 RPM | 600ms between requests |

### Implementation Pattern

```typescript
async function batchEmbedWithRateLimit(
  texts: string[],
  delayMs: number = 1000
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const embedding = await generateDocumentEmbedding(texts[i]);
    embeddings.push(embedding);

    // Add delay between requests (except for last one)
    if (i < texts.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return embeddings;
}
```

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Embedding Providers
JINA_API_KEY=jina_xxx  # Primary
GEMINIAI_API_KEY=AIza...  # Fallback

# Reranking
COHERE_API_KEY=xxx

# Optional: Disable AST chunking
DISABLE_AST_CHUNKING=false
```

---

## Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "@google/generative-ai": "^0.x",
    "cohere-ai": "^7.x",
    "web-tree-sitter": "^0.22.x",
    "gray-matter": "^4.x"
  }
}
```

### Tree-sitter WASM Files

For AST chunking, you need language grammar WASM files:

```bash
# Download from tree-sitter releases or build yourself
public/wasm/
  ├── web-tree-sitter.wasm
  ├── tree-sitter-typescript.wasm
  ├── tree-sitter-javascript.wasm
  └── tree-sitter-python.wasm
```

---

## Performance Considerations

### Vector Index Choice

| Index Type | Build Time | Query Speed | Memory | Best For |
|------------|------------|-------------|--------|----------|
| IVFFlat | Fast | Medium | Low | < 100k vectors |
| HNSW | Slow | Fast | High | > 100k vectors |

### Dimension Reduction (Matryoshka)

Jina v3 supports Matryoshka embeddings - you can truncate to smaller dimensions:

| Dimensions | Quality | Speed | Use Case |
|------------|---------|-------|----------|
| 1024 | Best | Slowest | High precision |
| 512 | Good | Balanced | **Recommended** |
| 256 | Fair | Fastest | Quick prototyping |

---

## AI Answer Generation (Gemini 2.0 Flash)

Generate human-friendly answers from retrieved documents:

### Configuration

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const flashModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
  generationConfig: {
    temperature: 0.3,  // Lower for factual responses
    topP: 0.8,
    maxOutputTokens: 1024,
  }
});
```

### RAG Answer Function

```typescript
interface RAGContext {
  title: string;
  path: string;
  content: string;
  relevance: number;
}

interface RAGAnswer {
  answer: string;
  sources: { title: string; path: string }[];
  relatedQuestions: string[];
}

async function generateRAGAnswer(
  query: string,
  contexts: RAGContext[]
): Promise<RAGAnswer> {
  // Build context from top 5 most relevant documents
  const contextStr = contexts
    .slice(0, 5)
    .map((ctx, i) => `[Source ${i + 1}: ${ctx.title}]\n${ctx.content}`)
    .join("\n\n---\n\n");

  const prompt = `You are a helpful documentation assistant. Answer the user's question based ONLY on the provided documentation context. Be concise, accurate, and cite your sources.

## Rules:
1. Only use information from the provided context
2. If the context doesn't contain enough information, say so
3. Use markdown formatting for code snippets and lists
4. Keep the answer focused and actionable
5. Suggest 2-3 related questions the user might want to ask

## Documentation Context:
${contextStr}

## User Question:
${query}

## Response Format:
Provide your answer, then list related questions the user might want to explore.`;

  const result = await flashModel.generateContent(prompt);
  const response = result.response.text();

  return {
    answer: cleanAnswer(response),
    sources: contexts.slice(0, 5).map(ctx => ({
      title: ctx.title,
      path: ctx.path,
    })),
    relatedQuestions: extractRelatedQuestions(response),
  };
}
```

### Complete RAG Pipeline

```typescript
async function askQuestion(query: string, projectId: string) {
  // 1. Vector search to get relevant documents
  const searchResults = await searchDocuments(query, projectId);

  // 2. Fetch full content for top results
  const contexts = await Promise.all(
    searchResults.slice(0, 5).map(async (result) => {
      const doc = await getDocument(result.path, projectId);
      return {
        title: result.title,
        path: result.path,
        content: doc.content.slice(0, 3000), // Limit per doc
        relevance: result.relevance,
      };
    })
  );

  // 3. Generate AI answer
  const ragAnswer = await generateRAGAnswer(query, contexts);

  return {
    aiAnswer: ragAnswer.answer,
    sources: ragAnswer.sources,
    relatedQuestions: ragAnswer.relatedQuestions,
    results: searchResults,
  };
}
```

### Prompt Engineering Tips

1. **Ground responses in context** - Instruct the model to only use provided documents
2. **Request structured output** - Ask for related questions separately
3. **Use low temperature** - 0.3 for factual, documentation-based answers
4. **Limit context size** - 3-4k tokens per document, 5 docs max
5. **Extract metadata** - Parse related questions from the response

---

## Summary

1. **Use asymmetric embeddings** - Different task types for documents vs queries
2. **Implement two-stage retrieval** - Vector search + Cohere reranking
3. **Enable incremental indexing** - Only re-embed changed chunks
4. **Choose appropriate chunking** - AST for code, headers for docs
5. **Respect rate limits** - Add delays between API calls
6. **Use HNSW index** - Better performance at scale
7. **Multi-tenant isolation** - Filter by project_id in all queries

This architecture provides a production-ready RAG system with high precision search and efficient resource usage.