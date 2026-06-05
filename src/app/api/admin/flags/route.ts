import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { featureFlags } from "@/db/schema";
import { eq, or, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const orgId = session.orgId;

  const flags = await db
    .select()
    .from(featureFlags)
    .where(or(eq(featureFlags.orgId, orgId), isNull(featureFlags.orgId)));

  // Merge global + org flags into unified view
  const globalMap = new Map<string, typeof flags[0]>();
  const orgMap = new Map<string, typeof flags[0]>();

  for (const f of flags) {
    if (f.orgId === null) globalMap.set(f.featureKey, f);
    else if (f.orgId === orgId) orgMap.set(f.featureKey, f);
  }

  const allKeys = new Set([...globalMap.keys(), ...orgMap.keys()]);
  const result = Array.from(allKeys).map(key => {
    const global = globalMap.get(key);
    const org = orgMap.get(key);
    const effective = org ?? global;
    return {
      featureKey: key,
      name: global?.name ?? org?.name ?? key,
      description: global?.description ?? org?.description ?? null,
      globalEnabled: global ? global.isEnabled === 1 : false,
      orgEnabled: org ? org.isEnabled === 1 : null,
      effectiveEnabled: effective ? effective.isEnabled === 1 : false,
      rolloutPercent: global?.rolloutPercent ?? 100,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { featureKey?: string; isEnabled?: boolean; orgId?: string | null };
  const { featureKey, isEnabled, orgId } = body;

  if (!featureKey || isEnabled === undefined) {
    return NextResponse.json({ error: "featureKey and isEnabled are required" }, { status: 400 });
  }

  // Only allow setting flags for the current org or globally — never for another org
  if (orgId !== undefined && orgId !== null && orgId !== session.orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const now = Date.now();
  const targetOrgId = orgId ?? null;
  const id = targetOrgId ? `ff_${targetOrgId}_${featureKey}` : `ff_global_${featureKey}`;

  // Check if row exists
  const existing = await db
    .select()
    .from(featureFlags)
    .where(
      targetOrgId
        ? eq(featureFlags.orgId, targetOrgId)
        : isNull(featureFlags.orgId)
    );

  const existingFlag = existing.find((f: (typeof existing)[number]) => f.featureKey === featureKey);

  if (existingFlag) {
    await db
      .update(featureFlags)
      .set({ isEnabled: isEnabled ? 1 : 0, updatedAt: now })
      .where(eq(featureFlags.id, existingFlag.id));
  } else {
    // Need to get name/description from global flag
    const globalFlags = await db.select().from(featureFlags).where(isNull(featureFlags.orgId));
    const globalFlag = globalFlags.find((f: (typeof globalFlags)[number]) => f.featureKey === featureKey);

    await db.insert(featureFlags).values({
      id,
      featureKey,
      name: globalFlag?.name ?? featureKey,
      description: globalFlag?.description ?? null,
      orgId: targetOrgId,
      isEnabled: isEnabled ? 1 : 0,
      rolloutPercent: 100,
      createdAt: now,
      updatedAt: now,
    });
  }

  return NextResponse.json({ success: true });
}
