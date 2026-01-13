---
id: contracts-database-models
type: contract
status: active
last_updated_date: "2026-01-13"
keywords: [database, drizzle, orm, schema, postgresql, model, table, relationships, soft-delete, timestamps]
related_stack: [drizzle, postgresql, typescript, node]
---
# Database Models (Aliases: Schema Definitions, Drizzle Tables, Data Layer Contracts)

## What This Covers (Also: Overview, Introduction)
**Database model patterns** define standard table structures using Drizzle ORM for PostgreSQL. This pattern applies when creating tables, defining relationships, implementing soft deletes, and following naming conventions. Key terms: pgTable, timestamps, foreign keys, soft delete, many-to-many.
**Summary:** Drizzle ORM database model patterns for PostgreSQL schemas.

## Base Model Fields (Also: Standard Columns, Timestamp Pattern)
**Database model fields** include standard timestamps on every table:

```typescript
import { pgTable, uuid, timestamp, varchar } from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
};
```

This **Drizzle timestamp pattern** ensures audit trails across all tables:
```typescript
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  ...timestamps,
});
```

**Summary:** Drizzle timestamp pattern with createdAt and updatedAt on all tables.
Reference: `src/db/schema/` (schema definitions)

## Soft Delete Pattern (Also: Logical Delete, Archive Pattern)
**Soft delete pattern** preserves data while marking records as deleted:

```typescript
const softDelete = {
  deletedAt: timestamp('deleted_at'),
};
```

This **Drizzle soft delete pattern** uses null checks for active records:
```typescript
// Query helper for filtering deleted records
const whereNotDeleted = { deletedAt: null };

// Usage in queries
const activeUsers = await db.select()
  .from(users)
  .where(isNull(users.deletedAt));
```

**Summary:** Soft delete pattern using deletedAt timestamp for data preservation.

## Relationship Patterns (Also: Foreign Keys, Joins, Associations)

### One-to-Many (Also: Parent-Child, HasMany)
**One-to-many relationships** use foreign key references:

```typescript
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id),
});
```

This **Drizzle relationship pattern** enables typed joins.

### Many-to-Many (Also: Junction Table, Join Table)
**Many-to-many relationships** require junction tables with composite primary keys:

```typescript
export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').references(() => users.id),
  roleId: uuid('role_id').references(() => roles.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] }),
}));
```

**Summary:** Drizzle relationship patterns for one-to-many and many-to-many associations.

## Naming Conventions (Also: Database Naming, Column Names)
**Database naming conventions** ensure consistency:

| Type | Convention | Example |
|------|------------|---------|
| Tables | snake_case (plural) | `user_roles` |
| Columns | snake_case | `created_at` |
| Indexes | `idx_table_column` | `idx_users_email` |
| Foreign Keys | `fk_table_ref` | `fk_users_org` |

This **naming pattern** aligns with PostgreSQL conventions.

**Summary:** snake_case naming conventions for PostgreSQL compatibility.

## Common Questions (FAQ)
- **How do I add timestamps to a table?** Spread the `timestamps` object into your pgTable definition: `{ ...timestamps }`.
- **What is soft delete in Drizzle?** Add `deletedAt: timestamp('deleted_at')` and filter with `where(isNull(deletedAt))` in queries.
- **How do I create a foreign key reference?** Use `.references(() => parentTable.id)` on the column definition.
- **Where should I define database schemas?** In `src/db/schema/` with one file per domain, exported from index.ts.
- **How do I create a junction table for many-to-many?** Define both foreign keys and use `primaryKey({ columns: [...] })` in the table config.

## Anti-Patterns (Never Do This)
- **Skipping timestamps on tables**: Audit trails are essential—always include createdAt and updatedAt.
- **Using camelCase for database columns**: PostgreSQL convention is snake_case—mismatch causes query issues.
- **Hard deleting user data**: Use soft delete for compliance—preserve deletedAt for recovery.
- **Missing indexes on foreign keys**: Causes slow joins—always index foreign key columns.
- **Using serial IDs instead of UUIDs**: UUIDs are more secure and distributed-friendly—prefer uuid().defaultRandom().

**Summary:** Avoid hard deletes and always use snake_case naming in database schemas.
