# Quoth Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Phase 2 "Intelligence" features: PreToolUse/PostToolUse hooks for pattern injection and audit, Coverage view in dashboard, Genesis auto-detection, and Quoth Badge output.

**Architecture:** Claude Code plugin with hook-based middleware pattern. Hooks fire before/after MCP tool execution to inject relevant patterns and audit generated code against documentation. Coverage is calculated convention-based (tracked in Supabase), displayed in dashboard. Badge output is appended to Stop hook responses.

**Tech Stack:** Next.js 16, TypeScript, Supabase (PostgreSQL + Vector), Claude Code Plugin System (hooks/, skills/), TailwindCSS v4

---

## Prerequisites

Before starting, ensure:
- [ ] Quoth development server runs: `npm run dev`
- [ ] Supabase connection works: `npm run verify:rag`
- [ ] You have access to apply migrations via psql

---

## Task 1: Database Schema - Activity Logging Table

**Files:**
- Create: `supabase/migrations/022_activity_logging.sql`

**Step 1: Write the migration file**

```sql
-- Migration: 022_activity_logging.sql
-- Purpose: Track all Quoth tool activity for analytics and insights

BEGIN;

-- Activity logging table
CREATE TABLE IF NOT EXISTS quoth_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Event identification
  event_type TEXT NOT NULL CHECK (event_type IN (
    'search',           -- quoth_search_index called
    'read',             -- quoth_read_doc called
    'read_chunks',      -- quoth_read_chunks called
    'propose',          -- quoth_propose_update called
    'genesis',          -- quoth_genesis called
    'pattern_match',    -- Pattern found in code (PostToolUse)
    'pattern_inject',   -- Pattern injected (PreToolUse)
    'drift_detected',   -- Code diverged from docs
    'coverage_scan'     -- Coverage calculation ran
  )),

  -- Event data
  query TEXT,                      -- Search query or tool input
  patterns_matched TEXT[],         -- Pattern IDs that matched
  drift_detected BOOLEAN DEFAULT false,
  result_count INTEGER,            -- Number of results returned
  relevance_score NUMERIC(5,4),    -- Average relevance for searches

  -- Context
  tool_name TEXT,                  -- MCP tool name
  file_path TEXT,                  -- File being edited (for hooks)
  context JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_quoth_activity_project_id ON quoth_activity(project_id);
CREATE INDEX idx_quoth_activity_event_type ON quoth_activity(event_type);
CREATE INDEX idx_quoth_activity_created_at ON quoth_activity(created_at DESC);
CREATE INDEX idx_quoth_activity_project_event ON quoth_activity(project_id, event_type);

-- RLS policies
ALTER TABLE quoth_activity ENABLE ROW LEVEL SECURITY;

-- Users can view activity for their projects
CREATE POLICY "Users can view project activity"
  ON quoth_activity FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Service role can insert (MCP server uses service role)
CREATE POLICY "Service role can insert activity"
  ON quoth_activity FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE quoth_activity IS 'Tracks all Quoth tool activity for analytics dashboard';

COMMIT;
```

**Step 2: Apply the migration**

Run:
```bash
PGPASSWORD="$(grep POSTGRES_PASSWORD .env | cut -d '=' -f2 | tr -d '"')" \
psql "$(grep POSTGRES_URL_NON_POOLING .env | cut -d '=' -f2 | tr -d '"')" \
-f supabase/migrations/022_activity_logging.sql
```
Expected: `BEGIN` `CREATE TABLE` `CREATE INDEX` (multiple) `ALTER TABLE` `CREATE POLICY` (2x) `COMMENT` `COMMIT`

**Step 3: Commit**

```bash
git add supabase/migrations/022_activity_logging.sql
git commit -m "$(cat <<'EOF'
feat(db): add activity logging table for Phase 2 analytics

- quoth_activity table for tracking tool usage
- Indexes for project_id, event_type, created_at
- RLS policies for multi-tenant security

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Database Schema - Coverage Tracking Table

**Files:**
- Create: `supabase/migrations/023_coverage_tracking.sql`

**Step 1: Write the migration file**

```sql
-- Migration: 023_coverage_tracking.sql
-- Purpose: Track documentation coverage snapshots for dashboard

BEGIN;

-- Coverage snapshots table
CREATE TABLE IF NOT EXISTS coverage_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Coverage metrics
  total_documentable INTEGER NOT NULL DEFAULT 0,
  total_documented INTEGER NOT NULL DEFAULT 0,
  coverage_percentage NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN total_documentable > 0
      THEN ROUND((total_documented::NUMERIC / total_documentable) * 100, 2)
      ELSE 0
    END
  ) STORED,

  -- Breakdown by category (convention-based)
  breakdown JSONB DEFAULT '{
    "api_endpoints": {"documented": 0, "total": 0},
    "components": {"documented": 0, "total": 0},
    "testing_patterns": {"documented": 0, "total": 0},
    "database_models": {"documented": 0, "total": 0},
    "architecture": {"documented": 0, "total": 0}
  }'::jsonb,

  -- Undocumented items list
  undocumented_items JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  scan_type TEXT DEFAULT 'manual' CHECK (scan_type IN ('manual', 'scheduled', 'genesis')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching latest snapshot
CREATE INDEX idx_coverage_snapshot_project_latest
  ON coverage_snapshot(project_id, created_at DESC);

-- RLS policies
ALTER TABLE coverage_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project coverage"
  ON coverage_snapshot FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage coverage"
  ON coverage_snapshot FOR ALL
  WITH CHECK (true);

COMMENT ON TABLE coverage_snapshot IS 'Stores point-in-time documentation coverage metrics';

COMMIT;
```

**Step 2: Apply the migration**

Run:
```bash
PGPASSWORD="$(grep POSTGRES_PASSWORD .env | cut -d '=' -f2 | tr -d '"')" \
psql "$(grep POSTGRES_URL_NON_POOLING .env | cut -d '=' -f2 | tr -d '"')" \
-f supabase/migrations/023_coverage_tracking.sql
```
Expected: `BEGIN` `CREATE TABLE` `CREATE INDEX` `ALTER TABLE` `CREATE POLICY` (2x) `COMMENT` `COMMIT`

**Step 3: Commit**

```bash
git add supabase/migrations/023_coverage_tracking.sql
git commit -m "$(cat <<'EOF'
feat(db): add coverage snapshot table for dashboard metrics

- coverage_snapshot table with computed percentage
- JSONB breakdown by category (convention-based)
- undocumented_items list for UI display

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Activity Logging Service

**Files:**
- Create: `src/lib/quoth/activity.ts`
- Test: Manual verification via database query

**Step 1: Create the activity logging service**

```typescript
/**
 * Activity Logging Service
 * Tracks all Quoth tool activity for analytics dashboard
 */

import { supabase } from '../supabase';

export type ActivityEventType =
  | 'search'
  | 'read'
  | 'read_chunks'
  | 'propose'
  | 'genesis'
  | 'pattern_match'
  | 'pattern_inject'
  | 'drift_detected'
  | 'coverage_scan';

export interface ActivityLogParams {
  projectId: string;
  userId?: string;
  eventType: ActivityEventType;
  query?: string;
  patternsMatched?: string[];
  driftDetected?: boolean;
  resultCount?: number;
  relevanceScore?: number;
  toolName?: string;
  filePath?: string;
  context?: Record<string, unknown>;
}

/**
 * Log an activity event to the database
 * Non-blocking - errors are logged but don't throw
 */
export async function logActivity(params: ActivityLogParams): Promise<void> {
  try {
    const { error } = await supabase.from('quoth_activity').insert({
      project_id: params.projectId,
      user_id: params.userId || null,
      event_type: params.eventType,
      query: params.query || null,
      patterns_matched: params.patternsMatched || null,
      drift_detected: params.driftDetected ?? false,
      result_count: params.resultCount ?? null,
      relevance_score: params.relevanceScore ?? null,
      tool_name: params.toolName || null,
      file_path: params.filePath || null,
      context: params.context || {},
    });

    if (error) {
      console.error('[Activity] Failed to log activity:', error.message);
    }
  } catch (err) {
    // Non-blocking - don't let logging failures affect tool execution
    console.error('[Activity] Unexpected error:', err);
  }
}

/**
 * Get activity summary for a project (for dashboard)
 */
export async function getActivitySummary(
  projectId: string,
  days: number = 7
): Promise<{
  totalQueries: number;
  searchCount: number;
  readCount: number;
  proposeCount: number;
  topSearchTerms: Array<{ query: string; count: number }>;
  missRate: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: activities, error } = await supabase
    .from('quoth_activity')
    .select('event_type, query, result_count')
    .eq('project_id', projectId)
    .gte('created_at', since.toISOString());

  if (error || !activities) {
    return {
      totalQueries: 0,
      searchCount: 0,
      readCount: 0,
      proposeCount: 0,
      topSearchTerms: [],
      missRate: 0,
    };
  }

  const searchCount = activities.filter((a) => a.event_type === 'search').length;
  const readCount = activities.filter((a) => a.event_type === 'read' || a.event_type === 'read_chunks').length;
  const proposeCount = activities.filter((a) => a.event_type === 'propose').length;

  // Calculate miss rate (searches with 0 results)
  const searches = activities.filter((a) => a.event_type === 'search');
  const misses = searches.filter((a) => (a.result_count ?? 0) === 0).length;
  const missRate = searches.length > 0 ? (misses / searches.length) * 100 : 0;

  // Top search terms
  const queryCount = new Map<string, number>();
  searches.forEach((s) => {
    if (s.query) {
      const normalized = s.query.toLowerCase().trim();
      queryCount.set(normalized, (queryCount.get(normalized) || 0) + 1);
    }
  });
  const topSearchTerms = Array.from(queryCount.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalQueries: activities.length,
    searchCount,
    readCount,
    proposeCount,
    topSearchTerms,
    missRate: Math.round(missRate * 10) / 10,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/quoth/activity.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/quoth/activity.ts
git commit -m "$(cat <<'EOF'
feat(activity): add activity logging service

- logActivity() for non-blocking event tracking
- getActivitySummary() for dashboard analytics
- Tracks searches, reads, proposals, miss rate

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Integrate Activity Logging into MCP Tools

**Files:**
- Modify: `src/lib/quoth/tools.ts:49-117` (search tool)
- Modify: `src/lib/quoth/tools.ts:131-180` (read tool)

**Step 1: Add import at top of tools.ts**

Add after line 22:

```typescript
import { logActivity } from './activity';
```

**Step 2: Add logging to quoth_search_index (inside the try block, after results)**

Find the line `const results = await searchDocuments(query, authContext.project_id);` (around line 52).
Add immediately after:

```typescript
        // Log activity (non-blocking)
        const avgRelevance = results.length > 0
          ? results.reduce((sum, r) => sum + (r.relevance || 0), 0) / results.length
          : 0;
        logActivity({
          projectId: authContext.project_id,
          userId: authContext.user_id,
          eventType: 'search',
          query,
          resultCount: results.length,
          relevanceScore: avgRelevance,
          toolName: 'quoth_search_index',
        });
```

**Step 3: Add logging to quoth_read_doc (inside the try block, after doc retrieval)**

Find the line `const doc = await readDocument(doc_id, authContext.project_id);` (around line 134).
Add immediately after:

```typescript
        // Log activity (non-blocking)
        logActivity({
          projectId: authContext.project_id,
          userId: authContext.user_id,
          eventType: 'read',
          query: doc_id,
          resultCount: doc ? 1 : 0,
          toolName: 'quoth_read_doc',
        });
```

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/lib/quoth/tools.ts
git commit -m "$(cat <<'EOF'
feat(tools): integrate activity logging into search and read

- Log searches with query, result count, avg relevance
- Log document reads with doc_id
- Non-blocking to avoid affecting tool latency

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Coverage Calculation Service

**Files:**
- Create: `src/lib/quoth/coverage.ts`

**Step 1: Create the coverage calculation service**

```typescript
/**
 * Coverage Calculation Service
 * Convention-based documentation coverage analysis
 */

import { supabase } from '../supabase';

interface CategoryCoverage {
  documented: number;
  total: number;
}

interface CoverageBreakdown {
  api_endpoints: CategoryCoverage;
  components: CategoryCoverage;
  testing_patterns: CategoryCoverage;
  database_models: CategoryCoverage;
  architecture: CategoryCoverage;
}

interface UndocumentedItem {
  path: string;
  category: keyof CoverageBreakdown;
  suggestion: string;
}

export interface CoverageResult {
  projectId: string;
  totalDocumentable: number;
  totalDocumented: number;
  coveragePercentage: number;
  breakdown: CoverageBreakdown;
  undocumentedItems: UndocumentedItem[];
}

/**
 * Convention-based patterns for detecting documentable items
 * These patterns match file paths to documentation categories
 */
const CONVENTION_PATTERNS: Record<keyof CoverageBreakdown, RegExp[]> = {
  api_endpoints: [
    /\/api\/.*\/route\.(ts|js)$/,
    /\/pages\/api\/.*\.(ts|js)$/,
    /\/app\/api\/.*\/route\.(ts|js)$/,
  ],
  components: [
    /\/components\/.*\.(tsx|jsx)$/,
    /\/src\/components\/.*\.(tsx|jsx)$/,
  ],
  testing_patterns: [
    /\.(test|spec)\.(ts|tsx|js|jsx)$/,
    /\/tests?\/.*\.(ts|tsx|js|jsx)$/,
    /\/__tests__\/.*\.(ts|tsx|js|jsx)$/,
  ],
  database_models: [
    /\/models?\/.*\.(ts|js)$/,
    /\/schema\.(ts|js)$/,
    /\/prisma\/schema\.prisma$/,
    /\/drizzle\/.*\.(ts|js)$/,
  ],
  architecture: [
    /\/lib\/.*\.(ts|js)$/,
    /\/utils\/.*\.(ts|js)$/,
    /\/services\/.*\.(ts|js)$/,
  ],
};

/**
 * Document type mappings for matching against Quoth docs
 */
const CATEGORY_DOC_TYPES: Record<keyof CoverageBreakdown, string[]> = {
  api_endpoints: ['contract', 'api-schema'],
  components: ['architecture', 'pattern'],
  testing_patterns: ['testing-pattern', 'pattern'],
  database_models: ['contract', 'database-model'],
  architecture: ['architecture', 'pattern'],
};

/**
 * Calculate documentation coverage for a project
 * Uses convention-based detection of documentable items
 */
export async function calculateCoverage(
  projectId: string,
  codebasePaths?: string[]
): Promise<CoverageResult> {
  // Fetch existing documents for this project
  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, file_path, title, content')
    .eq('project_id', projectId);

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  const docs = documents || [];

  // Initialize breakdown
  const breakdown: CoverageBreakdown = {
    api_endpoints: { documented: 0, total: 0 },
    components: { documented: 0, total: 0 },
    testing_patterns: { documented: 0, total: 0 },
    database_models: { documented: 0, total: 0 },
    architecture: { documented: 0, total: 0 },
  };

  const undocumentedItems: UndocumentedItem[] = [];

  // If codebase paths provided, analyze them
  if (codebasePaths && codebasePaths.length > 0) {
    for (const filePath of codebasePaths) {
      for (const [category, patterns] of Object.entries(CONVENTION_PATTERNS)) {
        const categoryKey = category as keyof CoverageBreakdown;
        if (patterns.some((p) => p.test(filePath))) {
          breakdown[categoryKey].total++;

          // Check if documented
          const hasDoc = docs.some((doc) => {
            const content = doc.content?.toLowerCase() || '';
            const normalizedPath = filePath.toLowerCase();
            return (
              content.includes(normalizedPath) ||
              doc.file_path?.toLowerCase().includes(normalizedPath.split('/').pop() || '')
            );
          });

          if (hasDoc) {
            breakdown[categoryKey].documented++;
          } else {
            undocumentedItems.push({
              path: filePath,
              category: categoryKey,
              suggestion: getSuggestion(categoryKey, filePath),
            });
          }
          break; // Only count once per file
        }
      }
    }
  } else {
    // Fallback: count documents by type
    for (const doc of docs) {
      const docPath = doc.file_path?.toLowerCase() || '';
      for (const [category, docTypes] of Object.entries(CATEGORY_DOC_TYPES)) {
        const categoryKey = category as keyof CoverageBreakdown;
        if (docTypes.some((t) => docPath.includes(t))) {
          breakdown[categoryKey].documented++;
          breakdown[categoryKey].total++;
          break;
        }
      }
    }
  }

  // Calculate totals
  const totalDocumentable = Object.values(breakdown).reduce((sum, cat) => sum + cat.total, 0);
  const totalDocumented = Object.values(breakdown).reduce((sum, cat) => sum + cat.documented, 0);
  const coveragePercentage =
    totalDocumentable > 0 ? Math.round((totalDocumented / totalDocumentable) * 100) : 0;

  return {
    projectId,
    totalDocumentable,
    totalDocumented,
    coveragePercentage,
    breakdown,
    undocumentedItems: undocumentedItems.slice(0, 20), // Limit to top 20
  };
}

function getSuggestion(category: keyof CoverageBreakdown, filePath: string): string {
  const suggestions: Record<keyof CoverageBreakdown, string> = {
    api_endpoints: 'Create API schema documentation',
    components: 'Document component patterns and props',
    testing_patterns: 'Add testing pattern documentation',
    database_models: 'Create data model documentation',
    architecture: 'Document architectural patterns',
  };
  return suggestions[category];
}

/**
 * Save coverage snapshot to database
 */
export async function saveCoverageSnapshot(
  coverage: CoverageResult,
  scanType: 'manual' | 'scheduled' | 'genesis' = 'manual'
): Promise<void> {
  const { error } = await supabase.from('coverage_snapshot').insert({
    project_id: coverage.projectId,
    total_documentable: coverage.totalDocumentable,
    total_documented: coverage.totalDocumented,
    breakdown: coverage.breakdown,
    undocumented_items: coverage.undocumentedItems,
    scan_type: scanType,
  });

  if (error) {
    throw new Error(`Failed to save coverage snapshot: ${error.message}`);
  }
}

/**
 * Get latest coverage snapshot for a project
 */
export async function getLatestCoverage(projectId: string): Promise<CoverageResult | null> {
  const { data, error } = await supabase
    .from('coverage_snapshot')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    projectId: data.project_id,
    totalDocumentable: data.total_documentable,
    totalDocumented: data.total_documented,
    coveragePercentage: data.coverage_percentage,
    breakdown: data.breakdown as CoverageBreakdown,
    undocumentedItems: data.undocumented_items as UndocumentedItem[],
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/quoth/coverage.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/quoth/coverage.ts
git commit -m "$(cat <<'EOF'
feat(coverage): add convention-based coverage calculation

- calculateCoverage() with regex pattern matching
- saveCoverageSnapshot() for persistence
- getLatestCoverage() for dashboard display
- Categories: api, components, tests, models, architecture

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Coverage API Endpoint

**Files:**
- Create: `src/app/api/projects/[projectId]/coverage/route.ts`

**Step 1: Create the API route**

```typescript
/**
 * Coverage API Endpoint
 * GET: Fetch latest coverage snapshot
 * POST: Trigger new coverage scan
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  calculateCoverage,
  saveCoverageSnapshot,
  getLatestCoverage,
} from '@/lib/quoth/coverage';
import { logActivity } from '@/lib/quoth/activity';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const supabase = await createServerSupabaseClient();

    // Verify user has access to project
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get latest coverage
    const coverage = await getLatestCoverage(projectId);

    if (!coverage) {
      return NextResponse.json({
        coverage: null,
        message: 'No coverage data available. Trigger a scan to calculate coverage.',
      });
    }

    return NextResponse.json({ coverage });
  } catch (error) {
    console.error('[Coverage API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coverage' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const supabase = await createServerSupabaseClient();

    // Verify user has access to project
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse optional codebase paths from request body
    const body = await request.json().catch(() => ({}));
    const codebasePaths = body.paths as string[] | undefined;

    // Calculate coverage
    const coverage = await calculateCoverage(projectId, codebasePaths);

    // Save snapshot
    await saveCoverageSnapshot(coverage, 'manual');

    // Log activity
    await logActivity({
      projectId,
      userId: user.id,
      eventType: 'coverage_scan',
      resultCount: coverage.totalDocumented,
      context: {
        percentage: coverage.coveragePercentage,
        totalDocumentable: coverage.totalDocumentable,
      },
    });

    return NextResponse.json({
      coverage,
      message: 'Coverage scan completed',
    });
  } catch (error) {
    console.error('[Coverage API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate coverage' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/projects/\[projectId\]/coverage/route.ts
git commit -m "$(cat <<'EOF'
feat(api): add coverage API endpoint

- GET /api/projects/:id/coverage - fetch latest snapshot
- POST /api/projects/:id/coverage - trigger new scan
- Accepts optional codebase paths for targeted analysis

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Dashboard Coverage Component

**Files:**
- Create: `src/components/dashboard/CoverageCard.tsx`

**Step 1: Create the coverage card component**

```typescript
'use client';

/**
 * Coverage Card Component
 * Displays documentation coverage metrics with visual breakdown
 */

import { useState } from 'react';
import {
  PieChart,
  FileText,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CategoryCoverage {
  documented: number;
  total: number;
}

interface CoverageBreakdown {
  api_endpoints: CategoryCoverage;
  components: CategoryCoverage;
  testing_patterns: CategoryCoverage;
  database_models: CategoryCoverage;
  architecture: CategoryCoverage;
}

interface UndocumentedItem {
  path: string;
  category: keyof CoverageBreakdown;
  suggestion: string;
}

interface CoverageData {
  coveragePercentage: number;
  totalDocumentable: number;
  totalDocumented: number;
  breakdown: CoverageBreakdown;
  undocumentedItems: UndocumentedItem[];
}

interface CoverageCardProps {
  projectId: string;
  initialCoverage?: CoverageData | null;
}

const CATEGORY_LABELS: Record<keyof CoverageBreakdown, string> = {
  api_endpoints: 'API Endpoints',
  components: 'Components',
  testing_patterns: 'Testing Patterns',
  database_models: 'Database Models',
  architecture: 'Architecture',
};

export function CoverageCard({ projectId, initialCoverage }: CoverageCardProps) {
  const [coverage, setCoverage] = useState<CoverageData | null>(initialCoverage || null);
  const [isLoading, setIsLoading] = useState(false);
  const [showUndocumented, setShowUndocumented] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/coverage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error('Failed to scan coverage');
      }

      const data = await res.json();
      setCoverage(data.coverage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 80) return 'bg-emerald-muted';
    if (percentage >= 50) return 'bg-amber-warning';
    return 'bg-red-500';
  };

  const getCategoryPercentage = (cat: CategoryCoverage): number => {
    return cat.total > 0 ? Math.round((cat.documented / cat.total) * 100) : 0;
  };

  return (
    <div className="glass-panel rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-spectral/15">
            <PieChart className="w-5 h-5 text-violet-spectral" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Documentation Coverage</h3>
            <p className="text-sm text-gray-500">Convention-based analysis</p>
          </div>
        </div>
        <button
          onClick={handleScan}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg
            bg-violet-spectral/20 text-violet-ghost hover:bg-violet-spectral/30
            border border-violet-spectral/30 transition-all duration-300
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Scanning...' : 'Scan'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {coverage ? (
        <>
          {/* Overall Coverage */}
          <div className="mb-6">
            <div className="flex items-end justify-between mb-2">
              <span className="text-4xl font-bold text-white">
                {coverage.coveragePercentage}%
              </span>
              <span className="text-sm text-gray-500">
                {coverage.totalDocumented}/{coverage.totalDocumentable} documented
              </span>
            </div>
            <div className="h-2 rounded-full bg-charcoal overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(coverage.coveragePercentage)}`}
                style={{ width: `${coverage.coveragePercentage}%` }}
              />
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="space-y-3 mb-6">
            {Object.entries(coverage.breakdown).map(([key, value]) => {
              const categoryKey = key as keyof CoverageBreakdown;
              const percentage = getCategoryPercentage(value);
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-32 truncate">
                    {CATEGORY_LABELS[categoryKey]}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-charcoal overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getProgressColor(percentage)}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-16 text-right">
                    {value.documented}/{value.total}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Undocumented Items */}
          {coverage.undocumentedItems.length > 0 && (
            <div>
              <button
                onClick={() => setShowUndocumented(!showUndocumented)}
                className="flex items-center gap-2 text-sm text-amber-warning hover:text-amber-warning/80 transition-colors"
              >
                <AlertCircle className="w-4 h-4" />
                {coverage.undocumentedItems.length} undocumented areas
                {showUndocumented ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showUndocumented && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {coverage.undocumentedItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-2 rounded-lg bg-charcoal/50 text-sm"
                    >
                      <FileText className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-gray-300 font-mono text-xs truncate max-w-[300px]">
                          {item.path}
                        </p>
                        <p className="text-gray-500 text-xs">{item.suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <div className="inline-flex p-3 rounded-2xl bg-violet-spectral/10 mb-3">
            <PieChart className="w-6 h-6 text-violet-spectral" />
          </div>
          <p className="text-gray-400 mb-3">No coverage data available</p>
          <p className="text-sm text-gray-500">
            Click &quot;Scan&quot; to analyze documentation coverage
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/components/dashboard/CoverageCard.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/dashboard/CoverageCard.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add CoverageCard component for dashboard

- Visual coverage percentage with progress bars
- Category breakdown (API, components, tests, etc.)
- Expandable undocumented items list
- Manual scan trigger button

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Integrate Coverage Card into Dashboard

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

**Step 1: Add import at top of file**

Add after other imports (around line 20):

```typescript
import { CoverageCard } from '@/components/dashboard/CoverageCard';
import { getLatestCoverage } from '@/lib/quoth/coverage';
```

**Step 2: Fetch coverage data in the component**

After fetching document count (around line 50), add:

```typescript
  // Fetch coverage for first project (if any)
  let initialCoverage = null;
  const firstProject = projects?.[0];
  if (firstProject) {
    initialCoverage = await getLatestCoverage(firstProject.id);
  }
```

**Step 3: Add Coverage Card to the layout**

After the Stats Grid section (after line 180), add a new section:

```typescript
        {/* Coverage Section */}
        {firstProject && (
          <div className="mb-10 animate-stagger stagger-5">
            <CoverageCard
              projectId={firstProject.id}
              initialCoverage={initialCoverage}
            />
          </div>
        )}
```

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): integrate coverage card

- Display coverage for first project
- Fetch initial coverage on page load
- Add between stats grid and projects section

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Claude Code Plugin Structure

**Files:**
- Create: `quoth-plugin/plugin.json`
- Create: `quoth-plugin/README.md`

**Step 1: Create plugin manifest**

```json
{
  "$schema": "https://claude.ai/plugins/schema/v1.json",
  "name": "quoth",
  "version": "0.1.0",
  "displayName": "Quoth Documentation",
  "description": "AI-driven documentation as single source of truth. Auto-injects patterns before code generation, audits code after writing.",
  "author": "Montinou",
  "repository": "https://github.com/Montinou/quoth",

  "hooks": {
    "SessionStart": "hooks/session-start.md",
    "PreToolUse": {
      "Edit": "hooks/pre-edit.md",
      "Write": "hooks/pre-write.md"
    },
    "PostToolUse": {
      "Edit": "hooks/post-edit.md",
      "Write": "hooks/post-write.md"
    },
    "Stop": "hooks/stop.md"
  },

  "skills": {
    "quoth-genesis": "skills/genesis.md"
  },

  "mcp": {
    "server": "quoth"
  },

  "settings": {
    "autoInjectPatterns": {
      "type": "boolean",
      "default": true,
      "description": "Automatically inject relevant patterns before code generation"
    },
    "showBadge": {
      "type": "boolean",
      "default": true,
      "description": "Show Quoth badge after responses"
    },
    "auditEnabled": {
      "type": "boolean",
      "default": true,
      "description": "Audit generated code against documentation"
    }
  }
}
```

**Step 2: Create plugin README**

```markdown
# Quoth Plugin for Claude Code

AI-driven documentation as a single source of truth.

## Features

- **SessionStart**: Detects project, checks for Quoth docs, offers Genesis if missing
- **PreToolUse (Edit/Write)**: Injects relevant patterns before code generation
- **PostToolUse (Edit/Write)**: Audits generated code against documentation
- **Stop**: Shows Quoth Badge with pattern summary

## Installation

```bash
claude plugins install quoth
```

Or manually:

```bash
git clone https://github.com/Montinou/quoth-plugin ~/.claude/plugins/quoth
```

## Configuration

Settings in `~/.claude/plugins/quoth.local.md`:

```yaml
---
autoInjectPatterns: true
showBadge: true
auditEnabled: true
---
```

## Skills

- `/quoth-genesis` - Bootstrap documentation for a new project

## Requirements

- Quoth MCP server connected: `claude mcp add quoth`
```

**Step 3: Commit**

```bash
git add quoth-plugin/plugin.json quoth-plugin/README.md
git commit -m "$(cat <<'EOF'
feat(plugin): create Claude Code plugin structure

- plugin.json manifest with hooks and skills
- README with installation instructions
- Settings for autoInjectPatterns, showBadge, auditEnabled

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: SessionStart Hook

**Files:**
- Create: `quoth-plugin/hooks/session-start.md`

**Step 1: Create the SessionStart hook**

```markdown
---
event: SessionStart
description: Detect project and inject Quoth context
---

# Quoth SessionStart Hook

## Check for Quoth Configuration

1. **Detect Quoth MCP**: Check if `quoth` MCP server is connected
   - If not connected: Skip remaining steps (plugin inactive)

2. **Check Project Documentation**: Call `quoth_search_index` with query "project overview"
   - If results found: Project has Quoth docs
   - If no results: Project may need Genesis

## Actions Based on Detection

### If Project Has Quoth Docs

Load architect context silently:

> **Quoth Active**: Documentation patterns will be injected automatically.
> Use `/prompt quoth_architect` for explicit pattern enforcement.

### If Project Needs Documentation

Offer Genesis:

> **No Quoth documentation found for this project.**
>
> Would you like to bootstrap documentation with Genesis?
> - Run `/quoth-genesis` to create project documentation
> - Or connect an existing Quoth project

## Token Efficiency

- Only log a single line acknowledgment
- Do NOT dump full documentation
- Let PreToolUse inject specific patterns as needed
```

**Step 2: Commit**

```bash
git add quoth-plugin/hooks/session-start.md
git commit -m "$(cat <<'EOF'
feat(plugin): add SessionStart hook

- Detect Quoth MCP connection
- Check for existing project documentation
- Offer Genesis if no docs found

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: PreToolUse Hook (Edit/Write)

**Files:**
- Create: `quoth-plugin/hooks/pre-edit.md`
- Create: `quoth-plugin/hooks/pre-write.md`

**Step 1: Create pre-edit hook**

```markdown
---
event: PreToolUse
tool: Edit
description: Inject relevant patterns before editing code
---

# Quoth PreToolUse Hook (Edit)

## Pattern Injection

Before editing `{{tool.file_path}}`:

1. **Extract Context**: Identify the file type and purpose
   - Component: `*.tsx`, `*.jsx`
   - API route: `*/api/*`, `*/route.ts`
   - Test file: `*.test.*`, `*.spec.*`
   - Service/util: `*/lib/*`, `*/utils/*`

2. **Search Quoth**: Call `quoth_search_index` with contextual query:
   - For components: "component patterns {{file_name}}"
   - For API: "api endpoint patterns"
   - For tests: "testing patterns {{test_framework}}"
   - For services: "service patterns {{domain}}"

3. **Inject Patterns**: If relevant patterns found (relevance > 0.6):

```
<quoth_patterns file="{{file_path}}" count="{{pattern_count}}">
  {{#each patterns}}
  - {{title}}: {{one_line_summary}}
  {{/each}}
</quoth_patterns>
```

4. **Skip Injection If**:
   - No relevant patterns (relevance < 0.6)
   - File is config/generated (package.json, *.lock, *.generated.*)
   - autoInjectPatterns setting is false

## Token Budget

- Maximum 100 tokens for pattern injection
- Only include pattern names and 1-line summaries
- Let Claude call `quoth_read_doc` if it needs full details
```

**Step 2: Create pre-write hook (similar structure)**

```markdown
---
event: PreToolUse
tool: Write
description: Inject relevant patterns before writing new files
---

# Quoth PreToolUse Hook (Write)

## Pattern Injection for New Files

Before creating `{{tool.file_path}}`:

1. **Determine File Category**:
   - Same detection logic as Edit hook

2. **Search for Templates**: Call `quoth_search_index`:
   - "template {{category}} new file"
   - "boilerplate {{file_type}}"

3. **Inject Guidance**:

```
<quoth_guidance file="{{file_path}}" type="new_file">
  Relevant patterns for new {{category}} files:
  {{#each patterns}}
  - {{title}}: {{one_line_summary}}
  {{/each}}

  Consider using `quoth_get_template` for structure.
</quoth_guidance>
```

## Skip Injection If

- File is non-code (README, docs, config)
- autoInjectPatterns setting is false
```

**Step 3: Commit**

```bash
git add quoth-plugin/hooks/pre-edit.md quoth-plugin/hooks/pre-write.md
git commit -m "$(cat <<'EOF'
feat(plugin): add PreToolUse hooks for pattern injection

- pre-edit.md: Inject patterns before editing existing files
- pre-write.md: Inject guidance before creating new files
- Context-aware search based on file type

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: PostToolUse Hook (Audit)

**Files:**
- Create: `quoth-plugin/hooks/post-edit.md`
- Create: `quoth-plugin/hooks/post-write.md`

**Step 1: Create post-edit hook**

```markdown
---
event: PostToolUse
tool: Edit
description: Audit edited code against documentation
---

# Quoth PostToolUse Hook (Edit)

## Code Audit

After editing `{{tool.file_path}}`:

1. **Skip Audit If**:
   - auditEnabled setting is false
   - File is config/generated
   - Edit was minor (< 5 lines changed)

2. **Extract Key Changes**: Identify what was modified
   - New functions/methods
   - Changed patterns
   - Modified interfaces

3. **Compare Against Docs**: For each significant change:
   - Search Quoth for related patterns
   - Check if change aligns with documented patterns

4. **Record Findings** (internal state for Stop hook):

```
<quoth_audit file="{{file_path}}">
  <patterns_applied>
    {{#each applied}}
    - {{pattern_name}}: Applied correctly
    {{/each}}
  </patterns_applied>
  <potential_drift>
    {{#each drift}}
    - {{pattern_name}}: {{deviation_description}}
    {{/each}}
  </potential_drift>
  <undocumented>
    {{#each new_patterns}}
    - {{description}}: Consider documenting
    {{/each}}
  </undocumented>
</quoth_audit>
```

## Token Efficiency

- Do NOT output audit results immediately
- Store in session state for Stop hook aggregation
- Only flag critical drift immediately
```

**Step 2: Create post-write hook (similar)**

```markdown
---
event: PostToolUse
tool: Write
description: Audit new files against documentation
---

# Quoth PostToolUse Hook (Write)

## New File Audit

After creating `{{tool.file_path}}`:

1. **Skip Audit If**:
   - auditEnabled setting is false
   - File is config/generated/docs

2. **Analyze New Code**: Identify patterns used
   - Component structure
   - API design
   - Testing approach

3. **Compare Against Templates**: Check if structure matches
   - Quoth templates
   - Documented conventions

4. **Record for Stop Hook**:

```
<quoth_audit file="{{file_path}}" type="new_file">
  <patterns_followed>
    {{#each followed}}
    - {{pattern_name}}
    {{/each}}
  </patterns_followed>
  <suggestions>
    {{#each suggestions}}
    - {{suggestion}}
    {{/each}}
  </suggestions>
</quoth_audit>
```
```

**Step 3: Commit**

```bash
git add quoth-plugin/hooks/post-edit.md quoth-plugin/hooks/post-write.md
git commit -m "$(cat <<'EOF'
feat(plugin): add PostToolUse hooks for code audit

- post-edit.md: Audit edited code for pattern compliance
- post-write.md: Audit new files against templates
- Store findings for Stop hook aggregation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Stop Hook (Quoth Badge)

**Files:**
- Create: `quoth-plugin/hooks/stop.md`

**Step 1: Create the Stop hook with Quoth Badge**

```markdown
---
event: Stop
description: Display Quoth Badge summarizing pattern usage
---

# Quoth Stop Hook - Badge Output

## Badge Display

At the end of each response, if Quoth was active during the session:

### Badge Format

```
┌─────────────────────────────────────────┐
│ 🔮 Quoth: ✓ {{patterns_applied}} patterns applied
│          {{#if drift}}⚠ {{drift_count}} potential drift{{/if}}
│          {{#if undocumented}}📝 {{undocumented_count}} undocumented{{/if}}
└─────────────────────────────────────────┘
```

### Conditions for Display

**Show Badge If**:
- showBadge setting is true
- At least one Edit/Write tool was used
- Quoth patterns were searched/applied

**Badge Content**:
- **Patterns Applied**: Count of documented patterns that were followed
- **Potential Drift**: Count of deviations from documented patterns (warning)
- **Undocumented**: Count of new patterns that should be documented

### Examples

**Clean Response (all patterns followed)**:
```
┌─────────────────────────────────────────┐
│ 🔮 Quoth: ✓ 3 patterns applied          │
└─────────────────────────────────────────┘
```

**Response with Warnings**:
```
┌─────────────────────────────────────────┐
│ 🔮 Quoth: ✓ 2 patterns applied          │
│          ⚠ 1 potential drift            │
│          📝 1 undocumented area          │
└─────────────────────────────────────────┘
```

**Expandable Details** (if user asks "show quoth details"):
```
Patterns Applied:
- backend-unit-vitest: Mock pattern used correctly
- error-handling: Try-catch with logging

Potential Drift:
- api-response-format: Response structure differs from documented schema

Undocumented:
- New utility function `parseUserInput` - consider documenting
```

## Token Budget

- Badge: 2-3 lines max (< 50 tokens)
- Details only on user request
```

**Step 2: Commit**

```bash
git add quoth-plugin/hooks/stop.md
git commit -m "$(cat <<'EOF'
feat(plugin): add Stop hook with Quoth Badge

- Visual badge showing patterns applied
- Warning indicators for drift and undocumented areas
- Expandable details on request

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Genesis Skill for Plugin

**Files:**
- Create: `quoth-plugin/skills/genesis.md`

**Step 1: Create the Genesis skill**

```markdown
---
name: quoth-genesis
description: Bootstrap Quoth documentation for the current project
---

# Quoth Genesis Skill

## Overview

This skill triggers the Quoth Genesis process to create initial documentation for your project.

## Usage

```
/quoth-genesis
```

## What Happens

1. **Project Detection**: Identifies your project's tech stack
2. **Depth Selection**: Choose documentation depth:
   - **Minimal** (3 docs, ~3 min): Quick overview
   - **Standard** (5 docs, ~7 min): Team onboarding
   - **Comprehensive** (11 docs, ~20 min): Full documentation

3. **Document Generation**: Creates documentation for:
   - Project overview
   - Tech stack
   - Repository structure
   - Coding conventions
   - Testing patterns
   - And more (depending on depth)

4. **AI Tool Configuration**: Updates CLAUDE.md or creates QUOTH_DOCS.md

## Trigger

To run Genesis, call the `quoth_genesis` tool:

```
quoth_genesis({ depth_level: "standard", focus: "full_scan" })
```

## Post-Genesis

After Genesis completes:
- Documentation is uploaded to Quoth
- Coverage metrics are calculated
- AI tools are configured to use Quoth

Run `/quoth-genesis` again to update existing documentation.
```

**Step 2: Commit**

```bash
git add quoth-plugin/skills/genesis.md
git commit -m "$(cat <<'EOF'
feat(plugin): add Genesis skill for documentation bootstrap

- /quoth-genesis command for easy access
- Depth selection guidance
- Post-genesis workflow documentation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Activity Analytics Dashboard Section

**Files:**
- Create: `src/components/dashboard/ActivityCard.tsx`

**Step 1: Create the activity analytics component**

```typescript
'use client';

/**
 * Activity Card Component
 * Displays usage analytics for Quoth tools
 */

import { useState, useEffect } from 'react';
import { Activity, Search, FileText, GitPullRequest, TrendingUp } from 'lucide-react';

interface ActivitySummary {
  totalQueries: number;
  searchCount: number;
  readCount: number;
  proposeCount: number;
  topSearchTerms: Array<{ query: string; count: number }>;
  missRate: number;
}

interface ActivityCardProps {
  projectId: string;
}

export function ActivityCard({ projectId }: ActivityCardProps) {
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch(`/api/projects/${projectId}/activity`);
        if (!res.ok) throw new Error('Failed to fetch activity');
        const data = await res.json();
        setActivity(data.activity);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchActivity();
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="glass-panel rounded-2xl p-6 animate-pulse">
        <div className="h-6 bg-charcoal rounded w-1/3 mb-4" />
        <div className="h-20 bg-charcoal rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-blue-500/15">
          <Activity className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Usage Analytics</h3>
          <p className="text-sm text-gray-500">Last 7 days</p>
        </div>
      </div>

      {activity ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 rounded-lg bg-charcoal/50">
              <Search className="w-5 h-5 text-violet-spectral mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{activity.searchCount}</p>
              <p className="text-xs text-gray-500">Searches</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-charcoal/50">
              <FileText className="w-5 h-5 text-emerald-muted mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{activity.readCount}</p>
              <p className="text-xs text-gray-500">Reads</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-charcoal/50">
              <GitPullRequest className="w-5 h-5 text-amber-warning mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{activity.proposeCount}</p>
              <p className="text-xs text-gray-500">Proposals</p>
            </div>
          </div>

          {/* Miss Rate */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Search Miss Rate</span>
              <span className={`text-sm font-medium ${
                activity.missRate > 30 ? 'text-amber-warning' : 'text-emerald-muted'
              }`}>
                {activity.missRate}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-charcoal overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  activity.missRate > 30 ? 'bg-amber-warning' : 'bg-emerald-muted'
                }`}
                style={{ width: `${Math.min(activity.missRate, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Searches with no results (gaps in documentation)
            </p>
          </div>

          {/* Top Search Terms */}
          {activity.topSearchTerms.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-400">Top Searches</span>
              </div>
              <div className="space-y-2">
                {activity.topSearchTerms.slice(0, 5).map((term, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-300 truncate max-w-[200px]">
                      {term.query}
                    </span>
                    <span className="text-gray-500">{term.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-6">
          <Activity className="w-8 h-8 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">No activity data yet</p>
          <p className="text-sm text-gray-500">
            Start using Quoth tools to see analytics
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/ActivityCard.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add ActivityCard component for usage analytics

- Search, read, propose counts
- Miss rate indicator
- Top search terms list

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Activity API Endpoint

**Files:**
- Create: `src/app/api/projects/[projectId]/activity/route.ts`

**Step 1: Create the API route**

```typescript
/**
 * Activity API Endpoint
 * GET: Fetch activity summary for dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getActivitySummary } from '@/lib/quoth/activity';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const supabase = await createServerSupabaseClient();

    // Verify user has access to project
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get activity summary (default: last 7 days)
    const days = parseInt(request.nextUrl.searchParams.get('days') || '7');
    const activity = await getActivitySummary(projectId, days);

    return NextResponse.json({ activity });
  } catch (error) {
    console.error('[Activity API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/projects/\[projectId\]/activity/route.ts
git commit -m "$(cat <<'EOF'
feat(api): add activity API endpoint

- GET /api/projects/:id/activity - fetch usage summary
- Configurable time window via ?days= param

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Integrate Activity Card into Dashboard

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

**Step 1: Add import**

Add after CoverageCard import:

```typescript
import { ActivityCard } from '@/components/dashboard/ActivityCard';
```

**Step 2: Add Activity Card to layout**

After the Coverage Section, add:

```typescript
        {/* Activity Section */}
        {firstProject && (
          <div className="mb-10 animate-stagger stagger-6">
            <ActivityCard projectId={firstProject.id} />
          </div>
        )}
```

**Step 3: Update stagger classes for subsequent sections**

Update the Projects Section stagger class from `stagger-6` to `stagger-7`
Update the Quick Actions stagger class from `stagger-7` to `stagger-8`

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): integrate activity analytics card

- Add ActivityCard after coverage section
- Update stagger animation classes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Add Coverage Nav Item to Sidebar

**Files:**
- Modify: `src/components/dashboard/DashboardSidebar.tsx:46-65`

**Step 1: Add PieChart import**

Add to the import statement (around line 11):

```typescript
import {
  Home,
  BookOpen,
  FileEdit,
  Key,
  Users,
  Settings,
  LogOut,
  ChevronUp,
  Sparkles,
  PieChart,  // Add this
} from 'lucide-react';
```

**Step 2: Add Coverage to mainNavItems**

Add after the Proposals item (around line 63):

```typescript
  {
    title: 'Coverage',
    href: '/coverage',
    icon: PieChart,
    description: 'Doc coverage metrics',
  },
```

**Step 3: Commit**

```bash
git add src/components/dashboard/DashboardSidebar.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Coverage nav item to sidebar

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: Update quoth/index.ts Exports

**Files:**
- Modify: `src/lib/quoth/index.ts`

**Step 1: Add exports for new modules**

Add to exports:

```typescript
export * from './activity';
export * from './coverage';
```

**Step 2: Commit**

```bash
git add src/lib/quoth/index.ts
git commit -m "$(cat <<'EOF'
feat(quoth): export activity and coverage modules

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: Final Integration Test

**Files:**
- No new files

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Start dev server and verify**

Run: `npm run dev`

Verify:
1. Dashboard loads at http://localhost:3000/dashboard
2. Coverage card displays (even with null data)
3. Activity card displays (even with null data)
4. No console errors

**Step 3: Test coverage API**

Run: `curl -X POST http://localhost:3000/api/projects/YOUR_PROJECT_ID/coverage -H "Cookie: YOUR_SESSION_COOKIE"`
Expected: Returns coverage data or auth error

**Step 4: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase2): complete Phase 2 Intelligence implementation

Phase 2 includes:
- Activity logging table and service
- Coverage calculation (convention-based)
- Coverage API endpoint
- Dashboard coverage card
- Dashboard activity card
- Claude Code plugin structure with hooks
- Quoth Badge output (Stop hook)
- Genesis skill for plugin

Resolves Phase 2 from quoth-evolution-design.md

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

This plan implements Phase 2 "Intelligence" features:

| Feature | Status | Files |
|---------|--------|-------|
| Activity Logging | Database + Service | `022_activity_logging.sql`, `activity.ts` |
| Coverage Calculation | Database + Service | `023_coverage_tracking.sql`, `coverage.ts` |
| Coverage API | Endpoint | `api/projects/[id]/coverage/route.ts` |
| Coverage UI | Component | `CoverageCard.tsx` |
| Activity API | Endpoint | `api/projects/[id]/activity/route.ts` |
| Activity UI | Component | `ActivityCard.tsx` |
| Plugin Structure | Manifest | `quoth-plugin/plugin.json` |
| SessionStart Hook | Hook | `hooks/session-start.md` |
| PreToolUse Hooks | Hooks | `hooks/pre-edit.md`, `hooks/pre-write.md` |
| PostToolUse Hooks | Hooks | `hooks/post-edit.md`, `hooks/post-write.md` |
| Stop Hook (Badge) | Hook | `hooks/stop.md` |
| Genesis Skill | Skill | `skills/genesis.md` |

**Total commits:** 20
**Estimated tasks:** 20 bite-sized tasks
