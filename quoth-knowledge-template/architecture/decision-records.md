---
id: arch-decision-records
type: architecture
status: active
last_updated_date: "2026-01-13"
keywords: [adr, architecture-decision-record, decision, documentation, nextjs, vitest, playwright, technical-decisions]
related_stack: [nextjs, vitest, playwright, typescript]
---
# Architecture Decision Records (Aliases: ADRs, Technical Decisions, Decision Log)

## What This Covers (Also: Overview, Introduction)
**Architecture Decision Records (ADRs)** document significant technical decisions with context, rationale, and consequences. This pattern applies when making framework choices, library selections, or architectural changes that affect the entire codebase. Key terms: ADR template, decision status, context, consequences.
**Summary:** ADR pattern for documenting architectural decisions with full context.

## ADR Template (Also: Decision Format, Documentation Structure)
**ADR documentation** follows a standard format for consistency across all decisions:

```markdown
# ADR-XXX: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
[Why is this decision needed? What problem are we solving?]

## Decision
[What was decided? Be specific about the choice made.]

## Consequences
[What are the positive and negative outcomes?]
```

This **ADR template pattern** ensures decisions are traceable and future developers understand the "why" behind choices.

**Summary:** Standard ADR format with Status, Context, Decision, and Consequences sections.
Reference: `.claude/docs/` (ADR storage location)

## Active Decisions (Also: Current ADRs, Accepted Choices)

### ADR-001: Use Next.js App Router (Also: Framework Choice)
**Next.js App Router decision** was made for modern React SSR/SSG support:

**Status**: Accepted
**Context**: Need modern React framework with Server Components and edge runtime support
**Decision**: Use Next.js 16+ with App Router instead of Pages Router
**Consequences**:
- ✅ Better performance with React Server Components
- ✅ Simplified data fetching with async components
- ⚠️ Learning curve for team familiar with Pages Router

**Summary:** Next.js App Router for server-first React architecture.

### ADR-002: Vitest for Backend Testing (Also: Test Runner Choice)
**Vitest testing framework decision** was made for ESM-native fast testing:

**Status**: Accepted
**Context**: Need fast, ESM-native test runner compatible with TypeScript
**Decision**: Use Vitest instead of Jest for all backend testing
**Consequences**:
- ✅ Native ESM support without configuration hacks
- ✅ Faster execution with concurrent test runs
- ⚠️ Some Jest patterns (like `jest.mock`) use different syntax (`vi.mock`)

**Summary:** Vitest for ESM-native backend testing with vi.mock syntax.

### ADR-003: Playwright for E2E Testing (Also: E2E Framework Choice)
**Playwright E2E testing decision** was made for cross-browser reliability:

**Status**: Accepted
**Context**: Need reliable cross-browser E2E testing with TypeScript support
**Decision**: Use Playwright over Cypress for all E2E tests
**Consequences**:
- ✅ Better multi-browser support (Chrome, Firefox, Safari, Edge)
- ✅ Faster parallel execution across browsers
- ✅ Better TypeScript integration and codegen tools

**Summary:** Playwright for cross-browser E2E testing with accessible locators.

## Common Questions (FAQ)
- **When should I create an ADR?** When making decisions that affect the whole codebase—framework choices, library selections, architectural patterns.
- **What is the ADR status lifecycle?** Proposed → Accepted (or Rejected) → potentially Deprecated or Superseded by newer ADR.
- **Where are ADRs stored?** In `.claude/docs/` directory with filenames like `ADR-001-nextjs-app-router.md`.
- **How do I supersede an existing ADR?** Create new ADR referencing the old one, set old ADR status to "Superseded by ADR-XXX".
- **Who approves ADRs?** Team leads or architects review Proposed ADRs before moving to Accepted status.

## Anti-Patterns (Never Do This)
- **Making major decisions without an ADR**: Future developers lose context—always document framework and library choices.
- **Skipping the Context section**: "What" without "why" is useless—always explain the problem being solved.
- **Not updating ADR status**: Stale decisions confuse teams—mark deprecated or superseded when relevant.
- **Writing ADRs after implementation**: Loses decision rationale—write ADR before or during implementation.
- **Making ADRs too detailed**: ADRs capture decisions, not implementation—link to code for specifics.

**Summary:** Always document architectural decisions with full context and consequences.
