/**
 * Simple in-memory rate limiter using sliding window.
 * 
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
 *   if (!limiter.check(key)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterOptions {
  /** Window duration in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  max: number;
}

interface RateLimiter {
  /** Check if request is allowed. Returns true if allowed, false if rate limited. */
  check(key: string): boolean;
  /** Reset a specific key */
  reset(key: string): void;
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup every 5 minutes to avoid memory leaks
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    // Remove entries older than 10 minutes (covers any reasonable window)
    const cutoff = now - 10 * 60 * 1000;
    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter(t => t > cutoff);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  // Don't block process exit
  if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref();
  }
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  ensureCleanup();
  const { windowMs, max } = options;

  return {
    check(key: string): boolean {
      const now = Date.now();
      const windowStart = now - windowMs;

      let entry = store.get(key);
      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter(t => t > windowStart);

      if (entry.timestamps.length >= max) {
        return false; // Rate limited
      }

      entry.timestamps.push(now);
      return true; // Allowed
    },

    reset(key: string): void {
      store.delete(key);
    },
  };
}

// Pre-configured limiters for key routes
export const registerLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
export const inviteValidateLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
export const uploadLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
export const createAssetLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
export const searchLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

/** Helper to extract client IP from request */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/** Standard 429 response */
export function rateLimitResponse(): Response {
  return new Response(
    JSON.stringify({ success: false, error: 'Too many requests. Please try again later.' }),
    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
  );
}
