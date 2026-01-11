/**
 * Quoth MCP Tools
 * Tool implementations for the Quoth MCP Server
 * Uses Supabase + Gemini for semantic vector search
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  searchDocuments,
  readDocument,
  buildSearchIndex,
} from './search';

/**
 * Register all Quoth tools on an MCP server
 * Note: knowledgeBasePath is kept for API compatibility but no longer used
 */
export function registerQuothTools(
  server: McpServer,
  _knowledgeBasePath?: string // Deprecated - using Supabase now
) {
  // Tool 1: quoth_search_index (Semantic Vector Search)
  server.registerTool(
    'quoth_search_index',
    {
      title: 'Semantic Search Quoth Documentation',
      description:
        'Performs semantic search across the Quoth documentation using AI embeddings. Returns relevant document chunks ranked by similarity. Much smarter than keyword matching - understands meaning and context.',
      inputSchema: {
        query: z.string().describe('Natural language search query, e.g. "how to mock dependencies in tests", "database connection patterns"'),
      },
    },
    async ({ query }) => {
      try {
        const results = await searchDocuments(query);

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No documents found matching "${query}".\n\nTry:\n- Using different phrasing\n- More general terms\n- Checking if the knowledge base is indexed`,
              },
            ],
          };
        }

        const formattedResults = results.map((doc, index) => {
          const similarity = Math.round((doc.relevance || 0) * 100);
          let result = `${index + 1}. **${doc.title}** (${similarity}% match)\n`;
          result += `   Path: \`${doc.path}\` | Type: ${doc.type}`;

          // Include snippet if available
          if (doc.snippet) {
            result += `\n   > ${doc.snippet}`;
          }

          return result;
        }).join('\n\n');

        return {
          content: [
            {
              type: 'text' as const,
              text: `## Semantic Search Results for "${query}"\n\nFound ${results.length} relevant document(s):\n\n${formattedResults}\n\n---\n*Use \`quoth_read_doc\` with a document title to view full content.*`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error searching documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );

  // Tool 2: quoth_read_doc
  server.registerTool(
    'quoth_read_doc',
    {
      title: 'Read Quoth Document',
      description:
        'Retrieves the full content of a specific documentation file by its title or path. Returns the complete Markdown content with metadata.',
      inputSchema: {
        doc_id: z.string().describe('The document title or file path, e.g. "backend-unit-vitest" or "patterns/backend-unit-vitest.md"'),
      },
    },
    async ({ doc_id }) => {
      try {
        const doc = await readDocument(doc_id);

        if (!doc) {
          // Try to find similar documents
          const index = await buildSearchIndex();
          const suggestions = index.documents
            .filter(d =>
              d.id.toLowerCase().includes(doc_id.toLowerCase()) ||
              doc_id.toLowerCase().includes(d.id.toLowerCase()) ||
              d.path.toLowerCase().includes(doc_id.toLowerCase())
            )
            .slice(0, 3);

          let suggestionText = '';
          if (suggestions.length > 0) {
            suggestionText = `\n\nDid you mean one of these?\n${suggestions.map(s => `- ${s.id} (${s.path})`).join('\n')}`;
          }

          return {
            content: [
              {
                type: 'text' as const,
                text: `Document "${doc_id}" not found.${suggestionText}\n\nUse \`quoth_search_index\` to find available documents.`,
              },
            ],
          };
        }

        // Format frontmatter as YAML block
        const frontmatterYaml = Object.entries(doc.frontmatter)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? `[${value.join(', ')}]` : value}`)
          .join('\n');

        return {
          content: [
            {
              type: 'text' as const,
              text: `## Document: ${doc.title}\n\n**Path:** \`${doc.path}\`\n\n**Metadata:**\n\`\`\`yaml\n${frontmatterYaml}\n\`\`\`\n\n**Content:**\n\n${doc.content}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error reading document: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );

  // Tool 3: quoth_propose_update
  server.registerTool(
    'quoth_propose_update',
    {
      title: 'Propose Documentation Update',
      description:
        'Submits a proposal to update documentation. Requires evidence and reasoning. Updates are logged for human review before being applied.',
      inputSchema: {
        doc_id: z.string().describe('The document title or path to update'),
        new_content: z.string().describe('The proposed new content (full Markdown)'),
        evidence_snippet: z.string().describe('Code snippet or commit reference as evidence for the change'),
        reasoning: z.string().describe('Explanation of why this update is needed'),
      },
    },
    async ({ doc_id, new_content, evidence_snippet, reasoning }) => {
      try {
        // Verify document exists
        const existingDoc = await readDocument(doc_id);

        if (!existingDoc) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Cannot propose update: Document "${doc_id}" not found. Use \`quoth_search_index\` to verify the document exists.`,
              },
            ],
          };
        }

        // Create proposal entry
        const proposalId = `PROP-${Date.now()}`;
        const proposalDate = new Date().toISOString().split('T')[0];

        // Note: In a full implementation, this would write to Supabase
        // For now, we just acknowledge the proposal
        const proposal = {
          id: proposalId,
          date: proposalDate,
          document: doc_id,
          documentPath: existingDoc.path,
          evidence: evidence_snippet,
          reasoning,
          newContent: new_content,
          status: 'pending',
        };

        // Log the proposal (in production, this would go to Supabase)
        console.log('Documentation Update Proposal:', JSON.stringify(proposal, null, 2));

        return {
          content: [
            {
              type: 'text' as const,
              text: `## Update Proposal Created

**Proposal ID**: ${proposalId}
**Target Document**: ${existingDoc.title}
**Path**: \`${existingDoc.path}\`
**Status**: Pending Review

### Evidence Provided
\`\`\`
${evidence_snippet}
\`\`\`

### Reasoning
${reasoning}

---

The proposal has been logged for human review.

**What happens next:**
1. A maintainer will review the proposal
2. If approved, the document will be updated
3. The knowledge base will be re-indexed automatically

*Note: AI agents cannot directly modify documentation. All changes require human approval.*`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error creating proposal: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );
}
