import { eq, and } from "drizzle-orm";
import { visits, visitItems, payments, patients, users, prescriptions, organizations } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/visits/[id]/print", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.VISITS_VIEW },
  async (_req, { session, db }, { id }) => {
    const [visitRow] = await db
      .select({
        id: visits.id,
        visitCode: visits.visitCode,
        visitDate: visits.visitDate,
        chiefComplaint: visits.chiefComplaint,
        doctorNotes: visits.doctorNotes,
        diagnosis: visits.diagnosis,
        status: visits.status,
        totalAmount: visits.totalAmount,
        paidAmount: visits.paidAmount,
        organizationId: visits.organizationId,
        patientName: patients.name,
        patientCode: patients.patientCode,
        patientPhone: patients.phone,
        doctorName: users.name,
      })
      .from(visits)
      .leftJoin(patients, eq(visits.patientId, patients.id))
      .leftJoin(users, eq(visits.doctorId, users.id))
      .where(and(eq(visits.id, id), eq(visits.organizationId, session.orgId)));

    if (!visitRow) return apiError("Visit not found", 404);

    const [[org], [items, paymentRows, prescriptionRows]] = await Promise.all([
      db.select({
        name: organizations.name,
        address: organizations.address,
        phone: organizations.phone,
        email: organizations.email,
        logoUrl: organizations.logoUrl,
        gstin: organizations.gstin,
        gstRegistered: organizations.gstRegistered,
        gstStateCode: organizations.gstStateCode,
        cgstRate: organizations.cgstRate,
        sgstRate: organizations.sgstRate,
      }).from(organizations).where(eq(organizations.id, session.orgId)),
      Promise.all([
        db.select().from(visitItems).where(eq(visitItems.visitId, id)),
        db.select().from(payments).where(eq(payments.visitId, id)),
        db.select().from(prescriptions).where(eq(prescriptions.visitId, id)),
      ]),
    ]);

    return apiOk({
      visit: visitRow,
      items,
      payments: paymentRows,
      prescriptions: prescriptionRows,
      clinic: {
        name: org?.name ?? "Dental Clinic",
        address: org?.address ?? "",
        phone: org?.phone ?? "",
        email: org?.email ?? "",
        logoUrl: org?.logoUrl ?? null,
        gstin: org?.gstin ?? null,
        gstRegistered: !!(org?.gstRegistered),
        gstStateCode: org?.gstStateCode ?? null,
        cgstRate: org?.cgstRate ?? 9,
        sgstRate: org?.sgstRate ?? 9,
      },
    });
  }
);
