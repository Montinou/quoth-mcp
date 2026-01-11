# Phase 3: Proposal Flow Modification

**Status:** 🔴 Not Started  
**Risk Level:** Medium  
**Estimated Time:** 1 hour  
**Dependencies:** Phase 1, Phase 2 complete

---

## Overview

Modify `quoth_propose_update` to support:
1. **Configurable approval** - Check `project.require_approval` flag
2. **Direct apply mode** - If no approval required, save directly to documents
3. **Incremental re-indexing** - Use chunk hashes to minimize embedding calls

---

## Files to Modify

### [MODIFY] src/lib/sync.ts

**Complete replacement** with incremental re-indexing:

```typescript
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
 */
export function chunkByHeaders(content: string, minChunkLength: number = 50): string[] {
  const chunks = content.split(/^## /gm);
  return chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= minChunkLength);
}

/**
 * Sync document with INCREMENTAL re-indexing
 * Only re-embed chunks whose content has changed
 */
export async function syncDocument(
  projectId: string,
  filePath: string,
  title: string,
  content: string
): Promise<{ 
  document: Document & { version?: number }; 
  chunksIndexed: number; 
  chunksReused: number 
}> {
  const checksum = calculateChecksum(content);

  // 1. Check if document unchanged
  const { data: existing } = await supabase
    .from("documents")
    .select("id, checksum, version")
    .eq("project_id", projectId)
    .eq("file_path", filePath)
    .single();

  if (existing && existing.checksum === checksum) {
    return {
      document: existing as Document & { version?: number },
      chunksIndexed: 0,
      chunksReused: 0,
    };
  }

  // 2. Upsert document (trigger handles versioning)
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .upsert({
      project_id: projectId,
      file_path: filePath,
      title,
      content,
      checksum,
      last_updated: new Date().toISOString(),
    }, { onConflict: "project_id, file_path" })
    .select()
    .single();

  if (docError) throw new Error(`Failed to upsert: ${docError.message}`);

  // 3. Chunk content
  let chunks = chunkByHeaders(content);
  if (chunks.length === 0) chunks = [content];

  // 4. Calculate hashes
  const chunkData = chunks.map((chunk, index) => ({
    content: chunk,
    hash: calculateChecksum(chunk),
    index,
  }));

  // 5. Get existing embeddings
  const { data: existingEmbeddings } = await supabase
    .from("document_embeddings")
    .select("id, chunk_hash")
    .eq("document_id", doc.id);

  const existingHashes = new Set((existingEmbeddings || []).map(e => e.chunk_hash));
  const newHashes = new Set(chunkData.map(c => c.hash));

  // 6. Find chunks to embed (changed/new)
  const chunksToEmbed = chunkData.filter(c => !existingHashes.has(c.hash));
  
  // 7. Find orphaned embeddings (removed sections)
  const orphanedIds = (existingEmbeddings || [])
    .filter(e => !newHashes.has(e.chunk_hash))
    .map(e => e.id);

  // 8. Delete orphaned
  if (orphanedIds.length > 0) {
    await supabase.from("document_embeddings").delete().in("id", orphanedIds);
  }

  // 9. Generate embeddings for new/changed only
  let indexedCount = 0;
  for (const chunk of chunksToEmbed) {
    try {
      const embedding = await generateEmbedding(chunk.content);
      await supabase.from("document_embeddings").insert({
        document_id: doc.id,
        content_chunk: chunk.content,
        chunk_hash: chunk.hash,
        embedding,
        metadata: { chunk_index: chunk.index, source: "incremental-sync" },
      });
      indexedCount++;
      if (indexedCount < chunksToEmbed.length) {
        await new Promise(r => setTimeout(r, 4200)); // Rate limit
      }
    } catch (error) {
      console.error(`Failed chunk ${chunk.index}:`, error);
    }
  }

  return {
    document: doc as Document & { version?: number },
    chunksIndexed: indexedCount,
    chunksReused: chunks.length - chunksToEmbed.length,
  };
}

// Keep other functions: deleteDocument, getSyncStatus
```

---

### [MODIFY] src/lib/quoth/tools.ts

**Update `quoth_propose_update` handler** to support configurable approval:

```typescript
// In the quoth_propose_update handler, ADD this logic after auth checks:

// Get project settings
const { data: project } = await supabase
  .from('projects')
  .select('require_approval')
  .eq('id', authContext.project_id)
  .single();

// DIRECT APPLY MODE (no approval required)
if (project && !project.require_approval) {
  const { document, chunksIndexed, chunksReused } = await syncDocument(
    authContext.project_id,
    existingDoc.path,
    existingDoc.title,
    new_content
  );

  return {
    content: [{
      type: 'text' as const,
      text: `## ✅ Documentation Updated Directly

**Document**: ${existingDoc.title}
**Path**: \`${existingDoc.path}\`
**Version**: ${document.version}

### Indexing Stats
- Chunks re-indexed: ${chunksIndexed}
- Chunks reused (cached): ${chunksReused}
- Token savings: ${chunksReused > 0 ? Math.round((chunksReused / (chunksIndexed + chunksReused)) * 100) : 0}%

---
*Changes applied immediately. Previous version preserved in history.*`,
    }],
  };
}

// APPROVAL REQUIRED MODE (existing flow continues below)
// ... existing proposal creation code ...
```

**Update success message** in existing proposal flow (lines 247-254):
```diff
- 2. If approved, changes are committed to GitHub
- 3. The knowledge base is re-indexed automatically
+ 2. If approved, changes are saved directly to the knowledge base
+ 3. Previous version automatically preserved in history
+ 4. Vector embeddings regenerated (incrementally)
```

---

## Step-by-Step Instructions

### Step 3.1: Update sync.ts

1. Open `src/lib/sync.ts`
2. Replace the `syncDocument` function with the new incremental version
3. Keep other existing functions (`deleteDocument`, `getSyncStatus`)

### Step 3.2: Update tools.ts

1. Open `src/lib/quoth/tools.ts`
2. Add import at top:
   ```typescript
   import { syncDocument } from '../sync';
   ```
3. In `quoth_propose_update` handler, after line `const existingDoc = await readDocument(...)`:
   - Add project lookup
   - Add conditional direct apply mode
4. Update existing proposal success message text

### Step 3.3: Verify Build

```bash
npm run build
```

---

## Checklist

- [ ] Update `src/lib/sync.ts` with incremental re-indexing
- [ ] Add `syncDocument` import to `tools.ts`
- [ ] Add project `require_approval` check to `quoth_propose_update`
- [ ] Add direct apply mode branch
- [ ] Update approval mode message text
- [ ] Run `npm run build` - no errors
- [ ] Update [status.md](./status.md) - mark Phase 3 complete
- [ ] Commit changes: `git commit -m "Phase 3: Proposal flow with incremental indexing"`

---

## Next Phase

Proceed to [Phase 4: GitHub Removal](./phase-04-github-removal.md).
