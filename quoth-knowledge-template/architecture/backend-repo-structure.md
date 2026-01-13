---
id: arch-backend-structure
type: architecture
status: active
last_updated_date: "2026-01-13"
keywords: [backend, repository-structure, folder-layout, naming-conventions, layered-architecture, api, services, repositories]
related_stack: [node, typescript, express, drizzle]
---
# Backend Repository Structure (Aliases: Folder Layout, Directory Organization, Project Structure)

## What This Covers (Also: Overview, Introduction)
**Backend repository structure** defines the standard folder layout for Node.js/TypeScript services. This architecture applies to all backend projects using layered separation (API → Services → Repositories → Models). Key terms: src directory, tests folder, naming conventions, layer responsibilities.
**Summary:** Standard backend folder structure for layered Node.js architecture.

## Folder Structure (Also: Directory Layout, Project Organization)
**Backend folder structure** keeps depth ≤ 3 levels for AI token efficiency and developer navigation:

```
/src
├── /api              # API route handlers
│   ├── /v1           # Versioned endpoints
│   └── middleware.ts # Request middleware
├── /services         # Business logic layer
├── /repositories     # Data access layer
```

This **layered architecture pattern** separates concerns clearly:
```
├── /models           # Database models/schemas
├── /utils            # Shared utilities
├── /config           # Environment configuration
└── index.ts          # Application entry point
```

The **tests directory** mirrors the src structure:
```
/tests
├── /unit             # Unit tests (*.test.ts)
├── /integration      # Integration tests (*.int.test.ts)
└── /fixtures         # Test data fixtures
```

**Summary:** Layered backend structure with separate src and tests directories.
Reference: `/src/` (source code root)

## Naming Conventions (Also: File Naming, Code Style, Identifier Patterns)
**Naming conventions** ensure consistency across the codebase:

| Type | Convention | Example |
|------|------------|---------|
| Files | camelCase | `userService.ts` |
| Classes | PascalCase | `UserService` |
| Functions | camelCase | `createUser()` |
| Constants | UPPER_SNAKE | `MAX_RETRIES` |
| Types/Interfaces | PascalCase | `UserDTO` |

This **naming pattern** makes code predictable and searchable across the repository.

**Summary:** Consistent naming conventions for backend TypeScript projects.

## Layer Responsibilities (Also: Separation of Concerns, Architecture Layers)
**Layer responsibilities** define what each directory handles:

- **API** (`/api`): HTTP handling, request validation, response formatting—no business logic.
- **Services** (`/services`): Business logic, orchestration, transaction management—core domain.
- **Repositories** (`/repositories`): Database operations, queries, data mapping—persistence only.
- **Models** (`/models`): Schema definitions, type exports, entity definitions—shared types.

This **separation of concerns pattern** ensures testability and maintainability.

**Summary:** Clear layer responsibilities for maintainable backend architecture.

## Common Questions (FAQ)
- **How deep should folder nesting be?** Maximum 3 levels for AI token efficiency—flatten deep hierarchies with index exports.
- **Where do I put API route handlers?** In `/src/api/v1/` with versioned endpoints, keeping route definitions thin and delegating to services.
- **What is the difference between services and repositories?** Services contain business logic and orchestration; repositories handle only database operations.
- **How do I organize test files?** Mirror src structure in `/tests/` with `.test.ts` for unit and `.int.test.ts` for integration tests.
- **Where is environment configuration stored?** In `/src/config/` with typed config objects that validate required environment variables.

## Anti-Patterns (Never Do This)
- **Putting business logic in API handlers**: API layer should only handle HTTP—delegate to services for logic.
- **Deep nesting beyond 3 levels**: Reduces AI context efficiency—flatten with index files and re-exports.
- **Mixing test types in same directory**: Separate unit and integration tests—they have different setup needs.
- **Skipping the repository layer**: Direct database calls in services reduce testability—always abstract data access.
- **Using default exports**: Named exports enable better tree-shaking and IDE autocomplete—prefer named exports.

**Summary:** Avoid deep nesting and keep clear separation between architectural layers.
