import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { featureFlags } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ featureKey: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { featureKey } = await params;
  const body = await request.json() as { isEnabled?: boolean; scope?: string };
  const { isEnabled, scope } = body;

  if (isEnabled === undefined || !scope) {
    return NextResponse.json({ error: "isEnabled and scope are required" }, { status: 400 });
  }

  const db = getDb();
  const now = Date.now();
  const orgId = scope === "org" ? session.orgId : null;
  const id = orgId ? `ff_${orgId}_${featureKey}` : `ff_global_${featureKey}`;

  const existing = await db
    .select()
    .from(featureFlags)
    .where(
      orgId
        ? and(eq(featureFlags.featureKey, featureKey), eq(featureFlags.orgId, orgId))
        : and(eq(featureFlags.featureKey, featureKey), isNull(featureFlags.orgId))
    );

  if (existing.length > 0) {
    await db.update(featureFlags).set({ isEnabled: isEnabled ? 1 : 0, updatedAt: now }).where(eq(featureFlags.id, existing[0].id));
  } else {
    const globalFlags = await db.select().from(featureFlags).where(and(eq(featureFlags.featureKey, featureKey), isNull(featureFlags.orgId)));
    const globalFlag = globalFlags[0];
    await db.insert(featureFlags).values({
      id, featureKey, name: globalFlag?.name ?? featureKey, description: globalFlag?.description ?? null,
      orgId, isEnabled: isEnabled ? 1 : 0, rolloutPercent: 100, createdAt: now, updatedAt: now,
    });
  }

  return NextResponse.json({ success: true, featureKey, isEnabled, scope });
}
