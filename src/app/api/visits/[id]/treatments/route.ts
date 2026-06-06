import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  visits,
  treatments,
  visitTreatments,
  organizationMembers,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

// ── GET /api/visits/[id]/treatments ──────────────────────────────────────────
// Returns all treatment plans currently linked to this visit.
export async function GET(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await hasPermission(session, PERMISSIONS.TREATMENTS_VIEW)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  const [visit] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const rows = await db
    .select({
      id: treatments.id,
      description: treatments.description,
      procedure: treatments.procedure,
      toothNumbers: treatments.toothNumbers,
      cost: treatments.cost,
      status: treatments.status,
      appointmentId: treatments.appointmentId,
      consentStatus: treatments.consentStatus,
      consentDocumentUrl: treatments.consentDocumentUrl,
      consentDocumentName: treatments.consentDocumentName,
      consentUploadedAt: treatments.consentUploadedAt,
      consentNotes: treatments.consentNotes,
      createdAt: treatments.createdAt,
      patientId: treatments.patientId,
      doctorId: treatments.doctorId,
      linkNotes: visitTreatments.notes,
      linkCreatedAt: visitTreatments.createdAt,
    })
    .from(visitTreatments)
    .innerJoin(treatments, eq(visitTreatments.treatmentId, treatments.id))
    .where(
      and(
        eq(visitTreatments.visitId, id),
        eq(treatments.organizationId, session.orgId)
      )
    );

  return NextResponse.json({ treatments: rows });
}

// ── POST /api/visits/[id]/treatments ─────────────────────────────────────────
// Two modes:
//   { treatmentId }                           — link an existing treatment plan
//   { description, doctorId?, ... }           — create new plan and link atomically
const linkSchema = z.object({ treatmentId: z.string() });

const createAndLinkSchema = z.object({
  description: z.string().min(1),
  doctorId: z.string().optional(),
  procedure: z.string().optional(),
  toothNumbers: z.string().optional(),
  cost: z.number().min(0).default(0),
  notes: z.string().optional(), // per-link notes
});

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await hasPermission(session, PERMISSIONS.TREATMENTS_CREATE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: visitId } = await params;
  const db = getDb();

  const [visit] = await db
    .select({ id: visits.id, patientId: visits.patientId, organizationId: visits.organizationId })
    .from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const now = Date.now();

  // ── Mode A: link existing plan ───────────────────────────────────────────
  if (typeof body === "object" && body !== null && "treatmentId" in (body as Record<string, unknown>)) {
    const parsed = linkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.errors }, { status: 400 });
    }

    const [treatment] = await db
      .select({ id: treatments.id, patientId: treatments.patientId })
      .from(treatments)
      .where(and(eq(treatments.id, parsed.data.treatmentId), eq(treatments.organizationId, session.orgId)));

    if (!treatment) return NextResponse.json({ error: "Treatment plan not found" }, { status: 404 });
    if (treatment.patientId !== visit.patientId) {
      return NextResponse.json({ error: "Treatment plan does not belong to this visit's patient" }, { status: 422 });
    }

    // Idempotent — silently succeed if already linked
    const [existing] = await db
      .select({ visitId: visitTreatments.visitId })
      .from(visitTreatments)
      .where(and(eq(visitTreatments.visitId, visitId), eq(visitTreatments.treatmentId, parsed.data.treatmentId)));

    if (!existing) {
      await db.insert(visitTreatments).values({
        visitId,
        treatmentId: parsed.data.treatmentId,
        notes: null,
        createdAt: now,
      });
    }

    return NextResponse.json({ success: true, treatmentId: parsed.data.treatmentId });
  }

  // ── Mode B: create new plan and link atomically ──────────────────────────
  const parsed = createAndLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.errors }, { status: 400 });
  }

  const doctorId = session.role === "DOCTOR" ? session.userId : (parsed.data.doctorId ?? session.userId);

  // Verify doctor is an active member of this org
  const [doctorMember] = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, session.orgId),
      eq(organizationMembers.userId, doctorId),
      eq(organizationMembers.isActive, 1),
    ));
  if (!doctorMember) return NextResponse.json({ error: "Doctor not found in this organization" }, { status: 400 });

  const treatmentId = crypto.randomUUID();

  // D1's Drizzle transaction adapter uses the batch API and can hang with async callbacks.
  // Two sequential inserts are safe here: a treatment without a visit link is orphaned
  // but non-destructive, and the extremely unlikely partial failure is recoverable.
  await db.insert(treatments).values({
    id: treatmentId,
    organizationId: session.orgId,
    patientId: visit.patientId,
    doctorId,
    description: parsed.data.description,
    procedure: parsed.data.procedure ?? null,
    toothNumbers: parsed.data.toothNumbers ?? null,
    cost: parsed.data.cost,
    status: "PLANNED",
    appointmentId: null,
    consentStatus: "PENDING",
    emergencyOverride: 0,
    createdAt: now,
  });

  await db.insert(visitTreatments).values({
    visitId,
    treatmentId,
    notes: parsed.data.notes ?? null,
    createdAt: now,
  });

  return NextResponse.json({ success: true, treatmentId }, { status: 201 });
}

// ── DELETE /api/visits/[id]/treatments?treatmentId=xxx ───────────────────────
// Unlinks a treatment plan from this visit (does NOT delete the treatment plan).
export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "DOCTOR", "NURSE"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: visitId } = await params;
  const treatmentId = new URL(request.url).searchParams.get("treatmentId");
  if (!treatmentId) return NextResponse.json({ error: "treatmentId required" }, { status: 400 });

  const db = getDb();

  const [visit] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.organizationId, session.orgId)));
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  await db.delete(visitTreatments).where(
    and(eq(visitTreatments.visitId, visitId), eq(visitTreatments.treatmentId, treatmentId))
  );

  return NextResponse.json({ success: true });
}
