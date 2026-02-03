'use client';

/**
 * Coverage Card Component
 * Displays actual embedding coverage and document distribution by type.
 * Coverage = documents with embeddings / total documents.
 * Categories are dynamic — pulled from actual doc_type values in the database.
 */

import { useState } from 'react';
import {
  PieChart,
  RefreshCw,
  FileText,
  Layers,
  Code2,
  ShieldCheck,
  BookOpen,
  HelpCircle,
  ScrollText,
  Puzzle,
  Database,
} from 'lucide-react';

interface CoverageBreakdown {
  [category: string]: { count: number };
}

interface CoverageData {
  coveragePercentage: number;
  totalDocuments: number;
  docsWithEmbeddings?: number;
  totalChunks?: number;
  categorizedDocuments: number;
  breakdown: CoverageBreakdown;
}

interface CoverageCardProps {
  projectId: string;
  initialCoverage?: CoverageData | null;
}

/**
 * Get display config for known category keys, with a sensible fallback.
 */
function getCategoryConfig(key: string): {
  label: string;
  icon: typeof FileText;
  color: string;
  barColor: string;
} {
  const configs: Record<string, { label: string; icon: typeof FileText; color: string; barColor: string }> = {
    architecture: {
      label: 'Architecture',
      icon: Layers,
      color: 'text-violet-spectral',
      barColor: 'bg-violet-spectral',
    },
    testing_pattern: {
      label: 'Testing Patterns',
      icon: Code2,
      color: 'text-blue-400',
      barColor: 'bg-blue-400',
    },
    contract: {
      label: 'Contracts',
      icon: ShieldCheck,
      color: 'text-emerald-muted',
      barColor: 'bg-emerald-muted',
    },
    meta: {
      label: 'Meta',
      icon: BookOpen,
      color: 'text-amber-warning',
      barColor: 'bg-amber-warning',
    },
    rules: {
      label: 'Rules',
      icon: ScrollText,
      color: 'text-orange-400',
      barColor: 'bg-orange-400',
    },
    patterns: {
      label: 'Patterns',
      icon: Puzzle,
      color: 'text-cyan-400',
      barColor: 'bg-cyan-400',
    },
    reference: {
      label: 'Reference',
      icon: Database,
      color: 'text-indigo-400',
      barColor: 'bg-indigo-400',
    },
    template: {
      label: 'Templates',
      icon: FileText,
      color: 'text-pink-400',
      barColor: 'bg-pink-400',
    },
    uncategorized: {
      label: 'Uncategorized',
      icon: HelpCircle,
      color: 'text-gray-500',
      barColor: 'bg-gray-500',
    },
  };

  return configs[key] || {
    label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    icon: FileText,
    color: 'text-gray-400',
    barColor: 'bg-gray-400',
  };
}

export function CoverageCard({ projectId, initialCoverage }: CoverageCardProps) {
  const [coverage, setCoverage] = useState<CoverageData | null>(initialCoverage || null);
  const [isLoading, setIsLoading] = useState(false);
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

  const totalDocs = coverage?.totalDocuments ?? 0;
  const docsWithEmb = coverage?.docsWithEmbeddings ?? coverage?.categorizedDocuments ?? 0;
  const totalChunks = coverage?.totalChunks ?? 0;

  // Sort breakdown: uncategorized last, rest by count descending
  const sortedBreakdown = coverage
    ? Object.entries(coverage.breakdown).sort(([keyA, a], [keyB, b]) => {
        if (keyA === 'uncategorized') return 1;
        if (keyB === 'uncategorized') return -1;
        return b.count - a.count;
      })
    : [];

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
            <p className="text-sm text-gray-500">Embedding coverage &amp; document categories</p>
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
          <div className={isLoading ? 'animate-spin' : ''}>
            <RefreshCw className="w-4 h-4" />
          </div>
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
                {docsWithEmb} of {totalDocs} docs with embeddings
                {totalChunks > 0 && ` · ${totalChunks} chunks`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-charcoal overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(coverage.coveragePercentage)}`}
                style={{ width: `${coverage.coveragePercentage}%` }}
              />
            </div>
            {coverage.breakdown.uncategorized && coverage.breakdown.uncategorized.count > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                {coverage.breakdown.uncategorized.count} document{coverage.breakdown.uncategorized.count !== 1 ? 's' : ''} without a doc_type — consider categorizing them
              </p>
            )}
          </div>

          {/* Category Breakdown */}
          <div className="space-y-3">
            {sortedBreakdown.map(([key, value]) => {
              if (value.count === 0) return null;
              const config = getCategoryConfig(key);
              const Icon = config.icon;
              const percentage = totalDocs > 0 ? (value.count / totalDocs) * 100 : 0;

              return (
                <div key={key} className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${config.color} shrink-0`} />
                  <span className="text-sm text-gray-400 w-36 truncate">
                    {config.label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-charcoal overflow-hidden">
                    <div
                      className={`h-full rounded-full ${config.barColor}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right font-mono">
                    {value.count}
                  </span>
                </div>
              );
            })}
          </div>
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
