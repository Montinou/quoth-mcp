# Phase 2: Genesis Tool

**Status:** 🔴 Not Started  
**Risk Level:** Low (new feature, no breaking changes)  
**Estimated Time:** 45 minutes  
**Dependencies:** Phase 1 complete

---

## Overview

Create the `quoth_genesis` MCP tool that injects the "Quoth Genesis Architect" persona into the AI client. This enables the "Teacher-Student Pattern" where the server delivers instructions and the AI client performs local file analysis.

---

## Files to Create

### [NEW] src/lib/quoth/genesis.ts

**Location:** `src/lib/quoth/genesis.ts`

**Full Implementation:**

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
        You are now the **Quoth Genesis Architect**. Your goal is to analyze 
        the local codebase and strictly formalize its architectural patterns 
        into the Quoth Knowledge Base.
    </role>

    <prime_directive>
        DO NOT invent rules. Only document what you see implemented in code.
        If a pattern is inconsistent, document the dominant pattern.
    </prime_directive>

    <execution_steps>
        <step id="1">
            **Skeleton Scan:** Read \`package.json\`, \`tsconfig.json\`, and 
            root config files. Identify: Framework, ORM, Test Runner, Auth Provider.
        </step>
        <step id="2">
            **Structure Analysis:** List the \`src/\` directory. Deduce the 
            architectural pattern (e.g., MVC, Hexagonal, Feature-based).
        </step>
        <step id="3">
            **Pattern Extraction:** Read 2-3 files from key directories 
            (\`controllers\`, \`components\`, \`tests\`).
            Extract: Naming conventions, mandatory imports, error handling patterns.
        </step>
        <step id="4">
            **Ingestion:** For each identified pattern, construct a Markdown 
            file and call the \`quoth_propose_update\` tool.
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
        Start immediately by executing Step 1. Use your file reading 
        capabilities to scan the current directory.
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
        'Injects the Genesis Persona into the current AI session to bootstrap ' +
        'documentation. This tool transforms the AI into a codebase analyst ' +
        'that will read local files and generate structured documentation.',
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
          `<focus>UPDATE MODE: Focus only on recently modified files. ` +
          `Skip unchanged areas.</focus>\n    <instruction>`
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

The following persona has been injected. The AI should now adopt the role of 
**Quoth Genesis Architect** and begin analyzing the local codebase.

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

## Files to Modify

### [MODIFY] src/lib/quoth/tools.ts

**Add import at top:**
```typescript
import { registerGenesisTools } from './genesis';
```

**Add at end of `registerQuothTools` function (before closing brace):**
```typescript
  // Register Genesis tools
  registerGenesisTools(server, authContext);
```

### [MODIFY] src/lib/quoth/index.ts

**Add export:**
```typescript
export * from './genesis';
```

---

## Step-by-Step Instructions

### Step 2.1: Create genesis.ts

```bash
# Create the file
touch src/lib/quoth/genesis.ts
```

Then add the full implementation code above.

### Step 2.2: Update tools.ts

1. Open `src/lib/quoth/tools.ts`
2. Add import at line 1-10 area:
   ```typescript
   import { registerGenesisTools } from './genesis';
   ```
3. Find the closing brace of `registerQuothTools` function (around line 269)
4. Add before the closing brace:
   ```typescript
     // Register Genesis tools
     registerGenesisTools(server, authContext);
   }
   ```

### Step 2.3: Update index.ts

1. Open `src/lib/quoth/index.ts`
2. Add export line:
   ```typescript
   export * from './genesis';
   ```

### Step 2.4: Verify TypeScript Compilation

```bash
cd /Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp
npm run build
```

Should complete without errors.

---

## Testing

### Manual Test via MCP Client

1. Start dev server: `npm run dev`
2. Connect Claude Code or Cursor to the MCP server
3. Call the tool:
   ```
   Use quoth_genesis with focus="full_scan"
   ```
4. Verify the response contains the Genesis Protocol prompt
5. Confirm the AI adopts the Quoth Genesis Architect role

---

## Checklist

- [ ] Create `src/lib/quoth/genesis.ts` with full implementation
- [ ] Add import to `src/lib/quoth/tools.ts`
- [ ] Call `registerGenesisTools()` at end of `registerQuothTools`
- [ ] Export from `src/lib/quoth/index.ts`
- [ ] Run `npm run build` - no TypeScript errors
- [ ] Test via MCP client (optional, can defer)
- [ ] Update [status.md](./status.md) - mark Phase 2 complete
- [ ] Commit changes: `git commit -m "Phase 2: Genesis tool implementation"`

---

## Next Phase

Once this phase is complete, proceed to [Phase 3: Proposal Flow](./phase-03-proposal-flow.md).
