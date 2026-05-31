import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visitItems, visits, patients, users } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const patientIdFilter = searchParams.get("patientId");

  const db = getDb();

  const conditions = [eq(visits.organizationId, session.orgId)];
  if (patientIdFilter) conditions.push(eq(visits.patientId, patientIdFilter));

  const rows = await db
    .select({
      id: visitItems.id,
      visitId: visitItems.visitId,
      visitCode: visits.visitCode,
      visitDate: visits.visitDate,
      patientId: visits.patientId,
      doctorId: visits.doctorId,
      itemName: visitItems.itemName,
      category: visitItems.category,
      toothNumber: visitItems.toothNumber,
      quantity: visitItems.quantity,
      unitPrice: visitItems.unitPrice,
      amount: visitItems.amount,
      notes: visitItems.notes,
      createdAt: visitItems.createdAt,
      patientName: patients.name,
      patientCode: patients.patientCode,
      doctorName: users.name,
    })
    .from(visitItems)
    .innerJoin(visits, eq(visitItems.visitId, visits.id))
    .leftJoin(patients, eq(visits.patientId, patients.id))
    .leftJoin(users, eq(visits.doctorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(visitItems.createdAt));

  return NextResponse.json({ treatments: rows });
}
