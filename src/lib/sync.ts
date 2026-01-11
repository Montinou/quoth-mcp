import { createHash } from "crypto";
import { supabase, type Document } from "./supabase";
import { generateEmbedding } from "./ai";

/**
 * Calculate MD5 checksum for content
 */
export function calculateChecksum(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

/**
 * Chunk markdown content by H2 headers
 * Each chunk includes the H2 title for context
 */
export function chunkByHeaders(content: string, minChunkLength: number = 50): string[] {
  // Split by H2 headers (## )
  const chunks = content.split(/^## /gm);

  return chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= minChunkLength);
}

/**
 * Sync a single document to Supabase with embeddings
 *
 * 1. Upsert document record
 * 2. Delete old embeddings
 * 3. Chunk content by H2 headers
 * 4. Generate embeddings for each chunk
 * 5. Insert new embeddings
 */
export async function syncDocument(
  projectId: string,
  filePath: string,
  title: string,
  content: string
): Promise<{ document: Document; chunksIndexed: number }> {
  const checksum = calculateChecksum(content);

  // 1. Check if document exists and hasn't changed
  const { data: existing } = await supabase
    .from("documents")
    .select("id, checksum")
    .eq("project_id", projectId)
    .eq("file_path", filePath)
    .single();

  if (existing && existing.checksum === checksum) {
    // Document unchanged, skip re-indexing
    return {
      document: existing as Document,
      chunksIndexed: 0,
    };
  }

  // 2. Upsert document record
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .upsert(
      {
        project_id: projectId,
        file_path: filePath,
        title,
        content,
        checksum,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "project_id, file_path" }
    )
    .select()
    .single();

  if (docError) {
    throw new Error(`Failed to upsert document: ${docError.message}`);
  }

  // 3. Delete old embeddings for this document
  await supabase
    .from("document_embeddings")
    .delete()
    .eq("document_id", doc.id);

  // 4. Chunk content by H2 headers
  const chunks = chunkByHeaders(content);

  if (chunks.length === 0) {
    // If no H2 headers, treat entire content as one chunk
    chunks.push(content);
  }

  // 5. Generate embeddings and insert
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    try {
      const embedding = await generateEmbedding(chunk);

      await supabase.from("document_embeddings").insert({
        document_id: doc.id,
        content_chunk: chunk,
        embedding,
        metadata: {
          chunk_index: i,
          source: "markdown-h2-split",
        },
      });

      // Rate limiting: 4.2s delay between Gemini API calls (15 RPM limit)
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 4200));
      }
    } catch (error) {
      console.error(`Failed to embed chunk ${i} of ${filePath}:`, error);
      // Continue with other chunks even if one fails
    }
  }

  return {
    document: doc as Document,
    chunksIndexed: chunks.length,
  };
}

/**
 * Delete a document and its embeddings
 */
export async function deleteDocument(
  projectId: string,
  filePath: string
): Promise<boolean> {
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("project_id", projectId)
    .eq("file_path", filePath);

  return !error;
}

/**
 * Get sync status for a project
 */
export async function getSyncStatus(projectId: string): Promise<{
  documentCount: number;
  embeddingCount: number;
  lastSync: string | null;
}> {
  const { count: docCount } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { data: docs } = await supabase
    .from("documents")
    .select("id")
    .eq("project_id", projectId);

  let embeddingCount = 0;
  let lastSync: string | null = null;

  if (docs && docs.length > 0) {
    const docIds = docs.map((d) => d.id);

    const { count } = await supabase
      .from("document_embeddings")
      .select("*", { count: "exact", head: true })
      .in("document_id", docIds);

    embeddingCount = count || 0;

    // Get most recent update
    const { data: latest } = await supabase
      .from("documents")
      .select("last_updated")
      .eq("project_id", projectId)
      .order("last_updated", { ascending: false })
      .limit(1)
      .single();

    lastSync = latest?.last_updated || null;
  }

  return {
    documentCount: docCount || 0,
    embeddingCount,
    lastSync,
  };
}
