import { getDb } from "@/lib/db";
import { featureFlags } from "@/db/schema";
import { and, eq, or, isNull } from "drizzle-orm";

export async function isFeatureEnabled(featureKey: string, orgId: string): Promise<boolean> {
  const db = getDb();
  // Check org-specific override first, then fall back to global
  const flags = await db
    .select()
    .from(featureFlags)
    .where(
      and(
        eq(featureFlags.featureKey, featureKey),
        or(eq(featureFlags.orgId, orgId), isNull(featureFlags.orgId))
      )
    );

  if (flags.length === 0) return false;

  // Org-specific flag takes priority over global
  const orgFlag = flags.find((f: (typeof flags)[number]) => f.orgId === orgId);
  const globalFlag = flags.find((f: (typeof flags)[number]) => f.orgId === null);
  const activeFlag = orgFlag ?? globalFlag;

  return activeFlag ? activeFlag.isEnabled === 1 : false;
}

export async function getAllFlagsForOrg(orgId: string): Promise<Record<string, boolean>> {
  const db = getDb();
  const flags = await db
    .select()
    .from(featureFlags)
    .where(or(eq(featureFlags.orgId, orgId), isNull(featureFlags.orgId)));

  const result: Record<string, boolean> = {};
  // Build map: org-specific overrides global
  const globalFlags = flags.filter((f: (typeof flags)[number]) => f.orgId === null);
  const orgFlags = flags.filter((f: (typeof flags)[number]) => f.orgId === orgId);

  for (const f of globalFlags) {
    result[f.featureKey] = f.isEnabled === 1;
  }
  for (const f of orgFlags) {
    result[f.featureKey] = f.isEnabled === 1; // override
  }
  return result;
}
