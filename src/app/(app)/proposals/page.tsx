'use client';

/**
 * Proposals Dashboard - List View
 * Displays all documentation update proposals with filters
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Proposal {
  id: string;
  file_path: string;
  reasoning: string;
  status: string;
  created_at: string;
  document_title: string;
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProposals();
  }, [filter]);

  async function fetchProposals() {
    setLoading(true);
    try {
      const url = filter === 'all'
        ? '/api/proposals'
        : `/api/proposals?status=${filter}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch proposals');

      const data = await res.json();
      setProposals(data.proposals || []);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    approved: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    applied: 'bg-green-500/10 text-green-400 border-green-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20'
  };

  const statusCounts = proposals.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="px-6 py-8 md:pt-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold font-cinzel mb-2">
            Documentation Proposals
          </h1>
          <p className="text-gray-400">
            Review and approve AI-proposed documentation updates
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Total</h3>
              <svg className="w-5 h-5 text-violet-spectral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-3xl font-bold">{proposals.length}</p>
          </div>
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Pending</h3>
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-yellow-400">{statusCounts['pending'] || 0}</p>
          </div>
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Applied</h3>
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-green-400">{statusCounts['applied'] || 0}</p>
          </div>
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Rejected</h3>
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-red-400">{statusCounts['rejected'] || 0}</p>
          </div>
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Approved</h3>
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-blue-400">{statusCounts['approved'] || 0}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-3 mb-8">
          {['all', 'pending', 'approved', 'applied', 'rejected', 'error'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg transition-colors font-medium text-sm ${
                filter === status
                  ? 'bg-violet-spectral text-white'
                  : 'glass-panel text-gray-400 hover:text-white hover:border-violet-spectral/40'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Proposals List */}
        {loading ? (
          <div className="glass-panel p-12 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-violet-spectral border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400">Loading proposals...</span>
            </div>
          </div>
        ) : proposals.length === 0 ? (
          <div className="glass-panel p-12 text-center">
            <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-400 mb-4">No proposals found</p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="text-violet-spectral hover:text-violet-glow transition-colors text-sm"
              >
                View all proposals →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map(proposal => (
              <Link
                key={proposal.id}
                href={`/proposals/${proposal.id}`}
                className="glass-panel p-6 block hover:border-violet-spectral/40 transition-all group"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-xl font-bold group-hover:text-violet-ghost transition-colors">
                    {proposal.document_title || proposal.file_path}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs border ${statusColors[proposal.status]}`}>
                    {proposal.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  <code className="bg-charcoal px-2 py-1 rounded text-gray-400">{proposal.file_path}</code>
                </p>
                <p className="text-gray-400 line-clamp-2">
                  {proposal.reasoning}
                </p>
                <p className="text-xs text-gray-500 mt-4">
                  Created {new Date(proposal.created_at).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
