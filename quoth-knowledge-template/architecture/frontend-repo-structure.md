---
id: arch-frontend-structure
type: architecture
status: active
last_updated_date: "2026-01-13"
keywords: [nextjs, app-router, frontend, folder-structure, react, server-components, client-components, layout]
related_stack: [nextjs, react, typescript, tailwind]
---
# Frontend Repository Structure: Next.js App Router (Aliases: Folder Layout, Directory Organization, Project Structure)

## What This Covers (Also: Overview, Introduction)
**Next.js App Router structure** defines the standard folder layout for React applications using Next.js 16+. This architecture applies to all frontend projects using Server Components, route groups, and the App Router conventions. Key terms: app directory, layout.tsx, page.tsx, route groups, Server Components.
**Summary:** Next.js App Router folder structure for modern React applications.

## Folder Structure (Also: Directory Layout, Project Organization)
**Next.js App Router structure** organizes code by feature and route hierarchy:

```
/src
├── /app                  # App Router pages & layouts
│   ├── /api             # API routes
│   ├── /(auth)          # Auth route group
│   ├── /(dashboard)     # Dashboard route group
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page
```

This **App Router pattern** uses route groups `(groupName)` for organization without affecting URLs:
```
├── /components          # Reusable UI components
│   ├── /ui              # Primitive components
│   └── /features        # Feature-specific components
├── /lib                 # Utilities and configurations
│   ├── /hooks          # Custom React hooks
│   └── /utils          # Helper functions
```

The **tests directory** separates E2E from unit tests:
```
/tests
├── /e2e                # Playwright E2E tests
│   ├── /pages         # Page Object Models
│   └── /fixtures      # Test fixtures
└── /unit              # Component unit tests
```

**Summary:** Next.js App Router structure with route groups and component separation.
Reference: `/src/app/` (App Router root)

## App Router Conventions (Also: File-Based Routing, Special Files)
**App Router file conventions** define component behavior automatically:

| File | Purpose |
|------|---------|
| `page.tsx` | Page component (creates a route) |
| `layout.tsx` | Shared layout wrapper (persists across child routes) |
| `loading.tsx` | Loading UI (shows during Suspense) |
| `error.tsx` | Error boundary (catches errors in segment) |
| `not-found.tsx` | 404 page (custom not found UI) |

This **file-based routing pattern** reduces configuration and improves discoverability.

**Summary:** Next.js App Router file conventions for automatic route behavior.

## Component Organization (Also: Server vs Client, Component Types)
**Component organization** distinguishes server and client rendering:

- **Server Components**: Default in App Router—use for data fetching, direct database access, and reducing client bundle.
- **Client Components**: Add `'use client'` directive at file top when you need interactivity, hooks, or browser APIs.
- **Shared Components**: Place in `/components/ui` for primitives like Button, Card, Input.

This **Server/Client component pattern** optimizes bundle size and performance.

**Summary:** Server Components by default, Client Components with 'use client' directive.

## Common Questions (FAQ)
- **How do I create a new route in App Router?** Create a folder in `/src/app/` with a `page.tsx` file—the folder path becomes the URL.
- **What is a route group in Next.js?** Folders prefixed with parentheses like `(auth)` group routes without affecting URL paths—use for layouts.
- **When should I use 'use client' directive?** Add it when you need useState, useEffect, onClick handlers, or browser-only APIs like window.
- **Where do I put shared components?** In `/src/components/ui/` for primitives and `/src/components/features/` for feature-specific components.
- **How do I handle loading states?** Add a `loading.tsx` file in the route folder—Next.js shows it automatically during data fetching.

## Anti-Patterns (Never Do This)
- **Putting 'use client' on every component**: Server Components are default for good reason—only use client when necessary.
- **Nesting layouts too deeply**: Causes performance issues—flatten with route groups instead.
- **Importing server-only code in client components**: Causes build errors—use separate files for server and client logic.
- **Skipping loading.tsx for slow routes**: Causes poor UX—always add loading states for data-fetching routes.
- **Using pages directory patterns in App Router**: Different conventions—use App Router patterns like layout.tsx, not _app.tsx.

**Summary:** Avoid excessive client components and respect Server/Client boundaries.
