import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase module before importing health
vi.mock('../../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  },
}));

import { calculateStaleness, StalenessLevel } from '../health';

describe('document health', () => {
  it('should classify recently updated docs as fresh', () => {
    const lastUpdated = new Date();
    lastUpdated.setDate(lastUpdated.getDate() - 5); // 5 days ago

    const result = calculateStaleness(lastUpdated);
    expect(result.level).toBe('fresh');
    expect(result.daysStale).toBe(5);
  });

  it('should classify 14+ day old docs as aging', () => {
    const lastUpdated = new Date();
    lastUpdated.setDate(lastUpdated.getDate() - 20); // 20 days ago

    const result = calculateStaleness(lastUpdated);
    expect(result.level).toBe('aging');
    expect(result.daysStale).toBe(20);
  });

  it('should classify 30+ day old docs as stale', () => {
    const lastUpdated = new Date();
    lastUpdated.setDate(lastUpdated.getDate() - 45); // 45 days ago

    const result = calculateStaleness(lastUpdated);
    expect(result.level).toBe('stale');
    expect(result.daysStale).toBe(45);
  });

  it('should classify 60+ day old docs as critical', () => {
    const lastUpdated = new Date();
    lastUpdated.setDate(lastUpdated.getDate() - 100); // 100 days ago

    const result = calculateStaleness(lastUpdated);
    expect(result.level).toBe('critical');
    expect(result.daysStale).toBe(100);
  });

  it('should handle string date input', () => {
    const date = new Date();
    date.setDate(date.getDate() - 10);
    const result = calculateStaleness(date.toISOString());
    expect(result.level).toBe('fresh');
    expect(result.daysStale).toBe(10);
  });

  it('should provide suggested actions for aging and above', () => {
    // Fresh - no suggestion
    const fresh = calculateStaleness(new Date());
    expect(fresh.suggestedAction).toBeUndefined();

    // Aging - review for accuracy
    const agingDate = new Date();
    agingDate.setDate(agingDate.getDate() - 20);
    const aging = calculateStaleness(agingDate);
    expect(aging.suggestedAction).toBe('Review for accuracy');

    // Stale - update recommended
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 45);
    const stale = calculateStaleness(staleDate);
    expect(stale.suggestedAction).toBe('Update recommended');

    // Critical - urgent update required
    const criticalDate = new Date();
    criticalDate.setDate(criticalDate.getDate() - 100);
    const critical = calculateStaleness(criticalDate);
    expect(critical.suggestedAction).toBe('Urgent update required');
  });
});
