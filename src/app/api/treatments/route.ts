import { eq, desc, and, gte, lte, count } from "drizzle-orm";
import { treatments, patients, users, organizationPatients, organizationMembers } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const createTreatmentSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  description: z.string().min(1),
  toothNumbers: z.string().optional(),
  procedure: z.string().optional(),
  cost: z.number().default(0),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED"]).default("PLANNED"),
  appointmentId: z.string().optional(),
});

export const GET = withRoute(
  { route: "GET /api/treatments", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.TREATMENTS_VIEW },
  async (req, { session, db }) => {
    const { searchParams } = new URL(req.url);
    const patientIdFilter = searchParams.get("patientId");
    const dateFilter = searchParams.get("date");
    const doctorIdFilter =
      session.role === "DOCTOR" ? session.userId : searchParams.get("doctorId");

    const conditions = [eq(treatments.organizationId, session.orgId)];
    if (patientIdFilter) conditions.push(eq(treatments.patientId, patientIdFilter));
    if (doctorIdFilter) conditions.push(eq(treatments.doctorId, doctorIdFilter));
    if (dateFilter) {
      const dayStart = new Date(dateFilter + "T00:00:00").getTime();
      const dayEnd = new Date(dateFilter + "T23:59:59.999").getTime();
      conditions.push(gte(treatments.createdAt, dayStart));
      conditions.push(lte(treatments.createdAt, dayEnd));
    }

    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
    const offset = Number(searchParams.get("offset") ?? 0);

    const [{ total }] = await db
      .select({ total: count() })
      .from(treatments)
      .where(and(...conditions));

    const rows = await db
      .select({
        id: treatments.id,
        patientId: treatments.patientId,
        doctorId: treatments.doctorId,
        appointmentId: treatments.appointmentId,
        description: treatments.description,
        toothNumbers: treatments.toothNumbers,
        procedure: treatments.procedure,
        cost: treatments.cost,
        status: treatments.status,
        createdAt: treatments.createdAt,
        consentStatus: treatments.consentStatus,
        consentDocumentUrl: treatments.consentDocumentUrl,
        consentDocumentName: treatments.consentDocumentName,
        consentUploadedAt: treatments.consentUploadedAt,
        consentNotes: treatments.consentNotes,
        patientName: patients.name,
        patientCode: patients.patientCode,
        doctorName: users.name,
      })
      .from(treatments)
      .leftJoin(patients, eq(treatments.patientId, patients.id))
      .leftJoin(users, eq(treatments.doctorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(treatments.createdAt))
      .limit(limit)
      .offset(offset);

    return apiOk({ treatments: rows, total, hasMore: offset + rows.length < total });
  }
);

export const POST = withRoute(
  { route: "POST /api/treatments", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.TREATMENTS_CREATE },
  async (req, { session, db, log }) => {
    const data = createTreatmentSchema.parse(await req.json());

    // DOCTOR role can only create treatments assigned to themselves
    if (session.role === "DOCTOR") {
      data.doctorId = session.userId;
    }

    const [patientOrgLink] = await db.select().from(organizationPatients)
      .where(and(
        eq(organizationPatients.organizationId, session.orgId),
        eq(organizationPatients.patientId, data.patientId),
        eq(organizationPatients.isActive, 1),
      ));
    if (!patientOrgLink) return apiError("Forbidden", 403);

    const [doctorMembership] = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, session.orgId),
        eq(organizationMembers.userId, data.doctorId),
        eq(organizationMembers.isActive, 1),
      ));
    if (!doctorMembership) return apiError("Doctor does not belong to this organization", 400);

    const treatment = {
      id: crypto.randomUUID(),
      organizationId: session.orgId,
      patientId: data.patientId,
      doctorId: data.doctorId,
      description: data.description,
      toothNumbers: data.toothNumbers ?? null,
      procedure: data.procedure ?? null,
      cost: data.cost,
      status: data.status,
      appointmentId: data.appointmentId ?? null,
      createdAt: Date.now(),
    };

    await db.insert(treatments).values(treatment);
    log.info("Treatment created", { treatmentId: treatment.id, patientId: treatment.patientId, doctorId: treatment.doctorId });
    return apiOk({ treatment }, 201);
  }
);
