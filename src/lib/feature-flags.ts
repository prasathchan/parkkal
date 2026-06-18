/**
 * lib/feature-flags.ts
 *
 * Simple KV-backed feature flags for gradual rollout and kill-switches.
 *
 * ─── HOW IT WORKS ────────────────────────────────────────────────────────────
 *   Flags are stored as a single JSON object in KV at key "feature-flags".
 *   ADMIN users can toggle flags via PATCH /api/admin/feature-flags.
 *   Workers read flags once per request (no caching overhead; the KV read is
 *   fast and avoids stale data when a flag is flipped).
 *
 * ─── DEFINED FLAGS ───────────────────────────────────────────────────────────
 *   void_payments     — show void button in the payments tab (default: true)
 *   recall_notify     — enable recall reminder email dispatch (default: true)
 *   consent_ai        — run AI verification on consent uploads (default: true)
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *   import { getFeatureFlags } from "@/lib/feature-flags";
 *
 *   const flags = await getFeatureFlags();
 *   if (flags.void_payments) { ... }
 */

export interface FeatureFlags {
  void_payments: boolean;
  recall_notify: boolean;
  consent_ai: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  void_payments: true,
  recall_notify: true,
  consent_ai: true,
};

const GLOBAL_KV_KEY = "feature-flags";

function kvKey(orgId?: string) {
  return orgId ? `feature-flags:${orgId}` : GLOBAL_KV_KEY;
}

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

/**
 * Read flags for an org. When orgId is provided, org-level overrides are merged
 * on top of the global defaults so unset flags always fall back gracefully.
 */
export async function getFeatureFlags(orgId?: string): Promise<FeatureFlags> {
  const kv = await getKV();
  if (!kv) return { ...DEFAULT_FLAGS };
  try {
    const stored = await kv.get<Partial<FeatureFlags>>(kvKey(orgId), "json");
    if (!stored) return { ...DEFAULT_FLAGS };
    return { ...DEFAULT_FLAGS, ...stored };
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

/**
 * Write flag overrides. When orgId is provided, only that org's KV key is
 * updated — global defaults are unchanged.
 */
export async function setFeatureFlags(flags: Partial<FeatureFlags>, orgId?: string): Promise<void> {
  const kv = await getKV();
  if (!kv) return;
  const current = await getFeatureFlags(orgId);
  const updated = { ...current, ...flags };
  await kv.put(kvKey(orgId), JSON.stringify(updated));
}
