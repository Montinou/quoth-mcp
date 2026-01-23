# Quoth Guidelines Optimization Design

**Date:** 2026-01-23
**Status:** Approved
**Goal:** Consolidate 3 personas into 1 adaptive MCP tool, optimize hooks for minimal token usage

---

## Overview

Replace the current 3-persona system (architect, auditor, documenter) with a single adaptive `quoth_guidelines` MCP tool, and simplify hooks to ~60 tokens per session.

### Token Budget Comparison

| Component | Current | Proposed |
|-----------|---------|----------|
| Full personas (MCP) | 6000 tokens (3×2000) | 500 tokens (1×500) |
| Compact guidelines | N/A | 150 tokens |
| Hooks per session | ~750 tokens | ~60 tokens |
| Badge | ~50 tokens | ~30 tokens |

---

## Component 1: MCP Tool - `quoth_guidelines`

### Tool Definition

```typescript
interface QuothGuidelinesInput {
  mode: "code" | "review" | "document";
  full?: boolean; // default: false (compact)
}

interface QuothGuidelinesOutput {
  mode: string;
  rules: string[];
  searchReminder: string;
  suggestedQuery: string;
  templateReminder: string;
  expandable: boolean;
}
```

### Tool Description (shown in MCP index)

```
Get Quoth guidelines for your current task.

STRONGLY RECOMMENDED before writing code, reviewing, or documenting:
1. Call this tool to get guidelines
2. Call quoth_search_index to find relevant patterns
3. Follow documented patterns exactly

Modes:
- "code": Writing/editing code (patterns, anti-patterns)
- "review": Auditing existing code (violations, drift)
- "document": Creating/updating Quoth docs (templates first)
```

### Compact Response (~150 tokens)

```markdown
## Quoth Guidelines: {mode}

**STRONGLY RECOMMENDED:** Call `quoth_search_index` before proceeding.

### Core Rules
1. Search first - `quoth_search_index("{suggestedQuery}")`
2. Trust levels: >80% follow exactly, 60-80% verify, <60% cross-ref
3. Docs = intended design - when code conflicts with docs, docs win
4. Never invent patterns - only use what's documented
5. Templates required - `quoth_get_template` before any Quoth updates

### Anti-Patterns
- Assuming patterns without searching
- Updating docs to match bad code
- Skipping template fetch before doc changes

Full guidelines: `quoth_guidelines({ mode: "{mode}", full: true })`
```

### Full Response (~500 tokens)

Adds to compact:
- Detailed workflow steps per mode
- Trust level examples with percentages
- Template mappings table
- Common search queries by file type
- Badge reporting requirements

### Mode-Specific Additions

**code mode:**
- Suggested query based on file type detection
- Anti-patterns for code generation

**review mode:**
- Violation detection guidelines
- Drift vs new feature distinction
- When to propose updates vs flag violations

**document mode:**
- Template-first workflow
- Embedding rules (H2 = chunk, 75-300 tokens)
- Frontmatter requirements

---

## Component 2: Simplified Hooks

### hooks.json

```json
{
  "hooks": [
    {
      "type": "command",
      "event": "SessionStart",
      "matcher": "startup|resume",
      "command": ["${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh"]
    },
    {
      "type": "command",
      "event": "PreToolUse",
      "matcher": "Edit|Write",
      "command": ["${CLAUDE_PLUGIN_ROOT}/hooks/pre-edit-write.sh"]
    },
    {
      "type": "command",
      "event": "Stop",
      "matcher": ".*",
      "command": ["${CLAUDE_PLUGIN_ROOT}/hooks/stop.sh"]
    }
  ]
}
```

### Hook Outputs

| Hook | Output | Tokens |
|------|--------|--------|
| SessionStart | See below | ~25 |
| PreToolUse | See below | ~15 |
| Stop | See below | ~20 |

**SessionStart:**
```
Quoth MCP active. Strongly recommend `quoth_guidelines('code')` and `quoth_search_index` before writing code.
```

**PreToolUse (Edit|Write):**
```
Quoth patterns available via `quoth_guidelines()` and `quoth_search_index`
```

**Stop:**
```
If you used any quoth_* tools in this response, end with a Quoth Badge:

┌─────────────────────────────────────────────────┐
│ 🪶 Quoth                                        │
│   ✓ [doc path]: [what was applied]              │
└─────────────────────────────────────────────────┘
```

---

## Component 3: Badge Format

### When Quoth tools were used

```
┌─────────────────────────────────────────────────┐
│ 🪶 Quoth                                        │
│   ✓ patterns/testing-pattern.md (vitest mocks) │
│   ✓ patterns/error-handling.md (try-catch)     │
└─────────────────────────────────────────────────┘
```

### When search returned no matches

```
┌─────────────────────────────────────────────────┐
│ 🪶 Quoth: Searched, no matching patterns        │
└─────────────────────────────────────────────────┘
```

### When Quoth not used

No badge. Clean response.

---

## Files to Modify

### New Files

```
src/lib/quoth/guidelines.ts    # Compact/full guidelines content
```

### Modified Files

```
src/lib/quoth/tools.ts         # Add quoth_guidelines tool
quoth-plugin/hooks/hooks.json  # Simplified to 3 hooks
quoth-plugin/hooks/session-start.sh
quoth-plugin/hooks/pre-edit-write.sh  # New merged hook
quoth-plugin/hooks/stop.sh
```

### Files to Remove

```
quoth-plugin/hooks/pre-edit.sh
quoth-plugin/hooks/pre-edit.md
quoth-plugin/hooks/pre-write.sh
quoth-plugin/hooks/pre-write.md
quoth-plugin/hooks/post-edit.sh
quoth-plugin/hooks/post-edit.md
quoth-plugin/hooks/post-write.sh
quoth-plugin/hooks/post-write.md
```

### Optional (can keep as reference)

```
src/lib/quoth/prompts.ts       # Original 3 personas (deprecate or keep)
```

---

## Implementation Order

1. **Create `guidelines.ts`** - New file with compact/full content
2. **Update `tools.ts`** - Add `quoth_guidelines` tool registration
3. **Simplify hooks** - Update hooks.json, merge pre-edit/write, update outputs
4. **Clean up** - Remove deprecated hook files
5. **Test** - Verify MCP tool works, hooks output correctly, badge appears

---

## Success Criteria

- [ ] `quoth_guidelines` tool appears in MCP tool index
- [ ] Compact response is ~150 tokens
- [ ] Full response is ~500 tokens
- [ ] Hooks total ~60 tokens per session
- [ ] Badge displays with 🪶 icon when Quoth tools used
- [ ] No badge when Quoth not used
