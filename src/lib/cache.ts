/**
 * Simple in-memory TTL cache.
 * No Redis needed — just a Map with expiry timestamps.
 */

const cache = new Map<string, { data: unknown; expiry: number }>();

/**
 * Get a cached value or compute it.
 * @param key   Cache key
 * @param ttlMs Time-to-live in milliseconds
 * @param fn    Factory function to compute the value on cache miss
 */
export function getCached<T>(key: string, ttlMs: number, fn: () => T): T {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && entry.expiry > now) return entry.data as T;
  const data = fn();
  cache.set(key, { data, expiry: now + ttlMs });
  return data;
}

/** Invalidate a specific cache key */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/** Invalidate all cache keys matching a prefix */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
