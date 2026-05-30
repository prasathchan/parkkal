import { NextRequest, NextResponse } from "next/server";
import { eq, and, count, sum, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { patients, appointments, invoices, payments, visits } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();

  const today = new Date().toISOString().split("T")[0];
  const todayStart = new Date(today).getTime();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const [
    [{ totalPatients }],
    [{ todayAppointments }],
    [{ pendingInvoices }],
    [{ monthlyRevenue }],
    [{ todayRevenue }],
    [{ openBilled }],
    [{ openPaid }],
  ] = await Promise.all([
    db.select({ totalPatients: count() }).from(patients),
    db
      .select({ todayAppointments: count() })
      .from(appointments)
      .where(eq(appointments.appointmentDate, today)),
    db
      .select({ pendingInvoices: count() })
      .from(invoices)
      .where(eq(invoices.status, "PENDING")),
    db
      .select({ monthlyRevenue: sum(invoices.paidAmount) })
      .from(invoices)
      .where(gte(invoices.createdAt, monthStart)),
    db
      .select({ todayRevenue: sum(payments.amount) })
      .from(payments)
      .where(gte(payments.paidAt, todayStart)),
    db
      .select({ openBilled: sum(visits.totalAmount) })
      .from(visits)
      .where(eq(visits.status, "OPEN")),
    db
      .select({ openPaid: sum(visits.paidAmount) })
      .from(visits)
      .where(eq(visits.status, "OPEN")),
  ]);

  return NextResponse.json({
    totalPatients,
    todayAppointments,
    pendingInvoices,
    monthlyRevenue: Number(monthlyRevenue) || 0,
    todayRevenue: Number(todayRevenue) || 0,
    outstandingDues: (Number(openBilled) || 0) - (Number(openPaid) || 0),
  });
}
