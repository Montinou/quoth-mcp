'use client';

/**
 * Health Dashboard Component
 * Visualizes documentation health metrics including staleness indicators
 * and documents needing attention
 */

import { useState, useEffect } from 'react';
import {
  Heart,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Info,
} from 'lucide-react';

// Types matching the API response structure
type StalenessLevel = 'fresh' | 'aging' | 'stale' | 'critical';

interface DocumentHealth {
  documentId: string;
  title: string;
  filePath: string;
  staleness: {
    level: StalenessLevel;
    daysStale: number;
    lastUpdated: string;
    suggestedAction?: string;
  };
  lastReadCount: number;
  searchHitRate: number;
}

interface ProjectHealthSummary {
  totalDocs: number;
  freshDocs: number;
  agingDocs: number;
  staleDocs: number;
  criticalDocs: number;
  overallScore: number;
  documents: DocumentHealth[];
}

interface HealthDashboardProps {
  projectId: string;
}

// Staleness color mapping
const STALENESS_COLORS: Record<StalenessLevel, { bg: string; text: string; border: string }> = {
  fresh: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  aging: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
  },
  stale: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  critical: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
};

// Staleness labels
const STALENESS_LABELS: Record<StalenessLevel, string> = {
  fresh: 'Fresh',
  aging: 'Aging',
  stale: 'Stale',
  critical: 'Critical',
};

export function HealthDashboard({ projectId }: HealthDashboardProps) {
  const [health, setHealth] = useState<ProjectHealthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  const fetchHealthData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/health`);
      if (!res.ok) throw new Error('Failed to fetch health data');
      const data = await res.json();
      setHealth(data.health);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, [projectId]);

  // Get score color based on health score
  const getScoreColor = (score: number): string => {
    if (score > 80) return 'text-emerald-400';
    if (score > 60) return 'text-yellow-400';
    if (score > 40) return 'text-orange-400';
    return 'text-red-400';
  };

  // Get score background for the gauge
  const getScoreGradient = (score: number): string => {
    if (score > 80) return 'from-emerald-500 to-emerald-400';
    if (score > 60) return 'from-yellow-500 to-yellow-400';
    if (score > 40) return 'from-orange-500 to-orange-400';
    return 'from-red-500 to-red-400';
  };

  // Get icon for staleness level
  const getStalenessIcon = (level: StalenessLevel) => {
    switch (level) {
      case 'fresh':
        return <CheckCircle className="w-4 h-4" />;
      case 'aging':
        return <Clock className="w-4 h-4" />;
      case 'stale':
        return <AlertCircle className="w-4 h-4" />;
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="glass-panel rounded-2xl p-6 animate-pulse">
        <div className="h-6 bg-charcoal rounded w-1/3 mb-4" />
        <div className="flex gap-6 mb-6">
          <div className="h-32 w-32 bg-charcoal rounded-full" />
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-charcoal rounded w-3/4" />
            <div className="h-4 bg-charcoal rounded w-1/2" />
            <div className="h-4 bg-charcoal rounded w-2/3" />
          </div>
        </div>
        <div className="h-24 bg-charcoal rounded" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-red-500/15">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Health Dashboard</h3>
        </div>
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchHealthData}
          className="mt-4 flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg
            bg-violet-spectral/20 text-violet-ghost hover:bg-violet-spectral/30
            border border-violet-spectral/30 transition-all duration-300"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  // No data state
  if (!health || health.totalDocs === 0) {
    return (
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-violet-spectral/15">
            <Heart className="w-5 h-5 text-violet-spectral" />
          </div>
          <h3 className="text-lg font-bold text-white">Documentation Health</h3>
        </div>
        <div className="text-center py-8">
          <div className="inline-flex p-3 rounded-2xl bg-violet-spectral/10 mb-3">
            <FileText className="w-6 h-6 text-violet-spectral" />
          </div>
          <p className="text-gray-400 mb-2">No documents yet</p>
          <p className="text-sm text-gray-500">
            Add documentation to track health metrics
          </p>
        </div>
      </div>
    );
  }

  // Calculate percentage for distribution bar
  const total = health.totalDocs;
  const freshPercent = (health.freshDocs / total) * 100;
  const agingPercent = (health.agingDocs / total) * 100;
  const stalePercent = (health.staleDocs / total) * 100;
  const criticalPercent = (health.criticalDocs / total) * 100;

  // Documents needing attention (stale + critical)
  const documentsNeedingAttention = health.documents.filter(
    (d) => d.staleness.level === 'stale' || d.staleness.level === 'critical'
  );

  return (
    <div className="glass-panel rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-spectral/15">
            <Heart className="w-5 h-5 text-violet-spectral" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Documentation Health</h3>
            <p className="text-sm text-gray-500">{health.totalDocs} documents tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="p-2 rounded-lg hover:bg-charcoal/50 transition-colors"
            title="Show staleness legend"
          >
            <Info className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={fetchHealthData}
            className="p-2 rounded-lg hover:bg-charcoal/50 transition-colors"
            title="Refresh health data"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Legend (collapsible) */}
      {showLegend && (
        <div className="mb-6 p-4 rounded-xl bg-charcoal/50 border border-white/5">
          <h4 className="text-sm font-semibold text-white mb-3">Staleness Thresholds</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-gray-400">Fresh: &lt;14 days</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="text-gray-400">Aging: 14-30 days</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-400" />
              <span className="text-gray-400">Stale: 30-60 days</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <span className="text-gray-400">Critical: &gt;60 days</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Score + Distribution */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6">
        {/* Health Score Gauge */}
        <div className="flex flex-col items-center">
          <div className="relative w-32 h-32">
            {/* Background circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-charcoal"
              />
              {/* Progress circle */}
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="url(#healthGradient)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(health.overallScore / 100) * 352} 352`}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop
                    offset="0%"
                    className={
                      health.overallScore > 80
                        ? 'text-emerald-500'
                        : health.overallScore > 60
                          ? 'text-yellow-500'
                          : health.overallScore > 40
                            ? 'text-orange-500'
                            : 'text-red-500'
                    }
                    stopColor="currentColor"
                  />
                  <stop
                    offset="100%"
                    className={
                      health.overallScore > 80
                        ? 'text-emerald-400'
                        : health.overallScore > 60
                          ? 'text-yellow-400'
                          : health.overallScore > 40
                            ? 'text-orange-400'
                            : 'text-red-400'
                    }
                    stopColor="currentColor"
                  />
                </linearGradient>
              </defs>
            </svg>
            {/* Score text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${getScoreColor(health.overallScore)}`}>
                {health.overallScore}
              </span>
              <span className="text-xs text-gray-500">Health</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-2 text-center">
            {health.overallScore > 80
              ? 'Excellent'
              : health.overallScore > 60
                ? 'Good'
                : health.overallScore > 40
                  ? 'Needs Work'
                  : 'Critical'}
          </p>
        </div>

        {/* Staleness Distribution */}
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-white mb-3">Staleness Distribution</h4>

          {/* Distribution Bar */}
          <div className="h-6 rounded-full overflow-hidden flex bg-charcoal mb-4">
            {health.freshDocs > 0 && (
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${freshPercent}%` }}
                title={`Fresh: ${health.freshDocs}`}
              />
            )}
            {health.agingDocs > 0 && (
              <div
                className="bg-yellow-500 transition-all duration-500"
                style={{ width: `${agingPercent}%` }}
                title={`Aging: ${health.agingDocs}`}
              />
            )}
            {health.staleDocs > 0 && (
              <div
                className="bg-orange-500 transition-all duration-500"
                style={{ width: `${stalePercent}%` }}
                title={`Stale: ${health.staleDocs}`}
              />
            )}
            {health.criticalDocs > 0 && (
              <div
                className="bg-red-500 transition-all duration-500"
                style={{ width: `${criticalPercent}%` }}
                title={`Critical: ${health.criticalDocs}`}
              />
            )}
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 rounded-xl bg-charcoal/50 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-gray-500">Fresh</span>
              </div>
              <span className="text-xl font-bold text-emerald-400">{health.freshDocs}</span>
            </div>
            <div className="p-3 rounded-xl bg-charcoal/50 border border-yellow-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-gray-500">Aging</span>
              </div>
              <span className="text-xl font-bold text-yellow-400">{health.agingDocs}</span>
            </div>
            <div className="p-3 rounded-xl bg-charcoal/50 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-gray-500">Stale</span>
              </div>
              <span className="text-xl font-bold text-orange-400">{health.staleDocs}</span>
            </div>
            <div className="p-3 rounded-xl bg-charcoal/50 border border-red-500/20">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-gray-500">Critical</span>
              </div>
              <span className="text-xl font-bold text-red-400">{health.criticalDocs}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Needing Attention */}
      {documentsNeedingAttention.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-warning" />
            <h4 className="text-sm font-semibold text-white">
              Documents Needing Attention
            </h4>
            <span className="text-xs text-gray-500">
              ({documentsNeedingAttention.length})
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {documentsNeedingAttention.map((doc) => {
              const colors = STALENESS_COLORS[doc.staleness.level];
              return (
                <div
                  key={doc.documentId}
                  className={`flex items-center justify-between p-3 rounded-xl bg-charcoal/50
                    border ${colors.border} hover:bg-charcoal/70 transition-colors group`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-lg ${colors.bg}`}>
                      {getStalenessIcon(doc.staleness.level)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-300 font-medium truncate">
                        {doc.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate max-w-[300px]">
                        {doc.filePath}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                        {STALENESS_LABELS[doc.staleness.level]}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {doc.staleness.daysStale} days ago
                      </p>
                    </div>
                    <a
                      href={`/dashboard/documents/${doc.documentId}`}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100
                        hover:bg-charcoal transition-all"
                      title="View document"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {documentsNeedingAttention[0]?.staleness.suggestedAction && (
            <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Suggested: {documentsNeedingAttention[0]?.staleness.suggestedAction}
            </p>
          )}
        </div>
      )}

      {/* All healthy state */}
      {documentsNeedingAttention.length === 0 && (
        <div className="text-center py-4 border-t border-white/5">
          <div className="flex items-center justify-center gap-2 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">All documents are up to date</span>
          </div>
        </div>
      )}
    </div>
  );
}
