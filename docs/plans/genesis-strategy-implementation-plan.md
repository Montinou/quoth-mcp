# Quoth Genesis Strategy Implementation Plan

This document outlines the complete migration from GitHub-based storage and indexing to a Supabase-native architecture with version control triggers and AI persona injection, as defined in the [Quoth-Genesis-Strategy.md](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/docs/plans/Quoth-Genesis-Strategy.md).

## Overview

The Genesis Strategy fundamentally changes how Quoth operates:

| Aspect | Current (GitHub-Based) | New (Genesis Strategy) |
|--------|----------------------|----------------------|
| **Document Storage** | GitHub repo + Supabase mirror | Supabase only (single source of truth) |
| **Versioning** | Git commit history | `document_history` table with triggers |
| **Indexing Source** | GitHub webhook sync | Direct Supabase write via AI client |
| **AI Workflow** | Server reads code | Server delivers persona prompt → AI client reads code locally |
| **Proposal Approval** | Commit to GitHub → Webhook → Supabase | Direct save to Supabase + re-index |

## User Review Required

> [!IMPORTANT]
> **Breaking Change**: Removing GitHub integration means:
> - The `quoth-knowledge-base/` folder in the GitHub repo will no longer be the source of truth
> - Existing GitHub workflow (commits triggering webhooks) will stop working
> - The `octokit` npm dependency will be removed

> [!WARNING]
> **Data Migration**: Before deployment, any existing documents in the `quoth-knowledge-base/` folder should be migrated to Supabase. This plan includes a migration script.

---

## Proposed Changes

### Database Schema

#### [NEW] [006_genesis_versioning.sql](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/supabase/migrations/006_genesis_versioning.sql)

New migration file to add versioning infrastructure:

```sql
-- 1. Add version column to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version int DEFAULT 1;

-- 2. Add require_approval setting to projects (configurable governance)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS require_approval boolean DEFAULT true;
COMMENT ON COLUMN projects.require_approval IS 'If true, proposals require human approval. If false, AI updates apply directly.';

-- 3. Create document_history table for backups
CREATE TABLE IF NOT EXISTS document_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  title text NOT NULL,
  version int NOT NULL,
  archived_at timestamptz DEFAULT now()
);

-- 4. Create index for efficient history queries
CREATE INDEX IF NOT EXISTS idx_document_history_document_id 
  ON document_history(document_id);
CREATE INDEX IF NOT EXISTS idx_document_history_archived_at 
  ON document_history(archived_at DESC);

-- 5. Add chunk_hash to document_embeddings for incremental re-indexing
-- This allows us to detect unchanged chunks and skip re-embedding them
ALTER TABLE document_embeddings 
  ADD COLUMN IF NOT EXISTS chunk_hash text;
CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_hash 
  ON document_embeddings(document_id, chunk_hash);
COMMENT ON COLUMN document_embeddings.chunk_hash IS 'MD5 hash of content_chunk for incremental re-indexing optimization';

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
COMMENT ON TABLE document_history IS 'Version history of documents, automatically populated by trigger';
COMMENT ON FUNCTION backup_document_before_update IS 'Trigger function that saves old document content before updates';
```

---

### Genesis Tool

#### [NEW] [genesis.ts](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/lib/quoth/genesis.ts)

New file implementing the `quoth_genesis` persona injection tool:

```typescript
/**
 * Quoth Genesis Tool
 * "Teacher-Student Pattern" - Delivers persona prompts to bootstrap documentation
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthContext } from '../auth/mcp-auth';

/**
 * The Genesis Persona Prompt - Core asset for bootstrapping documentation
 * Uses XML structure to enforce strict AI behavior
 */
export const GENESIS_PERSONA_PROMPT = `<genesis_protocol>
    <role>
        You are now the **Quoth Genesis Architect**. Your goal is to analyze the local codebase and strictly formalize its architectural patterns into the Quoth Knowledge Base.
    </role>

    <prime_directive>
        DO NOT invent rules. Only document what you see implemented in code.
        If a pattern is inconsistent, document the dominant pattern.
    </prime_directive>

    <execution_steps>
        <step id="1">
            **Skeleton Scan:** Read \`package.json\`, \`tsconfig.json\`, and root config files.
            Identify: Framework, ORM, Test Runner, Auth Provider.
        </step>
        <step id="2">
            **Structure Analysis:** List the \`src/\` directory. Deduce the architectural pattern (e.g., MVC, Hexagonal, Feature-based).
        </step>
        <step id="3">
            **Pattern Extraction:** Read 2-3 files from key directories (\`controllers\`, \`components\`, \`tests\`).
            Extract: Naming conventions, mandatory imports, error handling patterns.
        </step>
        <step id="4">
            **Ingestion:** For each identified pattern, construct a Markdown file and call the \`quoth_propose_update\` tool.
        </step>
    </execution_steps>

    <output_template>
        For every document, you MUST use this format:

        ---
        id: [unique-slug]
        type: [pattern|architecture|contract]
        status: active
        ---
        # [Title]

        ## The Rule
        [Explanation]

        ## Evidence
        [Snippet from codebase]
    </output_template>

    <instruction>
        Start immediately by executing Step 1. Use your file reading capabilities to scan the current directory.
    </instruction>
</genesis_protocol>`;

/**
 * Register the quoth_genesis tool on an MCP server
 */
export function registerGenesisTools(
  server: McpServer,
  authContext: AuthContext
) {
  server.registerTool(
    'quoth_genesis',
    {
      title: 'Initialize Quoth Protocol',
      description: 
        'Injects the Genesis Persona into the current AI session to bootstrap documentation. ' +
        'This tool transforms the AI into a codebase analyst that will read local files ' +
        'and generate structured documentation.',
      inputSchema: {
        focus: z.enum(['full_scan', 'update_only']).default('full_scan')
          .describe('full_scan: Analyze entire codebase. update_only: Focus on recent changes.'),
        language_hint: z.string().optional()
          .describe('Optional hint about primary language (e.g., "typescript", "python")'),
      },
    },
    async ({ focus, language_hint }) => {
      // Build context-aware prompt
      let prompt = GENESIS_PERSONA_PROMPT;

      if (focus === 'update_only') {
        prompt = prompt.replace(
          '<instruction>',
          `<focus>UPDATE MODE: Focus only on recently modified files. Skip unchanged areas.</focus>\n    <instruction>`
        );
      }

      if (language_hint) {
        prompt = prompt.replace(
          '<instruction>',
          `<language_context>Primary language: ${language_hint}</language_context>\n    <instruction>`
        );
      }

      return {
        content: [{
          type: 'text' as const,
          text: `## Quoth Genesis Protocol Activated

The following persona has been injected. The AI should now adopt the role of **Quoth Genesis Architect** and begin analyzing the local codebase.

${prompt}

---

**Instructions for the AI:**
1. You are now operating as the Quoth Genesis Architect
2. Begin with Step 1: Read \`package.json\` and root config files
3. Use your local file access to analyze the codebase
4. For each pattern discovered, call \`quoth_propose_update\` to submit it

**Project Context:**
- Project ID: \`${authContext.project_id}\`
- Focus Mode: \`${focus}\`
${language_hint ? `- Language Hint: \`${language_hint}\`` : ''}`,
        }],
      };
    }
  );
}
```

---

### Proposal Approval Flow

#### [MODIFY] [approve/route.ts](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/app/api/proposals/%5Bid%5D/approve/route.ts)

Replace GitHub commit with direct Supabase save and re-indexing:

```diff
- import { commitProposalToGitHub } from '@/lib/github';
+ import { syncDocument } from '@/lib/sync';

// In the POST handler, replace the GitHub commit section:

-   // 8. Commit to GitHub
-   console.log(`Committing proposal ${id} to GitHub...`);
-   const commitResult = await commitProposalToGitHub(proposal);
-
-   // 9. Update with commit info or error
-   if (commitResult.success) {
-     await supabase
-       .from('document_proposals')
-       .update({
-         status: 'applied',
-         commit_sha: commitResult.sha,
-         commit_url: commitResult.url,
-         applied_at: new Date().toISOString()
-       })
-       .eq('id', id);
+   // 8. Apply changes directly to Supabase and re-index
+   try {
+     // Get document title from file_path
+     const title = proposal.file_path.replace('.md', '').split('/').pop() || proposal.file_path;
+     
+     // Sync document (upsert + generate embeddings)
+     // The documents table trigger will handle versioning automatically
+     const { document, chunksIndexed } = await syncDocument(
+       proposal.project_id,
+       proposal.file_path,
+       title,
+       proposal.proposed_content
+     );
+
+     // Update proposal status
+     await supabase
+       .from('document_proposals')
+       .update({
+         status: 'applied',
+         applied_at: new Date().toISOString()
+       })
+       .eq('id', id);

-     // 10. Send email notification (fire and forget)
-     sendApprovalNotification(
-       { ...proposal, reviewed_by: profile.email },
-       commitResult
-     ).catch((err) => console.error('Email notification failed:', err));
+     // 9. Send email notification (modified - no GitHub info)
+     sendApprovalNotification(
+       { ...proposal, reviewed_by: profile.email }
+     ).catch((err) => console.error('Email notification failed:', err));

      return Response.json({
        success: true,
-       message: 'Proposal approved and committed to GitHub',
-       commit: {
-         sha: commitResult.sha,
-         url: commitResult.url
-       }
+       message: 'Proposal approved and applied to knowledge base',
+       document: {
+         id: document.id,
+         version: document.version,
+         chunksIndexed
+       }
      });
+   } catch (error) {
+     // Save failed - mark as error
+     await supabase
+       .from('document_proposals')
+       .update({
+         status: 'error',
+         rejection_reason: `Apply failed: ${error instanceof Error ? error.message : 'Unknown error'}`
+       })
+       .eq('id', id);
+
+     return Response.json(
+       { error: 'Failed to apply changes', details: error instanceof Error ? error.message : 'Unknown error' },
+       { status: 500 }
+     );
+   }
```

---

### Library Files

#### [MODIFY] [tools.ts](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/lib/quoth/tools.ts)

**Major update:** Implement configurable approval flow. If `project.require_approval === false`, apply changes directly without creating a proposal.

```typescript
import { registerGenesisTools } from './genesis';
import { syncDocument } from '../sync';

// In quoth_propose_update handler, add project lookup and conditional flow:

async ({ doc_id, new_content, evidence_snippet, reasoning }) => {
  // ... existing auth checks ...

  // Get project settings
  const { data: project } = await supabase
    .from('projects')
    .select('require_approval')
    .eq('id', authContext.project_id)
    .single();

  // If project doesn't require approval, apply directly
  if (project && !project.require_approval) {
    // DIRECT APPLY MODE
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

### Evidence Provided
\`\`\`
${evidence_snippet}
\`\`\`

### Reasoning
${reasoning}

---
*Changes applied immediately. Previous version preserved in history.*`,
      }],
    };
  }

  // APPROVAL REQUIRED MODE (existing flow)
  // ... create proposal in document_proposals table ...
  return {
    content: [{
      type: 'text' as const,
      text: `## Update Proposal Created

**Proposal ID**: ${proposal.id}
...

**What happens next:**
1. Human reviewer examines the proposal in the dashboard
2. If approved, changes are saved directly to the knowledge base
3. Previous version is automatically preserved in history
4. Vector embeddings are regenerated (incrementally)
5. Email notification sent to tech leads`,
    }],
  };
}

// At the end of registerQuothTools:
registerGenesisTools(server, authContext);
```

#### [MODIFY] [types.ts](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/lib/quoth/types.ts)

Remove GitHub configuration:

```diff
export interface QuothConfig {
  knowledgeBasePath: string;
  cacheRevalidateSeconds: number;
- enableGitHub: boolean;
- githubRepo?: string;
- githubToken?: string;
}

export const DEFAULT_CONFIG: QuothConfig = {
  knowledgeBasePath: './quoth-knowledge-base',
  cacheRevalidateSeconds: 3600,
- enableGitHub: false,
};
```

#### [MODIFY] [supabase.ts](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/lib/supabase.ts)

Update Project interface and function:

```diff
export interface Project {
  id: string;
  slug: string;
- github_repo: string;
+ github_repo?: string; // Deprecated, kept for legacy compatibility
  created_at: string;
}

export async function getOrCreateProject(
  slug: string,
- githubRepo: string
): Promise<Project> {
  // Try to find existing project
  const { data: existing } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .single();

  if (existing) {
    return existing as Project;
  }

  // Create new project
  const { data: created, error } = await supabase
    .from("projects")
    .insert({
      slug,
-     github_repo: githubRepo,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create project: ${error.message}`);
  }

  return created as Project;
}
```

#### [MODIFY] [sync.ts](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/lib/sync.ts)

**Major refactor:** Implement incremental re-indexing to optimize token usage. Only re-embed changed chunks.

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
 * Each chunk includes the H2 title for context
 */
export function chunkByHeaders(content: string, minChunkLength: number = 50): string[] {
  const chunks = content.split(/^## /gm);
  return chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= minChunkLength);
}

/**
 * Sync a single document to Supabase with INCREMENTAL re-indexing
 * 
 * Optimization: Only re-embed chunks whose content has changed.
 * Uses chunk_hash to detect unchanged chunks and skip expensive embedding calls.
 * 
 * 1. Upsert document record
 * 2. Chunk content by H2 headers
 * 3. Calculate hash for each chunk
 * 4. Compare with existing embeddings
 * 5. Only generate embeddings for new/changed chunks
 * 6. Delete orphaned embeddings (removed sections)
 */
export async function syncDocument(
  projectId: string,
  filePath: string,
  title: string,
  content: string
): Promise<{ document: Document & { version?: number }; chunksIndexed: number; chunksReused: number }> {
  const checksum = calculateChecksum(content);

  // 1. Check if document exists and hasn't changed
  const { data: existing } = await supabase
    .from("documents")
    .select("id, checksum, version")
    .eq("project_id", projectId)
    .eq("file_path", filePath)
    .single();

  if (existing && existing.checksum === checksum) {
    // Document unchanged, skip re-indexing entirely
    return {
      document: existing as Document & { version?: number },
      chunksIndexed: 0,
      chunksReused: 0,
    };
  }

  // 2. Upsert document record (trigger will handle versioning)
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

  // 3. Chunk content by H2 headers
  let chunks = chunkByHeaders(content);
  if (chunks.length === 0) {
    chunks = [content]; // Treat entire content as one chunk
  }

  // 4. Calculate hash for each chunk
  const chunkData = chunks.map((chunk, index) => ({
    content: chunk,
    hash: calculateChecksum(chunk),
    index,
  }));

  // 5. Get existing embeddings with their hashes
  const { data: existingEmbeddings } = await supabase
    .from("document_embeddings")
    .select("id, chunk_hash")
    .eq("document_id", doc.id);

  const existingHashes = new Set((existingEmbeddings || []).map(e => e.chunk_hash));
  const newHashes = new Set(chunkData.map(c => c.hash));

  // 6. Find chunks that need embedding (new or changed)
  const chunksToEmbed = chunkData.filter(c => !existingHashes.has(c.hash));
  
  // 7. Find orphaned embeddings (removed sections)
  const orphanedIds = (existingEmbeddings || [])
    .filter(e => !newHashes.has(e.chunk_hash))
    .map(e => e.id);

  // 8. Delete orphaned embeddings
  if (orphanedIds.length > 0) {
    await supabase
      .from("document_embeddings")
      .delete()
      .in("id", orphanedIds);
  }

  // 9. Generate embeddings ONLY for new/changed chunks
  let indexedCount = 0;
  for (const chunk of chunksToEmbed) {
    try {
      const embedding = await generateEmbedding(chunk.content);

      await supabase.from("document_embeddings").insert({
        document_id: doc.id,
        content_chunk: chunk.content,
        chunk_hash: chunk.hash,
        embedding,
        metadata: {
          chunk_index: chunk.index,
          source: "incremental-sync",
        },
      });

      indexedCount++;

      // Rate limiting: 4.2s delay between Gemini API calls (15 RPM limit)
      if (indexedCount < chunksToEmbed.length) {
        await new Promise((resolve) => setTimeout(resolve, 4200));
      }
    } catch (error) {
      console.error(`Failed to embed chunk ${chunk.index} of ${filePath}:`, error);
    }
  }

  return {
    document: doc as Document & { version?: number },
    chunksIndexed: indexedCount,
    chunksReused: chunks.length - chunksToEmbed.length, // Chunks that were reused
  };
}
```

**Token Savings Example:**
- Document with 10 sections, updating 1 section
- Before: 10 embedding API calls
- After: 1 embedding API call = **90% token savings**

#### [MODIFY] [email.ts](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/lib/email.ts)

Update approval notification to remove GitHub references:

```diff
export async function sendApprovalNotification(
  proposal: DocumentProposal,
- commit: { sha?: string; url?: string }
) {
  // ... update email template to remove GitHub commit link
- <a href="${commit.url || '#'}" class="button">View Diff on GitHub</a>
+ <p class="info">Changes have been applied to the knowledge base. Previous version preserved in history.</p>

- This action was performed automatically. If incorrect, revert the commit in GitHub.
+ This action was performed automatically. Contact your admin if changes need to be reverted.
}
```

---

### UI Components

#### [MODIFY] [proposals/[id]/page.tsx](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/app/proposals/%5Bid%5D/page.tsx)

Remove GitHub-related UI elements:

```diff
// Remove the GitHub commit link section (around line 270-275):
- View Commit on GitHub →

// Update the confirmation modal text (around line 298):
- This will commit the changes to GitHub. Enter your email to confirm:
+ This will apply the changes to the knowledge base. Enter your email to confirm:

// Update success message (around line 74):
- alert('Proposal approved and committed to GitHub!');
+ alert('Proposal approved and applied to knowledge base!');
```

---

### Files to Delete

#### [DELETE] [github.ts](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/lib/github.ts)

Entire file to be removed - GitHub integration module.

#### [DELETE] [api/github/webhook/route.ts](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/app/api/github/webhook/route.ts)

Entire file to be removed - GitHub webhook handler.

---

### Configuration

#### [MODIFY] [.env.example](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/.env.example)

Remove GitHub section:

```diff
- # =============================================================================
- # GITHUB INTEGRATION (Required for Phase 1)
- # =============================================================================
-
- # GitHub personal access token (fine-grained)
- # Required scopes: Contents (read + write)
- # Create at: https://github.com/settings/tokens?type=beta
- GITHUB_TOKEN=ghp_your-token-here
-
- # GitHub repository details
- GITHUB_OWNER=Montinou
- GITHUB_REPO=quoth-mcp
- GITHUB_BRANCH=main
-
- # GitHub webhook secret for signature verification
- # Generate with: openssl rand -hex 32
- GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
```

Update notes section:

```diff
# Setup Order:
# 1. Set up Supabase project and run migrations
# 2. Get Gemini API key from Google AI Studio
- # 3. Create GitHub fine-grained token
- # 4. Sign up for Resend and verify domain
- # 5. Generate webhook secret
- # 6. Copy this file to .env.local and fill in values
- # 7. Run: npm run dev
+ # 3. Sign up for Resend and verify domain
+ # 4. Copy this file to .env.local and fill in values
+ # 5. Run: npm run dev
```

#### [MODIFY] [package.json](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/package.json)

Remove octokit dependency:

```diff
"dependencies": {
- "octokit": "^4.1.2",
```

---

### Documentation

#### [MODIFY] [CLAUDE.md](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/CLAUDE.md)

Update architecture description to reflect new Genesis flow.

#### [MODIFY] [README.md](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/README.md)

Update setup instructions to remove GitHub configuration.

#### [MODIFY] [WHITEPAPER.md](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/WHITEPAPER.md)

Update to reflect new Supabase-native architecture.

---

## Phase 6: New UI Features

### Knowledge Base Search Page

A new page for users to search their team's vectorized documentation with a rich search experience.

#### [NEW] [knowledge-base/page.tsx](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/app/knowledge-base/page.tsx)

```tsx
/**
 * Knowledge Base Search Page
 * Allows users to search their team's vectorized documentation
 */
'use client';

import { useState } from 'react';
import { Search, FileText, Clock, Tag } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  path: string;
  snippet: string;
  relevance: number;
  type: 'pattern' | 'architecture' | 'contract' | 'meta';
  version: number;
  lastUpdated: string;
}

export default function KnowledgeBasePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge-base/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-2">Knowledge Base</h1>
      <p className="text-muted-foreground mb-8">
        Search your team's documentation using semantic AI-powered search
      </p>

      {/* Search Input */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search documentation... (e.g., 'how to mock dependencies', 'API patterns')"
          className="w-full pl-12 pr-4 py-4 rounded-xl border bg-background 
                     focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 
                     bg-primary text-primary-foreground rounded-lg"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results Grid */}
      <div className="grid gap-4">
        {results.map((result) => (
          <div
            key={result.id}
            onClick={() => setSelectedDoc(result.id)}
            className="p-6 rounded-xl border bg-card hover:shadow-lg 
                       transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <FileText className="text-primary" />
                <div>
                  <h3 className="font-semibold text-lg">{result.title}</h3>
                  <p className="text-sm text-muted-foreground">{result.path}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                  {Math.round(result.relevance * 100)}% match
                </span>
                <span className="px-2 py-1 text-xs rounded-full bg-secondary">
                  v{result.version}
                </span>
              </div>
            </div>
            
            <p className="mt-4 text-muted-foreground line-clamp-2">
              {result.snippet}
            </p>
            
            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Tag size={14} />
                {result.type}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {new Date(result.lastUpdated).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {results.length === 0 && query && !loading && (
        <p className="text-center text-muted-foreground py-12">
          No results found for "{query}"
        </p>
      )}
    </div>
  );
}
```

#### [NEW] [api/knowledge-base/search/route.ts](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/app/api/knowledge-base/search/route.ts)

```typescript
/**
 * Knowledge Base Search API
 * POST /api/knowledge-base/search
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { searchDocuments } from '@/lib/quoth/search';

export async function POST(request: Request) {
  try {
    const authSupabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await authSupabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's project membership
    const { data: membership } = await authSupabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return Response.json({ error: 'No project access' }, { status: 403 });
    }

    const { query } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Query required' }, { status: 400 });
    }

    const results = await searchDocuments(query, membership.project_id);

    return Response.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return Response.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
```

---

### Document Detail Page with History

#### [NEW] [knowledge-base/[id]/page.tsx](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/app/knowledge-base/%5Bid%5D/page.tsx)

```tsx
/**
 * Document Detail Page
 * Shows document content with version history and rollback capability
 */
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, RotateCcw, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface DocumentVersion {
  id: string;
  version: number;
  content: string;
  archivedAt: string;
}

interface DocumentData {
  id: string;
  title: string;
  content: string;
  version: number;
  lastUpdated: string;
  path: string;
  history: DocumentVersion[];
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  useEffect(() => {
    fetchDocument();
  }, [params.id]);

  const fetchDocument = async () => {
    try {
      const res = await fetch(`/api/knowledge-base/${params.id}`);
      const data = await res.json();
      setDoc(data);
    } catch (error) {
      console.error('Failed to fetch document:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (historyId: string) => {
    if (!confirm('Are you sure you want to restore this version?')) return;
    
    setRollbackLoading(true);
    try {
      const res = await fetch(`/api/knowledge-base/${params.id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId }),
      });
      
      if (res.ok) {
        await fetchDocument();
        setViewingVersion(null);
        alert('Version restored successfully');
      }
    } catch (error) {
      console.error('Rollback failed:', error);
      alert('Failed to restore version');
    } finally {
      setRollbackLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!doc) return <div className="p-8">Document not found</div>;

  const displayContent = viewingVersion 
    ? doc.history.find(h => h.version === viewingVersion)?.content || doc.content
    : doc.content;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={18} />
        Back to Search
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{doc.title}</h1>
          <p className="text-muted-foreground">{doc.path}</p>
        </div>
        
        {/* Version Badge */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
            Version {viewingVersion || doc.version}
          </span>
          {viewingVersion && (
            <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-600">
              Viewing History
            </span>
          )}
        </div>
      </div>

      {/* History Toggle */}
      <div className="mb-6">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-secondary"
        >
          <Clock size={18} />
          Version History ({doc.history.length} versions)
          <ChevronDown className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
        </button>

        {showHistory && doc.history.length > 0 && (
          <div className="mt-4 border rounded-xl overflow-hidden">
            {doc.history.map((version) => (
              <div
                key={version.id}
                className={`flex items-center justify-between p-4 border-b last:border-b-0
                           ${viewingVersion === version.version ? 'bg-primary/5' : 'hover:bg-secondary/50'}`}
              >
                <div>
                  <span className="font-medium">Version {version.version}</span>
                  <span className="text-muted-foreground ml-4">
                    {new Date(version.archivedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingVersion(
                      viewingVersion === version.version ? null : version.version
                    )}
                    className="px-3 py-1 text-sm rounded-lg border hover:bg-secondary"
                  >
                    {viewingVersion === version.version ? 'Hide' : 'View'}
                  </button>
                  <button
                    onClick={() => handleRollback(version.id)}
                    disabled={rollbackLoading}
                    className="px-3 py-1 text-sm rounded-lg bg-primary text-primary-foreground 
                               hover:bg-primary/90 flex items-center gap-1"
                  >
                    <RotateCcw size={14} />
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document Content */}
      <article className="prose prose-neutral dark:prose-invert max-w-none">
        <ReactMarkdown>{displayContent}</ReactMarkdown>
      </article>
    </div>
  );
}
```

---

### API Routes for Document Detail & Rollback

#### [NEW] [api/knowledge-base/[id]/route.ts](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/app/api/knowledge-base/%5Bid%5D/route.ts)

```typescript
/**
 * Document Detail API
 * GET /api/knowledge-base/:id - Get document with history
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authSupabase = await createServerSupabaseClient();
    
    const { data: { user }, error: authError } = await authSupabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify user has access to this project
    const { data: membership } = await authSupabase
      .from('project_members')
      .select('role')
      .eq('project_id', doc.project_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get version history
    const { data: history } = await supabase
      .from('document_history')
      .select('id, version, content, archived_at')
      .eq('document_id', id)
      .order('version', { ascending: false });

    return Response.json({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      version: doc.version,
      lastUpdated: doc.last_updated,
      path: doc.file_path,
      history: (history || []).map(h => ({
        id: h.id,
        version: h.version,
        content: h.content,
        archivedAt: h.archived_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

#### [NEW] [api/knowledge-base/[id]/rollback/route.ts](file:///Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp/src/app/api/knowledge-base/%5Bid%5D/rollback/route.ts)

```typescript
/**
 * Document Rollback API
 * POST /api/knowledge-base/:id/rollback - Restore a previous version
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabase } from '@/lib/supabase';
import { syncDocument } from '@/lib/sync';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authSupabase = await createServerSupabaseClient();
    
    const { data: { user }, error: authError } = await authSupabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { historyId } = await request.json();

    // Get document and verify admin access
    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (!doc) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    const { data: membership } = await authSupabase
      .from('project_members')
      .select('role')
      .eq('project_id', doc.project_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return Response.json({ error: 'Only admins can rollback' }, { status: 403 });
    }

    // Get the history version
    const { data: historyVersion } = await supabase
      .from('document_history')
      .select('content, title')
      .eq('id', historyId)
      .eq('document_id', id)
      .single();

    if (!historyVersion) {
      return Response.json({ error: 'History version not found' }, { status: 404 });
    }

    // Apply rollback (trigger will save current as new history)
    const { document, chunksIndexed } = await syncDocument(
      doc.project_id,
      doc.file_path,
      historyVersion.title,
      historyVersion.content
    );

    return Response.json({
      success: true,
      message: 'Version restored successfully',
      document: {
        id: document.id,
        version: document.version,
        chunksIndexed,
      },
    });
  } catch (error) {
    console.error('Rollback error:', error);
    return Response.json({ error: 'Rollback failed' }, { status: 500 });
  }
}
```

---

### Navigation Update

#### [MODIFY] Navigation Component

Add link to Knowledge Base in the main navigation:

```diff
+ <Link href="/knowledge-base" className="nav-link">
+   <FileText size={18} />
+   Knowledge Base
+ </Link>
```

---

## Verification Plan

### Automated Tests

There are currently no automated tests in the codebase. The verification will rely on manual testing.

### Manual Verification

#### 1. Database Migration Test

**Steps:**
1. Run the new migration against a test Supabase project:
   ```bash
   # Apply migration via Supabase dashboard SQL editor or CLI
   supabase db push
   ```
2. Verify `document_history` table exists
3. Verify `version` column exists on `documents` table
4. Test trigger by updating a document:
   ```sql
   -- First, insert a test document
   INSERT INTO documents (project_id, file_path, title, content, checksum, version)
   VALUES ('<project-uuid>', 'test/trigger.md', 'Trigger Test', 'Version 1', 'abc123', 1);
   
   -- Then update it
   UPDATE documents SET content = 'Version 2' WHERE file_path = 'test/trigger.md';
   
   -- Verify: version should be 2
   SELECT version FROM documents WHERE file_path = 'test/trigger.md';
   
   -- Verify: history should have version 1
   SELECT * FROM document_history WHERE document_id = (
     SELECT id FROM documents WHERE file_path = 'test/trigger.md'
   );
   ```

#### 2. Genesis Tool Test

**Steps:**
1. Start the development server: `npm run dev`
2. Configure MCP client (Claude Code or Cursor) to connect to local server
3. Call the `quoth_genesis` tool via MCP
4. Verify the persona prompt is returned correctly
5. Confirm the AI adopts the Quoth Genesis Architect role and attempts to read local files

#### 3. Proposal Approval Flow Test

**Steps:**
1. Create a test proposal in the dashboard
2. Approve the proposal as an admin user
3. Verify:
   - Document is saved/updated in `documents` table
   - If update, previous version is in `document_history`
   - Embeddings are regenerated in `document_embeddings`
   - Proposal status is `applied`
   - Success message does NOT mention GitHub

#### 4. Build Verification

**Steps:**
```bash
# Verify build succeeds without GitHub module
npm run build

# Check for any remaining GitHub references (should only be in footer link)
grep -r "github" src/ --include="*.ts" --include="*.tsx" | grep -v "Footer.tsx" | grep -v ".d.ts"
```

#### 5. Email Notification Test

**Steps:**
1. Trigger approval flow
2. Check Resend dashboard or email recipient
3. Verify email content does NOT contain GitHub commit links

---

## Implementation Order

1. **Phase 1: Schema (Low Risk)** - Run migration, verify trigger works
2. **Phase 2: Genesis Tool (New Feature)** - Add new tool without breaking existing functionality
3. **Phase 3: Approval Flow (Medium Risk)** - Modify approval to save directly to Supabase
4. **Phase 4: Cleanup (Breaking)** - Remove GitHub files, dependencies, and config
5. **Phase 5: Documentation** - Update all docs to reflect new architecture
6. **Phase 6: UI Features (New Feature)** - Add Knowledge Base search page, document viewer with history, and rollback capability
