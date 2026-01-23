---
event: PostToolUse
tool: Edit
description: Audit edited code against documentation
---

# Quoth PostToolUse Hook (Edit)

## Code Audit

After editing `{{tool.file_path}}`:

1. **Skip Audit If**:
   - auditEnabled setting is false
   - File is config/generated
   - Edit was minor (< 5 lines changed)

2. **Extract Key Changes**: Identify what was modified
   - New functions/methods
   - Changed patterns
   - Modified interfaces

3. **Compare Against Docs**: For each significant change:
   - Search Quoth for related patterns
   - Check if change aligns with documented patterns

4. **Record Findings** (internal state for Stop hook):

```
<quoth_audit file="{{file_path}}">
  <patterns_applied>
    {{#each applied}}
    - {{pattern_name}}: Applied correctly
    {{/each}}
  </patterns_applied>
  <potential_drift>
    {{#each drift}}
    - {{pattern_name}}: {{deviation_description}}
    {{/each}}
  </potential_drift>
  <undocumented>
    {{#each new_patterns}}
    - {{description}}: Consider documenting
    {{/each}}
  </undocumented>
</quoth_audit>
```

## Token Efficiency

- Do NOT output audit results immediately
- Store in session state for Stop hook aggregation
- Only flag critical drift immediately
