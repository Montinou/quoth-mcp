/**
 * SWR Configuration and Fetcher Utility
 * Provides shared fetcher and cache configuration for SWR
 */

/**
 * Default fetcher for SWR
 * Throws on non-OK responses for proper error handling
 */
export const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Failed to fetch data');
    // Attach status code for error handling
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
  return res.json();
};

/**
 * Fetcher with JSON body for POST requests
 */
export const postFetcher = async <T, B = unknown>(
  url: string,
  body: B
): Promise<T> => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = new Error('Failed to fetch data');
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
  return res.json();
};

/**
 * Default SWR configuration options
 * - revalidateOnFocus: re-fetch when window regains focus
 * - dedupingInterval: dedupe requests within 2 seconds
 */
export const swrConfig = {
  revalidateOnFocus: true,
  dedupingInterval: 2000,
  errorRetryCount: 3,
  errorRetryInterval: 1000,
};
