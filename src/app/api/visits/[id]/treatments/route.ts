import { eq, and, sum } from "drizzle-orm";
import {
  visits,
  treatments,
  visitTreatments,
  visitItems,
  organizationMembers,
} from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

type Params = { id: string };

// ── GET /api/visits/[id]/treatments ──────────────────────────────────────────
// Returns all treatment plans currently linked to this visit.
export const GET = withRoute<Params>(
  { route: "GET /api/visits/[id]/treatments", permission: PERMISSIONS.TREATMENTS_VIEW },
  async (_req, { session, db }, { id }) => {
    const [visit] = await db
      .select({ id: visits.id })
      .from(visits)
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Visit not found", 404);

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
      .where(and(
        eq(visitTreatments.visitId, id),
        eq(treatments.organizationId, session.orgId)
      ));

    // Compute billedAmount per treatment across ALL visits (for cross-visit tracking)
    type TreatmentRow = (typeof rows)[number];
    const treatmentIds = rows.map((r: TreatmentRow) => r.id);
    const billedMap: Record<string, number> = {};
    for (const txId of treatmentIds) {
      const [row] = await db
        .select({ total: sum(visitItems.amount) })
        .from(visitItems)
        .where(eq(visitItems.linkedTreatmentId, txId));
      billedMap[txId] = Number(row?.total ?? 0);
    }

    const rowsWithBilled = rows.map((r: TreatmentRow) => ({ ...r, billedAmount: billedMap[r.id] ?? 0 }));
    return apiOk({ treatments: rowsWithBilled });
  }
);

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
  notes: z.string().optional(),
});

export const POST = withRoute<Params>(
  { route: "POST /api/visits/[id]/treatments", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.TREATMENTS_CREATE },
  async (req, { session, db, log }, { id: visitId }) => {
    const [visit] = await db
      .select({ id: visits.id, patientId: visits.patientId, organizationId: visits.organizationId })
      .from(visits)
      .where(and(eq(visits.id, visitId), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Visit not found", 404);

    const body = await req.json().catch(() => null);
    if (!body) return apiError("Invalid JSON", 400);

    const now = Date.now();

    // ── Mode A: link existing plan ───────────────────────────────────────────
    if (typeof body === "object" && body !== null && "treatmentId" in (body as Record<string, unknown>)) {
      const parsed = linkSchema.safeParse(body);
      if (!parsed.success) return apiError("Invalid input", 400);

      const [treatment] = await db
        .select({ id: treatments.id, patientId: treatments.patientId })
        .from(treatments)
        .where(and(eq(treatments.id, parsed.data.treatmentId), eq(treatments.organizationId, session.orgId)));

      if (!treatment) return apiError("Treatment plan not found", 404);
      if (treatment.patientId !== visit.patientId) {
        return apiError("Treatment plan does not belong to this visit's patient", 422);
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

      log.info("Treatment plan linked to visit", { visitId, treatmentId: parsed.data.treatmentId });
      return apiOk({ success: true, treatmentId: parsed.data.treatmentId });
    }

    // ── Mode B: create new plan and link atomically ──────────────────────────
    const parsed = createAndLinkSchema.safeParse(body);
    if (!parsed.success) return apiError("Invalid input", 400);

    const doctorId = session.role === "DOCTOR" ? session.userId : (parsed.data.doctorId ?? session.userId);

    const [doctorMember] = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, session.orgId),
        eq(organizationMembers.userId, doctorId),
        eq(organizationMembers.isActive, 1),
      ));
    if (!doctorMember) return apiError("Doctor not found in this organization", 400);

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

    log.info("Treatment plan created and linked to visit", { visitId, treatmentId });
    return apiOk({ success: true, treatmentId }, 201);
  }
);

// ── DELETE /api/visits/[id]/treatments?treatmentId=xxx ───────────────────────
// Unlinks a treatment plan from this visit (does NOT delete the treatment plan).
export const DELETE = withRoute<Params>(
  { route: "DELETE /api/visits/[id]/treatments", rateLimit: RATE_LIMITS.DESTRUCTIVE },
  async (req, { session, db, log }, { id: visitId }) => {
    if (!["ADMIN", "DOCTOR", "NURSE"].includes(session.role)) {
      log.security("Permission denied: only ADMIN/DOCTOR/NURSE can unlink treatments", { role: session.role });
      return apiError("Forbidden", 403);
    }

    const treatmentId = new URL(req.url).searchParams.get("treatmentId");
    if (!treatmentId) return apiError("treatmentId required", 400);

    const [visit] = await db
      .select({ id: visits.id })
      .from(visits)
      .where(and(eq(visits.id, visitId), eq(visits.organizationId, session.orgId)));
    if (!visit) return apiError("Visit not found", 404);

    await db.delete(visitTreatments).where(
      and(eq(visitTreatments.visitId, visitId), eq(visitTreatments.treatmentId, treatmentId))
    );

    log.info("Treatment plan unlinked from visit", { visitId, treatmentId });
    return apiOk({ success: true });
  }
);
