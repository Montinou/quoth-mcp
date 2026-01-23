---
event: PostToolUse
tool: Write
description: Audit new files against documentation
---

# Quoth PostToolUse Hook (Write)

## New File Audit

After creating `{{tool.file_path}}`:

1. **Skip Audit If**:
   - auditEnabled setting is false
   - File is config/generated/docs

2. **Analyze New Code**: Identify patterns used
   - Component structure
   - API design
   - Testing approach

3. **Compare Against Templates**: Check if structure matches
   - Quoth templates
   - Documented conventions

4. **Record for Stop Hook**:

```
<quoth_audit file="{{file_path}}" type="new_file">
  <patterns_followed>
    {{#each followed}}
    - {{pattern_name}}
    {{/each}}
  </patterns_followed>
  <suggestions>
    {{#each suggestions}}
    - {{suggestion}}
    {{/each}}
  </suggestions>
</quoth_audit>
```
