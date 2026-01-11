# Phase 6: UI Features

**Status:** 🔴 Not Started  
**Risk Level:** Low (new features)  
**Estimated Time:** 2-3 hours  
**Dependencies:** Phases 1-5 complete

---

## Overview

Add new UI features for users to search and view their team's vectorized documentation:

1. **Knowledge Base Search Page** - Semantic search UI
2. **Document Detail Page** - View content with version history
3. **Rollback Functionality** - Restore previous versions (admin only)

---

## Files to Create

### [NEW] src/app/knowledge-base/page.tsx

**Knowledge Base Search Page:**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, Clock, Tag } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  path: string;
  snippet: string;
  relevance: number;
  type: 'pattern' | 'architecture' | 'contract' | 'meta';
  version: number;
  lastUpdated: string;
}

export default function KnowledgeBasePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge-base/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-2">Knowledge Base</h1>
      <p className="text-muted-foreground mb-8">
        Search your team's documentation using semantic AI-powered search
      </p>

      {/* Search Input */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search documentation..."
          className="w-full pl-12 pr-4 py-4 rounded-xl border bg-background"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 
                     bg-primary text-primary-foreground rounded-lg"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results */}
      <div className="grid gap-4">
        {results.map((result) => (
          <div
            key={result.id}
            onClick={() => router.push(`/knowledge-base/${result.id}`)}
            className="p-6 rounded-xl border bg-card hover:shadow-lg cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <FileText className="text-primary" />
                <div>
                  <h3 className="font-semibold">{result.title}</h3>
                  <p className="text-sm text-muted-foreground">{result.path}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 text-xs rounded-full bg-primary/10">
                  {Math.round(result.relevance * 100)}% match
                </span>
                <span className="px-2 py-1 text-xs rounded-full bg-secondary">
                  v{result.version}
                </span>
              </div>
            </div>
            <p className="mt-4 text-muted-foreground line-clamp-2">{result.snippet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### [NEW] src/app/knowledge-base/[id]/page.tsx

**Document Detail Page with History:**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, RotateCcw, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface DocumentVersion {
  id: string;
  version: number;
  content: string;
  archivedAt: string;
}

interface DocumentData {
  id: string;
  title: string;
  content: string;
  version: number;
  lastUpdated: string;
  path: string;
  history: DocumentVersion[];
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);

  useEffect(() => {
    fetchDocument();
  }, [params.id]);

  const fetchDocument = async () => {
    const res = await fetch(`/api/knowledge-base/${params.id}`);
    const data = await res.json();
    setDoc(data);
    setLoading(false);
  };

  const handleRollback = async (historyId: string) => {
    if (!confirm('Restore this version?')) return;
    await fetch(`/api/knowledge-base/${params.id}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ historyId }),
    });
    await fetchDocument();
    setViewingVersion(null);
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!doc) return <div className="p-8">Not found</div>;

  const displayContent = viewingVersion 
    ? doc.history.find(h => h.version === viewingVersion)?.content || doc.content
    : doc.content;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <button onClick={() => router.back()} className="flex items-center gap-2 mb-6">
        <ArrowLeft size={18} /> Back
      </button>

      <div className="flex justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{doc.title}</h1>
          <p className="text-muted-foreground">{doc.path}</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary h-fit">
          Version {viewingVersion || doc.version}
        </span>
      </div>

      {/* History Toggle */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border mb-6"
      >
        <Clock size={18} />
        History ({doc.history.length})
        <ChevronDown className={showHistory ? 'rotate-180' : ''} />
      </button>

      {showHistory && (
        <div className="border rounded-xl mb-6">
          {doc.history.map((v) => (
            <div key={v.id} className="flex justify-between p-4 border-b last:border-0">
              <span>Version {v.version} - {new Date(v.archivedAt).toLocaleString()}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewingVersion(viewingVersion === v.version ? null : v.version)}
                  className="px-3 py-1 text-sm border rounded-lg"
                >
                  {viewingVersion === v.version ? 'Hide' : 'View'}
                </button>
                <button
                  onClick={() => handleRollback(v.id)}
                  className="px-3 py-1 text-sm bg-primary text-white rounded-lg flex items-center gap-1"
                >
                  <RotateCcw size={14} /> Restore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <article className="prose dark:prose-invert max-w-none">
        <ReactMarkdown>{displayContent}</ReactMarkdown>
      </article>
    </div>
  );
}
```

---

### [NEW] src/app/api/knowledge-base/search/route.ts

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { searchDocuments } from '@/lib/quoth/search';

export async function POST(request: Request) {
  const authSupabase = await createServerSupabaseClient();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: membership } = await authSupabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) return Response.json({ error: 'No access' }, { status: 403 });

  const { query } = await request.json();
  const results = await searchDocuments(query, membership.project_id);
  return Response.json({ results });
}
```

---

### [NEW] src/app/api/knowledge-base/[id]/route.ts

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authSupabase = await createServerSupabaseClient();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: doc } = await supabase.from('documents').select('*').eq('id', id).single();
  if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });

  const { data: history } = await supabase
    .from('document_history')
    .select('id, version, content, archived_at')
    .eq('document_id', id)
    .order('version', { ascending: false });

  return Response.json({
    ...doc,
    lastUpdated: doc.last_updated,
    history: (history || []).map(h => ({
      id: h.id, version: h.version, content: h.content, archivedAt: h.archived_at
    })),
  });
}
```

---

### [NEW] src/app/api/knowledge-base/[id]/rollback/route.ts

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabase } from '@/lib/supabase';
import { syncDocument } from '@/lib/sync';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authSupabase = await createServerSupabaseClient();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { historyId } = await request.json();
  const { data: doc } = await supabase.from('documents').select('*').eq('id', id).single();
  if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });

  // Check admin
  const { data: membership } = await authSupabase
    .from('project_members')
    .select('role')
    .eq('project_id', doc.project_id)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  const { data: historyVersion } = await supabase
    .from('document_history')
    .select('content, title')
    .eq('id', historyId)
    .single();

  if (!historyVersion) return Response.json({ error: 'Version not found' }, { status: 404 });

  await syncDocument(doc.project_id, doc.file_path, historyVersion.title, historyVersion.content);
  return Response.json({ success: true });
}
```

---

## Checklist

- [ ] Create `src/app/knowledge-base/page.tsx`
- [ ] Create `src/app/knowledge-base/[id]/page.tsx`
- [ ] Create `src/app/api/knowledge-base/search/route.ts`
- [ ] Create `src/app/api/knowledge-base/[id]/route.ts`
- [ ] Create `src/app/api/knowledge-base/[id]/rollback/route.ts`
- [ ] Add navigation link to Knowledge Base
- [ ] Install `react-markdown` if not present: `npm install react-markdown`
- [ ] Run `npm run build` - no errors
- [ ] Test search functionality manually
- [ ] Test document view with history
- [ ] Test rollback
- [ ] Update [status.md](./status.md) - mark Phase 6 complete
- [ ] Commit changes: `git commit -m "Phase 6: Knowledge Base UI features"`

---

## Implementation Complete! 🎉

After completing Phase 6, the Quoth Genesis Strategy implementation is complete.
