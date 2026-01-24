/**
 * LRU Cache Utility
 * Provides cross-request caching for API routes
 */

import { LRUCache } from 'lru-cache';

/**
 * Create a typed LRU cache with configurable options
 */
export function createCache<T extends object>(options?: { max?: number; ttl?: number }) {
  return new LRUCache<string, T>({
    max: options?.max ?? 500,
    ttl: options?.ttl ?? 5 * 60 * 1000, // 5 minutes default
  });
}

// Pre-configured caches for common patterns
// These caches persist across requests in serverless functions (warm starts)

/**
 * Cache for project health data
 * Short TTL (1 minute) since health can change frequently
 */
export const projectHealthCache = createCache<Record<string, unknown>>({ ttl: 60 * 1000 });

/**
 * Cache for coverage data
 * Medium TTL (2 minutes) since coverage changes less frequently
 */
export const coverageCache = createCache<Record<string, unknown>>({ ttl: 2 * 60 * 1000 });

/**
 * Cache for search results
 * Medium TTL (3 minutes) since document content is relatively stable
 */
export const searchCache = createCache<Record<string, unknown>>({ ttl: 3 * 60 * 1000 });

/**
 * Cache key generator for consistent cache keys
 */
export function cacheKey(prefix: string, ...args: (string | number)[]): string {
  return `${prefix}:${args.join(':')}`;
}
