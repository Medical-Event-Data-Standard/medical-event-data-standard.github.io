import axios from 'axios';

const CACHE_TTL_MS = 15 * 60 * 1000; // 0 mins — disabled cache

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
      data,
      isFresh: Date.now() - timestamp < cacheLifetimeMs,
    };
  } catch (err) {
    console.warn(`Cache read for ${key} failed: ${err}. Clearing...`);
    localStorage.removeItem(key);
    return { data: null, isFresh: false };
  }
}

export async function readOrFetchToCache<T = unknown>(
  url: string,
  cacheKey: string | null = null,
  cacheLifetimeMs: number = CACHE_TTL_MS
): Promise<T | null> {
  const localCacheKey = cacheKey || url;

  const { data, isFresh } = readCache<T>(localCacheKey, cacheLifetimeMs);

  if (isFresh) return data;

  try {
    const result = await fetchUrl<T>(url);
    localStorage.setItem(localCacheKey, JSON.stringify({ data: result, timestamp: Date.now() }));
    return result;
  } catch (err) {
    console.warn(`Failed to fetch ${url}:`, err);
    if (data) {
      console.warn(`Using stale cached data for ${localCacheKey}`);
      return data;
    }
    throw new Error(`Failed to fetch ${url} and no cached data available.`);
  }
}
