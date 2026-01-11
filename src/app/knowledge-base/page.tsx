'use client';

/**
 * Knowledge Base Search Page
 * Semantic search UI for team documentation
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, Clock } from 'lucide-react';

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
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/knowledge-base/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Search failed');
        return;
      }
      setResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-graphite">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-3xl font-bold text-white mb-2">Knowledge Base</h1>
        <p className="text-graphite mb-8">
          Search your team's documentation using semantic AI-powered search
        </p>

        {/* Search Input */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-graphite" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search documentation..."
            className="w-full pl-12 pr-32 py-4 rounded-xl border border-charcoal bg-charcoal text-white placeholder:text-graphite focus:border-violet-spectral outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 
                       bg-violet-spectral hover:bg-violet-glow text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Results */}
        <div className="grid gap-4">
          {results.map((result) => (
            <div
              key={result.id}
              onClick={() => router.push(`/knowledge-base/${result.id}`)}
              className="p-6 rounded-xl border border-charcoal bg-charcoal/50 hover:bg-charcoal hover:border-violet-spectral/50 cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="text-violet-spectral" />
                  <div>
                    <h3 className="font-semibold text-white">{result.title}</h3>
                    <p className="text-sm text-graphite">{result.path}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-violet-spectral/20 text-violet-glow">
                    {Math.round(result.relevance * 100)}% match
                  </span>
                  <span className="px-2 py-1 text-xs rounded-full bg-charcoal text-graphite">
                    v{result.version}
                  </span>
                </div>
              </div>
              {result.snippet && (
                <p className="mt-4 text-graphite line-clamp-2">{result.snippet}</p>
              )}
              {result.lastUpdated && (
                <div className="mt-2 flex items-center gap-1 text-xs text-graphite">
                  <Clock size={12} />
                  <span>{new Date(result.lastUpdated).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          ))}

          {results.length === 0 && query && !loading && !error && (
            <div className="text-center py-12 text-graphite">
              No results found for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
