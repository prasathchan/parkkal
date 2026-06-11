import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { patients, organizationPatients, visits, treatments } from "@/db/schema";
import { withRoute, apiError, RATE_LIMITS } from "@/lib/api";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";

/** GET /api/export?type=patients|visits|treatments — download CSV of org data */
export const GET = withRoute(
  { route: "GET /api/export", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.PATIENTS_VIEW },
  async (req, { session, db }) => {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "patients";

    // patients.view is checked by withRoute; visits and treatments have their own gates
    if (type === "visits" && !(await hasPermission(session, PERMISSIONS.VISITS_VIEW))) {
      return apiError("You do not have permission to export visits.", 403);
    }
    if (type === "treatments" && !(await hasPermission(session, PERMISSIONS.TREATMENTS_VIEW))) {
      return apiError("You do not have permission to export treatment plans.", 403);
    }

    if (type === "patients") {
      const rows = await db.select({
        code:           organizationPatients.patientCode,
        name:           patients.name,
        phone:          patients.phone,
        dob:            patients.dateOfBirth,
        gender:         patients.gender,
        blood:          patients.bloodGroup,
        address:        patients.address,
        referralSource: patients.referralSource,
        createdAt:      organizationPatients.registeredAt,
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

      return csvResponse([header, ...csvRows].join("\n"), `patients-${dateStamp()}.csv`);
    }

    if (type === "visits") {
      const rows = await db.select({
        visitCode:   visits.visitCode,
        patientName: patients.name,
        patientCode: patients.patientCode,
        visitDate:      visits.visitDate,
        total:          visits.totalAmount,
        paid:           visits.paidAmount,
        status:         visits.status,
        chiefComplaint: visits.chiefComplaint,
      }).from(visits)
        .leftJoin(patients, eq(visits.patientId, patients.id))
        .where(eq(visits.organizationId, session.orgId))
        .orderBy(visits.visitDate);

      const header = "Visit Code,Patient Name,Patient Code,Visit Date,Total (₹),Paid (₹),Due (₹),Status,Chief Complaint";
      const csvRows = rows.map((r: typeof rows[number]) => {
        const due = (r.total ?? 0) - (r.paid ?? 0);
        return [
          r.visitCode ?? "",
          csvEscape(r.patientName ?? ""),
          r.patientCode ?? "",
          r.visitDate ?? "",
          r.total ?? 0,
          r.paid ?? 0,
          due,
          r.status ?? "",
          csvEscape(r.chiefComplaint ?? ""),
        ].join(",");
      });

      return csvResponse([header, ...csvRows].join("\n"), `visits-${dateStamp()}.csv`);
    }

    if (type === "treatments") {
      const rows = await db.select({
        patientName:  patients.name,
        patientCode:  patients.patientCode,
        description:  treatments.description,
        procedure:    treatments.procedure,
        toothNumbers: treatments.toothNumbers,
        status:       treatments.status,
        cost:         treatments.cost,
        consentNotes: treatments.consentNotes,
        createdAt:    treatments.createdAt,
      }).from(treatments)
        .leftJoin(patients, eq(treatments.patientId, patients.id))
        .where(eq(treatments.organizationId, session.orgId))
        .orderBy(treatments.createdAt);

      const header = "Patient Name,Patient Code,Description,Procedure,Tooth Numbers,Status,Cost (₹),Consent Notes,Created At";
      const csvRows = rows.map((r: typeof rows[number]) => [
        csvEscape(r.patientName ?? ""),
        r.patientCode ?? "",
        csvEscape(r.description ?? ""),
        csvEscape(r.procedure ?? ""),
        r.toothNumbers ?? "",
        r.status ?? "",
        r.cost ?? 0,
        csvEscape(r.consentNotes ?? ""),
        r.createdAt ? new Date(r.createdAt).toISOString() : "",
      ].join(","));

      return csvResponse([header, ...csvRows].join("\n"), `treatments-${dateStamp()}.csv`);
    }

    return new NextResponse("Invalid type. Use ?type=patients, visits, or treatments", { status: 400 });
  }
);

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
