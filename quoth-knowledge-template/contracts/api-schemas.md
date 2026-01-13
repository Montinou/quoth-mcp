---
id: contracts-api-schemas
type: contract
status: active
last_updated_date: "2026-01-13"
keywords: [api, schema, zod, validation, response, pagination, error-codes, request-validation, typescript]
related_stack: [zod, typescript, node, nextjs]
---
# API Schemas & Contracts (Aliases: API Validation, Request/Response Types, Zod Schemas)

## What This Covers (Also: Overview, Introduction)
**API schema contracts** define standard request and response structures using Zod for runtime validation. This pattern applies to all REST and RPC endpoints requiring type-safe validation, consistent error handling, and pagination. Key terms: Zod schema, ApiResponse, PaginationSchema, error codes.
**Summary:** Zod-based API schema contracts for type-safe validation.

## Base Response Schema (Also: API Response, Standard Response)
**API response schemas** ensure consistent structure across all endpoints:

```typescript
import { z } from 'zod';

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string()).optional(),
  }).optional(),
```

This **Zod validation pattern** provides runtime type checking with TypeScript inference:
```typescript
  meta: z.object({
    requestId: z.string(),
    timestamp: z.string().datetime(),
  }),
});
```

The **discriminated union type** separates success and error responses:
```typescript
type ApiResponse<T> = {
  success: true;
  data: T;
  meta: { requestId: string; timestamp: string };
} | {
  success: false;
  error: { code: string; message: string; details?: Record<string, string> };
  meta: { requestId: string; timestamp: string };
};
```

**Summary:** Zod ApiResponseSchema for consistent API response validation.
Reference: `src/lib/schemas/` (schema definitions)

## Pagination Schema (Also: List Response, Paginated Data)
**Pagination schemas** standardize list endpoints with sorting and limits:

```typescript
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
```

This **pagination pattern** pairs with response metadata:
```typescript
export const PaginatedResponseSchema = z.object({
  items: z.array(z.unknown()),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});
```

**Summary:** Zod PaginationSchema for standardized list endpoints with sorting.

## Error Codes (Also: API Errors, HTTP Status Codes)
**Error code mapping** provides consistent error handling:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data—check input format |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | Valid auth but insufficient permissions |
| `NOT_FOUND` | 404 | Requested resource does not exist |
| `CONFLICT` | 409 | Resource conflict (duplicate, version mismatch) |
| `INTERNAL_ERROR` | 500 | Server error—check logs for details |

This **error code pattern** enables consistent client-side error handling.

**Summary:** Standard error codes for predictable API error responses.

## Common Questions (FAQ)
- **How do I validate API requests with Zod?** Use `schema.parse(request.body)` which throws on invalid data, or `schema.safeParse()` for error handling.
- **What is the ApiResponse type for?** Type-safe discriminated union—check `response.success` to narrow type to data or error.
- **How do I add pagination to an endpoint?** Parse query params with `PaginationSchema`, return `PaginatedResponseSchema` with items and pagination metadata.
- **Where should I define custom schemas?** In `src/lib/schemas/` directory, exported from index.ts for centralized imports.
- **How do I handle validation errors?** Catch Zod errors and return `{ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } }`.

## Anti-Patterns (Never Do This)
- **Skipping runtime validation**: TypeScript types alone don't validate runtime data—always use Zod.parse() for external input.
- **Inconsistent error response shapes**: All errors must follow ApiResponse schema—don't return raw strings or custom formats.
- **Exposing internal errors to clients**: Map internal errors to standard codes—never expose stack traces in production.
- **Hard-coding pagination limits**: Use schema defaults—allow clients to request smaller pages for performance.
- **Using any type in schemas**: Defeats type safety—use z.unknown() with refinements or specific types.

**Summary:** Always validate external input with Zod and return consistent error responses.
