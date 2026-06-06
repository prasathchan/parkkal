/**
 * lib/rate-limit.ts
 *
 * Prevents brute-force attacks on login, OTP, and other sensitive endpoints.
 *
 * Works by storing request counts in memory (resets when the Worker restarts).
 * For a more persistent solution, use Cloudflare KV or Durable Objects.
 *
 * HOW TO USE:
 *   const result = await checkRateLimit("login:user@example.com", { limit: 5, windowMs: 60_000 });
 *   if (!result.allowed) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
 */
export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ── D1-backed global rate limiter ─────────────────────────────────────────────
// Uses the rate_limits table (migration 0007). Falls back to in-memory for
// local development where the D1 binding is unavailable.

async function getD1(): Promise<D1Database | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    return (ctx?.env?.DB as D1Database) ?? null;
  } catch {
    return null;
  }
}

async function checkD1RateLimit(
  db: D1Database,
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Reset the window if it has expired, then atomically increment.
  // The UPSERT + atomic UPDATE pattern avoids the read-then-write race condition
  // where two concurrent requests both read count=N and both pass the limit check.
  await db
    .prepare(
      "INSERT INTO rate_limits (key, count, window_start, updated_at) VALUES (?, 1, ?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET " +
      "  count = CASE WHEN window_start < ? THEN 1 ELSE count + 1 END, " +
      "  window_start = CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END, " +
      "  updated_at = excluded.updated_at"
    )
    .bind(key, now, now, windowStart, windowStart)
    .run();

  const row = await db
    .prepare("SELECT count, window_start FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number; window_start: number }>();

  const count = row?.count ?? 1;
  const windowBegin = row?.window_start ?? now;
  const resetAt = windowBegin + config.windowMs;

  return {
    allowed: count <= config.limit,
    remaining: Math.max(0, config.limit - count),
    resetAt,
  };
}

// ── In-memory fallback (local dev) ────────────────────────────────────────────
interface MemWindow { count: number; resetAt: number }
const memStore = new Map<string, MemWindow>();

function evictExpired(): void {
  const now = Date.now();
  for (const [k, win] of memStore) {
    if (win.resetAt <= now) memStore.delete(k);
  }
}

function checkMemRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  evictExpired();
  const now = Date.now();
  const win = memStore.get(key);
  if (!win || win.resetAt <= now) {
    const resetAt = now + config.windowMs;
    memStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.limit - 1, resetAt };
  }
  win.count += 1;
  return {
    allowed: win.count <= config.limit,
    remaining: Math.max(0, config.limit - win.count),
    resetAt: win.resetAt,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const db = await getD1();
  if (db) return checkD1RateLimit(db, key, config);
  return checkMemRateLimit(key, config);
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
