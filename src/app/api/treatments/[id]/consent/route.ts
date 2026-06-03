import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { treatments } from "@/db/schema";
import { getSession } from "@/lib/auth";
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

  const { id } = await params;
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
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "DOCTOR"].includes(session.role)) {
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

  await db
    .update(treatments)
    .set({
      consentStatus: "EMERGENCY_OVERRIDE",
      emergencyOverride: 1,
      emergencyReason: parsed.data.reason,
      consentVerifiedAt: Date.now(),
    })
    .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

  return NextResponse.json({ success: true, consentStatus: "EMERGENCY_OVERRIDE" });
}
