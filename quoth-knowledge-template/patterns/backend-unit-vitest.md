---
id: pattern-backend-unit
type: testing-pattern
status: active
last_updated_date: "2026-01-13"
keywords: [vitest, unit-test, mock, vi.mock, backend, service, dependency-injection, vi.clearAllMocks]
related_stack: [vitest, node, typescript]
---
# Backend Unit Testing: Vitest Mocking Pattern (Aliases: vi.mock, Service Testing, Dependency Isolation)

## What This Covers (Also: Overview, Introduction)
**Vitest unit testing** for backend services uses `vi.mock()` for dependency isolation. This pattern applies when testing services, controllers, or utilities with external dependencies like databases, APIs, or file systems. Key terms: vi.mock, vi.mocked, vi.clearAllMocks, beforeEach, module-level mocking.
**Summary:** Vitest mocking pattern for backend service isolation.

## The Pattern (Also: Vitest Mocking Approach, vi.mock Setup, Test Isolation)
**Vitest unit testing** requires explicit imports from the vitest package—never rely on globals. Always start with `import { vi, describe, it, expect, beforeEach } from 'vitest'`.

For **external dependency mocking**, declare `vi.mock()` at module level before imports:
```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
vi.mock('./db');
```

This **vi.mock pattern** hoists the mock declaration before other imports. Clear mocks in **beforeEach** to prevent test pollution between test cases:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

For **type-safe mock assertions**, use `vi.mocked()` to wrap the imported module:
```typescript
vi.mocked(db.insert).mockResolvedValue({ id: 1, name: 'Alice' });
```

**Summary:** Vitest vi.mock() pattern for backend service dependency isolation.
Reference: `src/lib/quoth/genesis.ts:1-50` (pattern example)

## Canonical Example (Also: Code Sample, Implementation Reference)
**Vitest mocking** a database dependency in a UserService test demonstrates the complete pattern:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './UserService';
import { db } from './db';

vi.mock('./db'); // Module-level mock - hoisted before imports
```

The **beforeEach setup** ensures clean state for each test:
```typescript
describe('UserService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates user with correct data', async () => {
    vi.mocked(db.insert).mockResolvedValue({ id: 1, name: 'Alice' });
    const user = await UserService.create('Alice');
    expect(user.id).toBe(1);
  });
});
```

**Summary:** Complete vi.mock example for Vitest backend service testing.

## Common Questions (FAQ)
- **How do I mock a database in Vitest?** Use `vi.mock('./db')` at module level before imports, then `vi.mocked(db.query).mockResolvedValue(...)` for return values.
- **What is the vi.mock pattern for backend services?** Module-level mocking with `vi.mock()`, clear state with `vi.clearAllMocks()` in beforeEach, and type-safe assertions with `vi.mocked()`.
- **How do I clear mocks between tests in Vitest?** Call `vi.clearAllMocks()` inside `beforeEach(() => { ... })` to reset all mock state.
- **When should I use vi.mocked vs vi.fn?** Use `vi.mocked()` to wrap existing imports for type-safe assertions; use `vi.fn()` to create new standalone mock functions.
- **Where are Vitest mocks configured?** In test files at module level using `vi.mock('./path')`, with configuration in `vitest.config.ts`.

## Anti-Patterns (Never Do This)
- **Using jest.fn() or jest.mock()**: Vitest uses vi.fn() and vi.mock(), not Jest syntax—causes undefined errors.
- **Global imports without explicit vitest import**: Always `import { vi } from 'vitest'`—globals are unreliable.
- **Forgetting vi.clearAllMocks()**: Causes test pollution and flaky tests—always clear in beforeEach.
- **Using any types in mock returns**: Use proper TypeScript typing with `vi.mocked()`—prevents runtime errors.
- **Placing vi.mock() after imports**: Module mocks must be hoisted before imports—causes mocking to fail.

**Summary:** Avoid Jest syntax and always use Vitest-specific mocking utilities.
