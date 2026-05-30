import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visits, visitItems, payments, patients, users } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      patientName: patients.name,
      patientCode: patients.patientCode,
      patientPhone: patients.phone,
      doctorName: users.name,
    })
    .from(visits)
    .leftJoin(patients, eq(visits.patientId, patients.id))
    .leftJoin(users, eq(visits.doctorId, users.id))
    .where(eq(visits.id, id));

  if (!visitRow) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const items = await db.select().from(visitItems).where(eq(visitItems.visitId, id));
  const paymentRows = await db.select().from(payments).where(eq(payments.visitId, id));

  return NextResponse.json({
    visit: visitRow,
    items,
    payments: paymentRows,
    clinic: {
      name: "Parkkal Dental Clinic",
      address: "Palavakkam, ECR, Chennai",
      phone: "+91 98765 43210",
      email: "info@parkkal.com",
      website: "app.parkkal.com",
    },
  });
}
