---
id: pattern-backend-integration
type: testing-pattern
status: active
last_updated_date: "2026-01-13"
keywords: [integration-test, vitest, database, real-db, test-isolation, beforeAll, afterAll, transaction]
related_stack: [vitest, node, database, drizzle]
---
# Backend Integration Testing (Aliases: Database Testing, Real Service Testing, Component Integration)

## What This Covers (Also: Overview, Introduction)
**Backend integration testing** with Vitest verifies that multiple components work together using real database connections. This pattern applies when testing repositories, services with database calls, or API endpoints that persist data. Key terms: test database, beforeAll, afterAll, transaction isolation, cleanup hooks.
**Summary:** Vitest integration testing pattern for real database verification.

## The Pattern (Also: Integration Test Setup, Database Test Strategy, Test Isolation)
**Integration testing** requires a dedicated test database—never use production. Docker-based databases provide consistent, isolated environments:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDatabase, destroyTestDatabase } from './test-utils';
```

For **test isolation**, clean data before each test with `beforeEach`:
```typescript
beforeEach(async () => {
  await db.delete().from('users'); // Clean slate for each test
});
```

This **integration test pattern** ensures reproducible results. Use `beforeAll` for expensive setup and `afterAll` for teardown:
```typescript
beforeAll(async () => await createTestDatabase());
afterAll(async () => await destroyTestDatabase());
```

Mock only **external third-party services**, not internal dependencies—that defeats the purpose of integration testing.

**Summary:** Vitest integration pattern with real database and proper test isolation.
Reference: `tests/integration/` (integration test directory)

## Canonical Example (Also: Code Sample, Implementation Reference)
**Vitest integration testing** a UserRepository with real database operations:

```typescript
describe('UserRepository Integration', () => {
  beforeAll(async () => await createTestDatabase());
  afterAll(async () => await destroyTestDatabase());
  beforeEach(async () => await db.delete().from('users'));
```

The **repository test** verifies actual database persistence:
```typescript
  it('should persist user to database', async () => {
    const repo = new UserRepository(db);
    const user = await repo.create({ name: 'Alice', email: 'alice@example.com' });

    expect(user.id).toBeDefined();
    const found = await repo.findById(user.id);
    expect(found?.name).toBe('Alice');
  });
});
```

**Summary:** Complete integration test example with Vitest and real database.

## Database Testing Utilities (Also: Test Helpers, Setup Functions)
**Test utility functions** centralize database setup and teardown logic:

```typescript
// test-utils.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

export async function createTestDatabase() {
  const testDb = drizzle(process.env.TEST_DATABASE_URL!);
  await migrate(testDb, { migrationsFolder: './drizzle' });
  return testDb;
}
```

This **test utilities pattern** ensures consistent database state across all integration tests.

**Summary:** Centralized test utilities for database setup and migration.

## Common Questions (FAQ)
- **How do I set up a test database for integration tests?** Use `createTestDatabase()` in `beforeAll`, connect to `TEST_DATABASE_URL`, and run migrations with Drizzle.
- **What is test isolation in integration testing?** Each test starts with clean state—use `beforeEach` to delete or truncate tables before each test case.
- **When should I use transactions for test isolation?** Wrap each test in a transaction and rollback after—faster than truncating but requires transaction-aware setup.
- **How do I clean up test data properly?** Use `afterEach` or `afterAll` hooks to delete test data, or use Docker containers that destroy on completion.
- **Where are integration tests located?** In `tests/integration/` directory with `.int.test.ts` suffix to distinguish from unit tests.

## Anti-Patterns (Never Do This)
- **Sharing state between tests without cleanup**: Causes flaky tests—always clean in beforeEach or use transactions.
- **Using production database for tests**: Dangerous and slow—use dedicated TEST_DATABASE_URL with Docker.
- **Mocking database calls in integration tests**: Defeats the purpose—mock only external third-party APIs.
- **Skipping cleanup in afterEach/afterAll hooks**: Leads to data pollution—always implement proper teardown.
- **Running integration tests in parallel without isolation**: Causes race conditions—use separate schemas or transactions.

**Summary:** Avoid shared state and production databases in integration testing.
