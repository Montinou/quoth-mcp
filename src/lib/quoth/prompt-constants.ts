/**
 * Quoth Prompt Constants
 * Shared constants for Architect, Auditor, and Genesis prompts
 * Optimized for embedding quality and search relevance
 */

/**
 * Compact embedding rules for prompts
 * Full version in genesis.ts for document creation templates
 */
export const EMBEDDING_RULES_COMPACT = `<embedding_rules>
  <principle>Each H2 section = separate embedding. Must be self-contained.</principle>
  <format>
    1. START bold: "**[Tech] testing** uses..."
    2. INCLUDE 2-3 keywords naturally in first sentence
    3. KEEP 100-150 words per section
    4. ADD aliases: "## Topic (Alias1, Alias2)"
    5. END with: "**Summary:** [tech] for [use case]"
    6. CODE: 2-3 snippets (3-5 lines each)
  </format>
</embedding_rules>`;

/**
 * Trust level interpretation for search results
 * Matches thresholds in tools.ts (lines 62-67)
 */
export const TRUST_LEVEL_GUIDE = `<trust_levels>
  <level name="HIGH" threshold=">80%">Primary source. Follow patterns exactly.</level>
  <level name="MEDIUM" threshold="60-80%">Supporting context. Verify with HIGH sources.</level>
  <level name="LOW" threshold="<60%">Tangentially related. Cross-reference required.</level>
</trust_levels>`;

/**
 * Search query formulation guide for Architect
 * Leverages frontmatter fields from types.ts (keywords, common_queries)
 */
export const SEARCH_QUERY_GUIDE = `<search_optimization>
  <effective_queries>
    - Use specific tech names: "vitest mock" not "testing framework"
    - Include action verbs: "mock database vitest" not "vitest database"
    - Combine stack terms: "typescript async error handling"
  </effective_queries>
  <frontmatter_awareness>
    Documents contain searchable frontmatter:
    - keywords: [term1, term2] - injected into embeddings
    - related_stack: [tech1, tech2] - tech context
    Search using these terms for better matches.
  </frontmatter_awareness>
</search_optimization>`;

/**
 * Shared frontmatter template for document proposals
 * Matches DocumentFrontmatterSchema in types.ts
 */
export const FRONTMATTER_TEMPLATE = `---
id: [category]-[name]
type: [architecture|testing-pattern|contract|meta]
status: active
last_updated_date: [YYYY-MM-DD]
keywords: [3-5 searchable terms for embedding]
related_stack: [tech1, tech2]
---`;

/**
 * Brevity rules for documentation proposals
 * Prevents verbose, hard-to-index documentation
 */
export const PROPOSAL_BREVITY_RULES = `<brevity_rules>
  1. PSEUDO-CODE for boilerplate, not full implementations
  2. SKIP standard language features (async/await, error handling basics)
  3. FOCUS on project-specific constraints and deviations
  4. LINK to existing patterns, never duplicate content
  5. REFERENCE files: \`src/file.ts:45-60\` not full code blocks
</brevity_rules>`;
