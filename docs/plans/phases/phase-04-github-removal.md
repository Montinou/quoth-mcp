# Phase 4: GitHub Removal

**Status:** 🔴 Not Started  
**Risk Level:** Breaking Change ⚠️  
**Estimated Time:** 45 minutes  
**Dependencies:** Phase 1, 2, 3 complete

---

## Overview

Remove all GitHub integration code, dependencies, and configuration. This is a **breaking change** - the GitHub commit workflow will stop working after this phase.

---

## Files to Delete

### DELETE: src/lib/github.ts

```bash
rm src/lib/github.ts
```

### DELETE: src/app/api/github/webhook/route.ts

```bash
rm -rf src/app/api/github
```

---

## Files to Modify

### [MODIFY] src/app/api/proposals/[id]/approve/route.ts

**Replace GitHub commit with direct Supabase save:**

```typescript
// REMOVE this import:
// import { commitProposalToGitHub } from '@/lib/github';

// ADD this import:
import { syncDocument } from '@/lib/sync';

// REPLACE the GitHub commit section (lines 112-159) with:

// 8. Apply changes directly to Supabase and re-index
try {
  const title = proposal.file_path.replace('.md', '').split('/').pop() || proposal.file_path;
  
  const { document, chunksIndexed } = await syncDocument(
    proposal.project_id,
    proposal.file_path,
    title,
    proposal.proposed_content
  );

  await supabase
    .from('document_proposals')
    .update({
      status: 'applied',
      applied_at: new Date().toISOString()
    })
    .eq('id', id);

  sendApprovalNotification({ ...proposal, reviewed_by: profile.email })
    .catch((err) => console.error('Email failed:', err));

  return Response.json({
    success: true,
    message: 'Proposal approved and applied to knowledge base',
    document: { id: document.id, version: document.version, chunksIndexed }
  });
} catch (error) {
  await supabase
    .from('document_proposals')
    .update({
      status: 'error',
      rejection_reason: `Apply failed: ${error instanceof Error ? error.message : 'Unknown'}`
    })
    .eq('id', id);

  return Response.json(
    { error: 'Failed to apply changes' },
    { status: 500 }
  );
}
```

---

### [MODIFY] src/lib/supabase.ts

```diff
export interface Project {
  id: string;
  slug: string;
- github_repo: string;
+ github_repo?: string; // Deprecated
  created_at: string;
}

export async function getOrCreateProject(
  slug: string,
- githubRepo: string
): Promise<Project> {
  const { data: existing } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .single();

  if (existing) return existing as Project;

  const { data: created, error } = await supabase
    .from("projects")
    .insert({ slug })  // Remove github_repo
    .select()
    .single();

  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return created as Project;
}
```

---

### [MODIFY] src/lib/quoth/types.ts

```diff
export interface QuothConfig {
  knowledgeBasePath: string;
  cacheRevalidateSeconds: number;
- enableGitHub: boolean;
- githubRepo?: string;
- githubToken?: string;
}

export const DEFAULT_CONFIG: QuothConfig = {
  knowledgeBasePath: './quoth-knowledge-base',
  cacheRevalidateSeconds: 3600,
- enableGitHub: false,
};
```

---

### [MODIFY] src/lib/email.ts

**Update `sendApprovalNotification` function:**

```diff
export async function sendApprovalNotification(
  proposal: DocumentProposal,
- commit: { sha?: string; url?: string }
) {
```

**In the email template, replace:**
```diff
- <a href="${commit.url || '#'}" class="button">View Diff on GitHub</a>
+ <p>Changes applied to knowledge base. Previous version preserved.</p>

- This action was performed automatically. If incorrect, revert the commit in GitHub.
+ This action was performed automatically. Contact admin if changes need reverting.
```

---

### [MODIFY] src/app/proposals/[id]/page.tsx

**Remove GitHub UI elements:**

1. **Line ~74:** Change alert message
   ```diff
   - alert('Proposal approved and committed to GitHub!');
   + alert('Proposal approved and applied to knowledge base!');
   ```

2. **Lines ~270-275:** Remove GitHub commit link section entirely

3. **Line ~298:** Update modal text
   ```diff
   - This will commit the changes to GitHub. Enter your email to confirm:
   + This will apply the changes to the knowledge base. Enter your email to confirm:
   ```

---

### [MODIFY] package.json

```bash
npm uninstall octokit
```

Or manually remove from dependencies:
```diff
"dependencies": {
- "octokit": "^4.1.2",
```

---

## Step-by-Step Instructions

### Step 4.1: Delete Files

```bash
cd /Users/agustinmontoya/Attorneyshare/Quoth/quoth-mcp

# Delete GitHub module
rm src/lib/github.ts

# Delete webhook route
rm -rf src/app/api/github
```

### Step 4.2: Update approve/route.ts

1. Open `src/app/api/proposals/[id]/approve/route.ts`
2. Remove `commitProposalToGitHub` import
3. Add `syncDocument` import
4. Replace GitHub commit section with direct Supabase save

### Step 4.3: Update supabase.ts

1. Make `github_repo` optional in `Project` interface
2. Remove `githubRepo` parameter from `getOrCreateProject`

### Step 4.4: Update types.ts

1. Remove `enableGitHub`, `githubRepo`, `githubToken` from `QuothConfig`
2. Remove `enableGitHub: false` from `DEFAULT_CONFIG`

### Step 4.5: Update email.ts

1. Remove `commit` parameter from `sendApprovalNotification`
2. Update email template to remove GitHub references

### Step 4.6: Update proposals page

1. Update alert messages
2. Remove GitHub commit link
3. Update modal text

### Step 4.7: Remove octokit

```bash
npm uninstall octokit
```

### Step 4.8: Verify Build

```bash
npm run build
```

### Step 4.9: Grep for Remaining References

```bash
grep -r "github" src/ --include="*.ts" --include="*.tsx" | grep -v "Footer.tsx" | grep -v ".d.ts"
```

Should return empty or only Footer.tsx social link.

---

## Checklist

- [ ] Delete `src/lib/github.ts`
- [ ] Delete `src/app/api/github/` directory
- [ ] Update `approve/route.ts` - replace GitHub with Supabase
- [ ] Update `src/lib/supabase.ts` - make github_repo optional
- [ ] Update `src/lib/quoth/types.ts` - remove GitHub config
- [ ] Update `src/lib/email.ts` - remove commit parameter
- [ ] Update `proposals/[id]/page.tsx` - remove GitHub UI
- [ ] Run `npm uninstall octokit`
- [ ] Run `npm run build` - no errors
- [ ] Grep check - no remaining GitHub references
- [ ] Update [status.md](./status.md) - mark Phase 4 complete
- [ ] Commit changes: `git commit -m "Phase 4: Remove GitHub integration"`

---

## Next Phase

Proceed to [Phase 5: Documentation](./phase-05-documentation.md).
