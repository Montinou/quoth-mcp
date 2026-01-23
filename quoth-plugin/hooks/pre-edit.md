---
event: PreToolUse
tool: Edit
description: Inject relevant patterns before editing code
---

# Quoth PreToolUse Hook (Edit)

## Pattern Injection

Before editing `{{tool.file_path}}`:

1. **Extract Context**: Identify the file type and purpose
   - Component: `*.tsx`, `*.jsx`
   - API route: `*/api/*`, `*/route.ts`
   - Test file: `*.test.*`, `*.spec.*`
   - Service/util: `*/lib/*`, `*/utils/*`

2. **Search Quoth**: Call `quoth_search_index` with contextual query:
   - For components: "component patterns {{file_name}}"
   - For API: "api endpoint patterns"
   - For tests: "testing patterns {{test_framework}}"
   - For services: "service patterns {{domain}}"

3. **Inject Patterns**: If relevant patterns found (relevance > 0.6):

```
<quoth_patterns file="{{file_path}}" count="{{pattern_count}}">
  {{#each patterns}}
  - {{title}}: {{one_line_summary}}
  {{/each}}
</quoth_patterns>
```

4. **Skip Injection If**:
   - No relevant patterns (relevance < 0.6)
   - File is config/generated (package.json, *.lock, *.generated.*)
   - autoInjectPatterns setting is false

## Token Budget

- Maximum 100 tokens for pattern injection
- Only include pattern names and 1-line summaries
- Let Claude call `quoth_read_doc` if it needs full details
