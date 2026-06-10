import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { patients, organizationPatients, visits } from "@/db/schema";
import { withRoute, RATE_LIMITS, apiOk } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";

/** GET /api/export?type=patients|billing — download CSV of org data */
export const GET = withRoute(
  { route: "GET /api/export", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.PATIENTS_VIEW },
  async (req, { session, db }) => {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "patients";

    if (type === "patients") {
      const rows = await db.select({
        code: organizationPatients.patientCode,
        name: patients.name,
        phone: patients.phone,
        dob: patients.dateOfBirth,
        gender: patients.gender,
        blood: patients.bloodGroup,
        address: patients.address,
        referralSource: patients.referralSource,
        createdAt: organizationPatients.registeredAt,
      }).from(organizationPatients)
        .innerJoin(patients, eq(organizationPatients.patientId, patients.id))
        .where(eq(organizationPatients.organizationId, session.orgId))
        .orderBy(organizationPatients.registeredAt);

      const header = "Code,Name,Phone,Date of Birth,Gender,Blood Group,Address,Referral Source,Registered At";
      const csvRows = rows.map((r: typeof rows[number]) => [
        r.code ?? "",
        csvEscape(r.name),
        r.phone ?? "",
        r.dob ?? "",
        r.gender ?? "",
        r.blood ?? "",
        csvEscape(r.address ?? ""),
        r.referralSource ?? "",
        r.createdAt ? new Date(r.createdAt).toISOString() : "",
      ].join(","));

      const csv = [header, ...csvRows].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="patients-${Date.now()}.csv"`,
        },
      });
    }

    if (type === "billing") {
      const rows = await db
        .select({
          patientName: patients.name,
          patientCode: patients.patientCode,
          visitDate: visits.visitDate,
          totalAmount: visits.totalAmount,
          paidAmount: visits.paidAmount,
          status: visits.status,
        })
        .from(visits)
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .where(eq(visits.organizationId, session.orgId))
        .orderBy(visits.visitDate);

      const header = "Patient Code,Patient Name,Visit Date,Total (₹),Paid (₹),Status";
      const csvRows = rows.map((r: typeof rows[number]) => [
        r.patientCode ?? "",
        csvEscape(r.patientName ?? ""),
        r.visitDate ?? "",
        r.totalAmount ?? 0,
        r.paidAmount ?? 0,
        r.status ?? "",
      ].join(","));

      const csv = [header, ...csvRows].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="billing-${Date.now()}.csv"`,
        },
      });
    }

    return apiOk({ error: "Invalid type. Use ?type=patients or ?type=billing" });
  }
);

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
