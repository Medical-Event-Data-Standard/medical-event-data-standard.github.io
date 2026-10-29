import axios from 'axios';

const CACHE_TTL_MS = 15 * 60 * 1000;

async function fetchUrl<T = unknown>(url: string): Promise<T | null> {
  try {
    const res = await axios.get<T>(url);
    return res.data;
  } catch (err) {
    console.error(`Failed to fetch data from ${url}:`, err);
    return null;
  }
}

function readCache<T = unknown>(
  key: string,
  cacheLifetimeMs: number = CACHE_TTL_MS
): { data: T | null; isFresh: boolean } {
  const cached = localStorage.getItem(key);
  if (!cached) return { data: null, isFresh: false };

  try {
    const { data, timestamp } = JSON.parse(cached);
    return {
      data: data ?? null,
      isFresh: Date.now() - timestamp < cacheLifetimeMs,
    };
  } catch (err) {
    console.warn(`Cache read for ${key} failed: ${err}. Clearing...`);
    localStorage.removeItem(key);
    return { data: null, isFresh: false };
  }
}

function writeCache(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (err) {
    // Storage may be full or disabled; serving the fetched data still works.
    console.warn(`Cache write for ${key} failed: ${err}`);
  }
}

/**
 * Return the cached value for `url` while it is fresh, otherwise fetch it.
 *
 * Only successful fetches are cached. A failed fetch (network error, 404 for a
 * feed that is not published yet, ...) returns stale cached data when there is
 * any and `null` otherwise, and the next call retries the request instead of
 * serving the failure for the rest of the cache lifetime.
 */
export async function readOrFetchToCache<T = unknown>(
  url: string,
  cacheKey: string | null = null,
  cacheLifetimeMs: number = CACHE_TTL_MS
): Promise<T | null> {
  const localCacheKey = cacheKey || url;

  const { data, isFresh } = readCache<T>(localCacheKey, cacheLifetimeMs);

  if (isFresh && data !== null) return data;

  const result = await fetchUrl<T>(url);
  if (result === null) {
    if (data !== null) {
      console.warn(`Using stale cached data for ${localCacheKey}`);
      return data;
    }
    return null;
  }

  writeCache(localCacheKey, result);
  return result;
}
