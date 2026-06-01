/**
 * In-memory sliding-window rate limiter.
 * Works per-process (Cloudflare Workers: per isolate instance).
 * For multi-region production, replace the store with Workers KV or D1.
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();
const CLEANUP_INTERVAL = 60_000; // evict expired entries every minute

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, win] of store) {
      if (win.resetAt < now) store.delete(key);
    }
  }, CLEANUP_INTERVAL);
  // Don't keep the process alive for this alone (Node.js)
  if (typeof cleanupTimer === "object" && cleanupTimer !== null && "unref" in cleanupTimer) {
    (cleanupTimer as { unref(): void }).unref();
  }
}

export interface RateLimitConfig {
  /** Maximum requests allowed within the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check (and record) a request against the rate limit for a given key.
 * Key is typically the client IP + endpoint identifier.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  ensureCleanup();

  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    // Fresh window
    const win: Window = { count: 1, resetAt: now + config.windowMs };
    store.set(key, win);
    return { allowed: true, remaining: config.limit - 1, resetAt: win.resetAt };
  }

  existing.count++;
  const allowed = existing.count <= config.limit;
  return {
    allowed,
    remaining: Math.max(0, config.limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/**
 * Extract client IP from Next.js/Cloudflare request headers.
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
