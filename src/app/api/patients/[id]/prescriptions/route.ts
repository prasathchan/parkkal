import { eq, and, desc } from "drizzle-orm";
import { prescriptions, patients, organizationPatients, visits, users } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError } from "@/lib/api";

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/patients/[id]/prescriptions", permission: PERMISSIONS.VISITS_VIEW },
  async (_req, { session, db }, { id }) => {
    const [op] = await db
      .select({ patientId: organizationPatients.patientId })
      .from(organizationPatients)
      .innerJoin(patients, eq(patients.id, organizationPatients.patientId))
      .where(and(eq(organizationPatients.patientId, id), eq(organizationPatients.organizationId, session.orgId)));
    if (!op) return apiError("Patient not found", 404);

    const rows = await db
      .select({
        id: prescriptions.id,
        visitId: prescriptions.visitId,
        patientId: prescriptions.patientId,
        doctorId: prescriptions.doctorId,
        doctorName: users.name,
        medicines: prescriptions.medicines,
        instructions: prescriptions.instructions,
        createdAt: prescriptions.createdAt,
        visitDate: visits.visitDate,
      })
      .from(prescriptions)
      .leftJoin(users, eq(prescriptions.doctorId, users.id))
      .leftJoin(visits, eq(prescriptions.visitId, visits.id))
      .where(and(eq(prescriptions.patientId, id), eq(prescriptions.organizationId, session.orgId)))
      .orderBy(desc(prescriptions.createdAt));

    const parsed = rows.map((r: typeof rows[number]) => ({
      ...r,
      doctorName: r.doctorName ?? "Unknown",
      medicines: JSON.parse(r.medicines) as object[],
    }));

    return apiOk({ prescriptions: parsed });
  }
);
