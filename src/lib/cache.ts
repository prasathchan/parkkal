/**
 * lib/cache.ts
 *
 * Lightweight KV-backed cache for hot, rarely-changing data.
 *
 * ─── USE CASES ────────────────────────────────────────────────────────────────
 *   • org:profile:{orgId}  — organisation row (read on every settings page)
 *   • org:roles:{orgId}    — org role list (read on every permission check)
 *
 * ─── HOW IT WORKS ─────────────────────────────────────────────────────────────
 *   getCached(key, ttl, fetchFn) checks KV for a cached value.
 *   On miss (or local dev), it calls fetchFn(), stores the result, and returns it.
 *   invalidateCache(key) deletes the key so the next request re-fetches from D1.
 *
 *   In local development the KV binding is not available; the function falls
 *   through to fetchFn() every time (no caching, no errors).
 *
 * ─── CACHE INVALIDATION ───────────────────────────────────────────────────────
 *   Call invalidateCache(cacheKey(orgId)) immediately after any write that
 *   changes the cached data. See usages in:
 *     PATCH /api/org/profile       → invalidates org:profile:{orgId}
 *     POST/PATCH/DELETE /api/org/roles → invalidates org:roles:{orgId}
 *
 * ─── EXPORTS ──────────────────────────────────────────────────────────────────
 *   getCached<T>(key, ttlSeconds, fetchFn) → T
 *   invalidateCache(key)                  → void
 *   CACHE_KEYS                            → key builders
 */

async function getKV(): Promise<KVNamespace | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    return (ctx?.env?.CACHE as KVNamespace) ?? null;
  } catch {
    return null;
  }
}

export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const kv = await getKV();
  if (kv) {
    try {
      const cached = await kv.get(key, "json");
      if (cached !== null) return cached as T;
    } catch {
      // KV read failure — fall through to fetchFn
    }
  }

  const value = await fetchFn();

  if (kv && value !== null && value !== undefined) {
    try {
      await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
    } catch {
      // KV write failure is non-fatal — caller still gets fresh data
    }
  }

  return value;
}

export async function invalidateCache(key: string): Promise<void> {
  const kv = await getKV();
  if (!kv) return;
  try {
    await kv.delete(key);
  } catch {
    // Non-fatal — TTL will expire the stale entry anyway
  }
}

export const CACHE_KEYS = {
  orgProfile: (orgId: string) => `org:profile:${orgId}`,
  orgRoles:   (orgId: string) => `org:roles:${orgId}`,
} as const;

export const CACHE_TTL = {
  ORG_PROFILE: 300, // 5 minutes
  ORG_ROLES:   300, // 5 minutes
} as const;
