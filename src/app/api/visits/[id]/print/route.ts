import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visits, visitItems, payments, patients, users, prescriptions, organizations } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.VISITS_VIEW))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = getDb();

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

  if (!visitRow) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const [org] = await db
    .select({ name: organizations.name, address: organizations.address, phone: organizations.phone, email: organizations.email })
    .from(organizations)
    .where(eq(organizations.id, session.orgId));

  const [items, paymentRows, prescriptionRows] = await Promise.all([
    db.select().from(visitItems).where(eq(visitItems.visitId, id)),
    db.select().from(payments).where(eq(payments.visitId, id)),
    db.select().from(prescriptions).where(eq(prescriptions.visitId, id)),
  ]);

  return NextResponse.json({
    visit: visitRow,
    items,
    payments: paymentRows,
    prescriptions: prescriptionRows,
    clinic: {
      name: org?.name ?? "Dental Clinic",
      address: org?.address ?? "",
      phone: org?.phone ?? "",
      email: org?.email ?? "",
    },
  });
}
