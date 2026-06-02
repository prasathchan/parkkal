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

  const row = await db
    .prepare("SELECT count, window_start FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number; window_start: number }>();

  let count: number;
  let windowBegin: number;

  if (!row || row.window_start < windowStart) {
    count = 1;
    windowBegin = now;
    await db
      .prepare(
        "INSERT INTO rate_limits (key, count, window_start, updated_at) VALUES (?, 1, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start, updated_at = excluded.updated_at"
      )
      .bind(key, now, now)
      .run();
  } else {
    count = row.count + 1;
    windowBegin = row.window_start;
    await db
      .prepare("UPDATE rate_limits SET count = ?, updated_at = ? WHERE key = ?")
      .bind(count, now, key)
      .run();
  }

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

function checkMemRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
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
