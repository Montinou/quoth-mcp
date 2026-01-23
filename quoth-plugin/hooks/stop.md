---
event: Stop
description: Display Quoth Badge summarizing pattern usage
---

# Quoth Stop Hook - Badge Output

## Badge Display

At the end of each response, if Quoth was active during the session:

### Badge Format

```
┌─────────────────────────────────────────┐
│ 🔮 Quoth: ✓ {{patterns_applied}} patterns applied
│          {{#if drift}}⚠ {{drift_count}} potential drift{{/if}}
│          {{#if undocumented}}📝 {{undocumented_count}} undocumented{{/if}}
└─────────────────────────────────────────┘
```

### Conditions for Display

**Show Badge If**:
- showBadge setting is true
- At least one Edit/Write tool was used
- Quoth patterns were searched/applied

**Badge Content**:
- **Patterns Applied**: Count of documented patterns that were followed
- **Potential Drift**: Count of deviations from documented patterns (warning)
- **Undocumented**: Count of new patterns that should be documented

### Examples

**Clean Response (all patterns followed)**:
```
┌─────────────────────────────────────────┐
│ 🔮 Quoth: ✓ 3 patterns applied          │
└─────────────────────────────────────────┘
```

**Response with Warnings**:
```
┌─────────────────────────────────────────┐
│ 🔮 Quoth: ✓ 2 patterns applied          │
│          ⚠ 1 potential drift            │
│          📝 1 undocumented area          │
└─────────────────────────────────────────┘
```

**Expandable Details** (if user asks "show quoth details"):
```
Patterns Applied:
- backend-unit-vitest: Mock pattern used correctly
- error-handling: Try-catch with logging

Potential Drift:
- api-response-format: Response structure differs from documented schema

Undocumented:
- New utility function `parseUserInput` - consider documenting
```

## Token Budget

- Badge: 2-3 lines max (< 50 tokens)
- Details only on user request
