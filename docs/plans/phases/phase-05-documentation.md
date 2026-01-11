# Phase 5: Documentation Updates

**Status:** 🔴 Not Started  
**Risk Level:** Low  
**Estimated Time:** 30 minutes  
**Dependencies:** Phase 4 complete

---

## Overview

Update all documentation files to reflect the new Supabase-native architecture and remove GitHub references.

---

## Files to Modify

### [MODIFY] .env.example

**Remove entire GitHub section (lines 30-46):**

```diff
- # =============================================================================
- # GITHUB INTEGRATION (Required for Phase 1)
- # =============================================================================
- 
- # GitHub personal access token (fine-grained)
- # Required scopes: Contents (read + write)
- # Create at: https://github.com/settings/tokens?type=beta
- GITHUB_TOKEN=ghp_your-token-here
- 
- # GitHub repository details
- GITHUB_OWNER=Montinou
- GITHUB_REPO=quoth-mcp
- GITHUB_BRANCH=main
- 
- # GitHub webhook secret for signature verification
- # Generate with: openssl rand -hex 32
- GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
```

**Update setup notes:**

```diff
# Setup Order:
# 1. Set up Supabase project and run migrations
# 2. Get Gemini API key from Google AI Studio
- # 3. Create GitHub fine-grained token
- # 4. Sign up for Resend and verify domain
- # 5. Generate webhook secret
- # 6. Copy this file to .env.local and fill in values
- # 7. Run: npm run dev
+ # 3. Sign up for Resend and verify domain
+ # 4. Copy this file to .env.local and fill in values
+ # 5. Run: npm run dev
```

---

### [MODIFY] CLAUDE.md

**Update architecture section** to describe new flow:

```markdown
## Architecture

Quoth uses the **Genesis Strategy** pattern:

1. **Persona Injection**: The `quoth_genesis` tool delivers a system prompt
2. **Local Analysis**: The AI client reads local files using its native capabilities
3. **Direct Save**: Changes are saved directly to Supabase (or via proposal if configured)
4. **Incremental Indexing**: Only changed chunks are re-embedded (token optimization)
5. **Automatic Versioning**: Database triggers preserve history automatically

### Key Differences from Previous Architecture

- ❌ No GitHub integration - Supabase is the single source of truth
- ❌ No GitHub webhooks - Direct writes to database
- ✅ Configurable approval flow per project
- ✅ Incremental re-indexing with chunk hashes
- ✅ Automatic version history via triggers
```

---

### [MODIFY] README.md

**Update Quick Start section** to remove GitHub config:

```diff
## Quick Start

1. Clone the repo
2. Copy `.env.example` to `.env.local`
3. Fill in required values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINIAI_API_KEY`
-  - `GITHUB_TOKEN`
4. Run migrations: `supabase db push`
5. Start dev server: `npm run dev`
```

---

### [MODIFY] WHITEPAPER.md

**Update architecture diagrams and descriptions** to reflect:

- Supabase as single source of truth
- Genesis Strategy flow
- No GitHub in the pipeline

---

## Checklist

- [ ] Update `.env.example` - remove GitHub section
- [ ] Update `.env.example` - update setup order
- [ ] Update `CLAUDE.md` - new architecture description
- [ ] Update `README.md` - remove GitHub from Quick Start
- [ ] Update `WHITEPAPER.md` - new architecture (if diagrams exist)
- [ ] Update [status.md](./status.md) - mark Phase 5 complete
- [ ] Commit changes: `git commit -m "Phase 5: Documentation updates"`

---

## Next Phase

Proceed to [Phase 6: UI Features](./phase-06-ui-features.md).
