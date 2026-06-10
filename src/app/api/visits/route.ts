/**
 * API Route: /api/visits
 *
 * GET  — List visits (filterable by patient, doctor, status, date, billing status)
 * POST — Create a new visit
 *
 * Who can call this:
 *   GET  → staff with visits.view permission (DOCTOR only sees their own)
 *   POST → staff with visits.create permission
 *
 * Query params for GET:
 *   patientId, doctorId, status, date, search, billingStatus, limit, offset
 */
import { eq, desc, and, count, like, or, sql } from "drizzle-orm";
import { visits, patients, users, organizationPatients, organizationMembers, appointments } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { escapeLike } from "@/lib/utils";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

// ─── Validation schema ────────────────────────────────────────────────────────

const createVisitSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "visitDate must be YYYY-MM-DD"),
  chiefComplaint: z.string().max(500).optional(),
  doctorNotes: z.string().max(5000).optional(),
  appointmentId: z.string().nullable().optional(),
  visitType: z.enum(["APPOINTMENT", "WALKIN"]).default("WALKIN"),
});

/** Build a sequential visit code like VIS-20250601-0003 */
function generateVisitCode(date: string, seq: number): string {
  const d = date.replace(/-/g, "");
  return `VIS-${d}-${String(seq).padStart(4, "0")}`;
}

// ─── GET /api/visits ──────────────────────────────────────────────────────────
// Returns paginated list of visits for the org.
// RBAC: DOCTOR role sees only their own visits.

export const GET = withRoute(
  { route: "GET /api/visits", permission: PERMISSIONS.VISITS_VIEW },
  async (req, { session, db }) => {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    // RBAC: DOCTOR role may only see their own visits
    const doctorId = session.role === "DOCTOR" ? session.userId : searchParams.get("doctorId");
    const status = searchParams.get("status");
    const billingStatus = searchParams.get("billingStatus"); // "UNPAID" → paidAmount < totalAmount
    const date = searchParams.get("date");
    const search = searchParams.get("search");

    const conditions = [eq(visits.organizationId, session.orgId)];
    if (patientId) conditions.push(eq(visits.patientId, patientId));
    if (doctorId) conditions.push(eq(visits.doctorId, doctorId));
    if (status) conditions.push(eq(visits.status, status as "OPEN" | "COMPLETED" | "CANCELLED"));
    if (billingStatus === "UNPAID") conditions.push(sql`${visits.paidAmount} < ${visits.totalAmount}`);
    if (date) conditions.push(eq(visits.visitDate, date));
    if (search) {
      const escaped = escapeLike(search);
      const likeSearch = `%${escaped}%`;
      const searchCondition = or(like(patients.name, likeSearch), like(visits.visitCode, likeSearch));
      if (searchCondition) conditions.push(searchCondition);
    }

    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
    const offset = Number(searchParams.get("offset") ?? 0);

    const [{ total }] = await db
      .select({ total: count() })
      .from(visits)
      .leftJoin(patients, eq(visits.patientId, patients.id))
      .where(and(...conditions));

    const rows = await db
      .select({
        id: visits.id,
        visitCode: visits.visitCode,
        patientId: visits.patientId,
        doctorId: visits.doctorId,
        visitDate: visits.visitDate,
        status: visits.status,
        totalAmount: visits.totalAmount,
        paidAmount: visits.paidAmount,
        createdAt: visits.createdAt,
        updatedAt: visits.updatedAt,
        patientName: patients.name,
        patientCode: patients.patientCode,
        doctorName: users.name,
      })
      .from(visits)
      .leftJoin(patients, eq(visits.patientId, patients.id))
      .leftJoin(users, eq(visits.doctorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(visits.createdAt))
      .limit(limit)
      .offset(offset);

    return apiOk({ visits: rows, total, hasMore: offset + rows.length < total });
  }
);

// ─── POST /api/visits ─────────────────────────────────────────────────────────
// Creates a new visit record.
// Guards: checks patient and doctor belong to the org, and prevents duplicate visits per appointment.

export const POST = withRoute(
  {
    route: "POST /api/visits",
    permission: PERMISSIONS.VISITS_CREATE,
    rateLimit: RATE_LIMITS.WRITE,
  },
  async (req, { session, db, log }) => {
    const body = await req.json();
    const parsed = createVisitSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input", 400);
    }
    const { patientId, visitDate, chiefComplaint, doctorNotes, appointmentId, visitType } = parsed.data;
    // RBAC: DOCTOR role can only create visits assigned to themselves
    const doctorId = session.role === "DOCTOR" ? session.userId : parsed.data.doctorId;

    const [patientOrgLink] = await db.select().from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, patientId)));
    if (!patientOrgLink) return apiError("Patient does not belong to this organization", 400);

    // Verify doctor is a member of this org
    const [doctorMembership] = await db.select({ userId: organizationMembers.userId }).from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, doctorId)));
    if (!doctorMembership) return apiError("Doctor does not belong to this organization", 400);

    // Prevent duplicate visits for the same appointment
    if (appointmentId) {
      const [existing] = await db.select({ id: visits.id }).from(visits)
        .where(and(eq(visits.appointmentId, appointmentId), eq(visits.organizationId, session.orgId)));
      if (existing) return apiError("A visit already exists for this appointment", 409, { visitId: existing.id });
    }

    // Count org-scoped visits today to generate a sequential visit code
    const [{ todayCount }] = await db
      .select({ todayCount: count() })
      .from(visits)
      .where(and(eq(visits.organizationId, session.orgId), eq(visits.visitDate, visitDate)));

    const now = Date.now();
    const baseSeq = (todayCount as number) + 1;

    const newVisit = {
      id: crypto.randomUUID(),
      organizationId: session.orgId,
      patientId,
      doctorId,
      visitDate,
      chiefComplaint: chiefComplaint || null,
      doctorNotes: doctorNotes || null,
      diagnosis: null,
      appointmentId: appointmentId || null,
      visitType: visitType || "WALKIN",
      status: "OPEN" as const,
      totalAmount: 0,
      paidAmount: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Retry loop for UNIQUE constraint on visitCode (two concurrent requests same day)
    let visitCode = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      visitCode = generateVisitCode(visitDate, baseSeq + attempt);
      try {
        await db.insert(visits).values({ ...newVisit, visitCode });
        break;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (attempt === 4 || !msg.includes("UNIQUE")) throw e;
      }
    }

    // Mark linked appointment as IN_PROGRESS (best-effort — old DBs without this status are tolerated)
    if (appointmentId) {
      try {
        await db
          .update(appointments)
          .set({ status: "IN_PROGRESS" })
          .where(and(eq(appointments.id, appointmentId), eq(appointments.organizationId, session.orgId)));
      } catch {
        // DB schema not yet migrated — skip silently
      }
    }

    log.info("Visit created", { visitId: newVisit.id, visitCode, patientId, doctorId, visitDate });
    return apiOk({ visit: { ...newVisit, visitCode } }, 201);
  }
);
