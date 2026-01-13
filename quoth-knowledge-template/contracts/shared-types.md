---
id: contracts-shared-types
type: contract
status: active
last_updated_date: "2026-01-13"
keywords: [typescript, types, interfaces, dto, utility-types, branded-types, result-pattern, generics]
related_stack: [typescript, node, react]
---
# Shared TypeScript Types (Aliases: Common Types, Type Definitions, DTOs)

## What This Covers (Also: Overview, Introduction)
**Shared TypeScript types** define common interfaces, utility types, and DTOs used across the codebase. This pattern applies when creating reusable type definitions, implementing the Result pattern, and using branded types for type-safe IDs. Key terms: utility types, Result pattern, branded types, DTOs.
**Summary:** Shared TypeScript type patterns for codebase consistency.

## Utility Types (Also: Type Helpers, Generic Types)
**Utility type patterns** extend TypeScript's built-in types:

```typescript
// Make specific properties required
type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

// Make all properties nullable
type Nullable<T> = { [P in keyof T]: T[P] | null };
```

This **TypeScript utility pattern** provides type transformations:
```typescript
// Extract array element type
type ArrayElement<T> = T extends (infer U)[] ? U : never;

// Async function return type
type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> =
  T extends (...args: unknown[]) => Promise<infer R> ? R : never;
```

**Summary:** TypeScript utility types for common type transformations.
Reference: `src/types/` (type definitions)

## Result Type Pattern (Also: Error Handling, Either Pattern)
**Result type pattern** provides type-safe error handling without exceptions:

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

This **Result pattern** enables explicit error handling:
```typescript
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return { ok: false, error: 'Division by zero' };
  }
  return { ok: true, value: a / b };
}

// Usage with type narrowing
const result = divide(10, 2);
if (result.ok) {
  console.log(result.value); // TypeScript knows value exists
}
```

**Summary:** Result type pattern for type-safe error handling without exceptions.

## Common DTOs (Also: Data Transfer Objects, API Types)
**DTO patterns** define shapes for data exchange:

```typescript
interface UserDTO {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface CreateUserDTO {
  email: string;
  name: string;
  password: string;
}
```

This **DTO pattern** separates API contracts from internal models:
```typescript
interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

**Summary:** DTO patterns for type-safe API data transfer.

## Branding Pattern (Also: Nominal Types, Type-Safe IDs)
**Branded type pattern** creates nominally distinct types:

```typescript
type Brand<T, B> = T & { __brand: B };

type UserId = Brand<string, 'UserId'>;
type OrganizationId = Brand<string, 'OrganizationId'>;
```

This **branded type pattern** prevents ID mixing at compile time:
```typescript
// Factory functions for creating branded IDs
const createUserId = (id: string): UserId => id as UserId;
const createOrgId = (id: string): OrganizationId => id as OrganizationId;

// Compile-time safety - can't mix IDs
function getUser(userId: UserId) { /* ... */ }
getUser(createOrgId('123')); // ❌ TypeScript error!
```

**Summary:** Branded types for compile-time ID safety.

## Common Questions (FAQ)
- **How do I make properties required in a type?** Use `WithRequired<T, 'prop1' | 'prop2'>` utility type.
- **What is the Result pattern for?** Type-safe error handling—check `result.ok` to narrow to success or error type.
- **How do I create type-safe IDs?** Use branded types: `type UserId = Brand<string, 'UserId'>` with factory function.
- **Where should shared types be defined?** In `src/types/` directory, exported from index.ts for centralized imports.
- **When should I use DTOs vs domain models?** DTOs for API boundaries (serializable), domain models for internal logic (may have methods).

## Anti-Patterns (Never Do This)
- **Using `any` type**: Use `unknown` for truly unknown types—`any` defeats type safety completely.
- **Type assertions without validation**: `as T` without runtime checks is unsafe—use Zod or type guards.
- **Using `object` type**: Too permissive—use `Record<string, unknown>` or specific interface.
- **Mixing branded IDs accidentally**: Always use factory functions—raw cast loses type safety.
- **Exporting internal types from DTOs**: DTOs are contracts—don't expose implementation details.

**Summary:** Avoid any type and always validate before type assertions.
