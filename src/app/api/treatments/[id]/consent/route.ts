import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { treatments, consentAuditLog } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { z } from "zod";

const overrideSchema = z.object({
  reason: z.string().min(5, "Please provide a reason of at least 5 characters"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("GET /api/treatments/[id]/consent", session);

  const { id } = await params;
  try {
    const db = getDb();

    const [treatment] = await db
      .select({
        id: treatments.id,
        consentStatus: treatments.consentStatus,
        consentDocumentUrl: treatments.consentDocumentUrl,
        consentDocumentName: treatments.consentDocumentName,
        consentUploadedAt: treatments.consentUploadedAt,
        consentVerifiedAt: treatments.consentVerifiedAt,
        consentNotes: treatments.consentNotes,
        emergencyOverride: treatments.emergencyOverride,
        emergencyReason: treatments.emergencyReason,
      })
      .from(treatments)
      .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

    if (!treatment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ consent: treatment });
  } catch (err) {
    log.error("Failed to fetch consent record", err, { treatmentId: id });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("PATCH /api/treatments/[id]/consent", session);
  if (!["ADMIN", "DOCTOR"].includes(session.role)) {
    log.security("Permission denied: only ADMIN/DOCTOR can apply consent override", { role: session.role });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  const [treatment] = await db
    .select({ id: treatments.id })
    .from(treatments)
    .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

  if (!treatment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = overrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const now = Date.now();

  await db
    .update(treatments)
    .set({
      consentStatus: "EMERGENCY_OVERRIDE",
      emergencyOverride: 1,
      emergencyReason: parsed.data.reason,
      consentVerifiedAt: now,
    })
    .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

  await db.insert(consentAuditLog).values({
    id: crypto.randomUUID(),
    treatmentId: id,
    organizationId: session.orgId,
    actorId: session.userId,
    actorRole: session.role,
    action: "EMERGENCY_OVERRIDE",
    reason: parsed.data.reason,
    createdAt: now,
  });

  log.info("Emergency consent override applied", { treatmentId: id, reason: parsed.data.reason });
  return NextResponse.json({ success: true, consentStatus: "EMERGENCY_OVERRIDE" });
}
