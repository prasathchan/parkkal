import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { treatments, visitTreatments, visits, users, payments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const READ_RATE_LIMIT = { limit: 300, windowMs: 60_000 };

type Params = { params: Promise<{ id: string }> };

// ── GET /api/treatments/[id]/visits ──────────────────────────────────────────
// Returns the full visit history for a treatment plan and a financial summary:
//   treatmentCost   — planned cost from treatments.cost
//   totalPaid       — sum of payments recorded against all linked visits for this patient
//   outstanding     — treatmentCost − totalPaid
//   visits          — ordered list of visits this plan has been worked on
export async function GET(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`read:${session.userId}`, READ_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("GET /api/treatments/[id]/visits", session);
  if (!await hasPermission(session, PERMISSIONS.TREATMENTS_VIEW)) {
    log.security("Permission denied: TREATMENTS_VIEW", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  const [treatment] = await db
    .select({
      id: treatments.id,
      description: treatments.description,
      procedure: treatments.procedure,
      toothNumbers: treatments.toothNumbers,
      cost: treatments.cost,
      status: treatments.status,
      patientId: treatments.patientId,
      doctorId: treatments.doctorId,
      consentStatus: treatments.consentStatus,
      createdAt: treatments.createdAt,
    })
    .from(treatments)
    .where(and(eq(treatments.id, id), eq(treatments.organizationId, session.orgId)));

  if (!treatment) return NextResponse.json({ error: "Treatment plan not found" }, { status: 404 });

  // Visit history — ordered newest first
  const visitRows = await db
    .select({
      visitId: visitTreatments.visitId,
      linkNotes: visitTreatments.notes,
      linkCreatedAt: visitTreatments.createdAt,
      visitCode: visits.visitCode,
      visitDate: visits.visitDate,
      visitStatus: visits.status,
      visitTotalAmount: visits.totalAmount,
      visitPaidAmount: visits.paidAmount,
      doctorName: users.name,
    })
    .from(visitTreatments)
    .innerJoin(visits, and(
      eq(visitTreatments.visitId, visits.id),
      eq(visits.organizationId, session.orgId)
    ))
    .leftJoin(users, eq(visits.doctorId, users.id))
    .where(eq(visitTreatments.treatmentId, id))
    .orderBy(visits.visitDate);

  // Financial summary — sum only payments explicitly attributed to this treatment plan.
  const paymentRows = await db
    .select({ amount: payments.amount })
    .from(payments)
    .where(eq(payments.treatmentId, id));
  const totalPaid = paymentRows.reduce((acc: number, p: { amount: number }) => acc + p.amount, 0);

  const outstanding = Math.max(0, treatment.cost - totalPaid);

  return NextResponse.json({
    treatment,
    visits: visitRows,
    summary: {
      treatmentCost: treatment.cost,
      totalPaid,
      outstanding,
      visitCount: visitRows.length,
    },
  });
}
