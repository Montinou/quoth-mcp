---
event: PreToolUse
tool: Write
description: Inject relevant patterns before writing new files
---

# Quoth PreToolUse Hook (Write)

## Pattern Injection for New Files

Before creating `{{tool.file_path}}`:

1. **Determine File Category**:
   - Same detection logic as Edit hook

2. **Search for Templates**: Call `quoth_search_index`:
   - "template {{category}} new file"
   - "boilerplate {{file_type}}"

3. **Inject Guidance**:

```
<quoth_guidance file="{{file_path}}" type="new_file">
  Relevant patterns for new {{category}} files:
  {{#each patterns}}
  - {{title}}: {{one_line_summary}}
  {{/each}}

  Consider using `quoth_get_template` for structure.
</quoth_guidance>
```

## Skip Injection If

- File is non-code (README, docs, config)
- autoInjectPatterns setting is false
