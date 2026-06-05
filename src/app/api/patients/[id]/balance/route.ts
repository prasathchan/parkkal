import { NextRequest, NextResponse } from "next/server";
import { eq, and, sum, count, max } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visits, organizationPatients } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  // Verify patient belongs to this org before exposing any financial data
  const [orgLink] = await db
    .select({ patientId: organizationPatients.patientId })
    .from(organizationPatients)
    .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, id)));
  if (!orgLink) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orgId = session.orgId;

  const [[agg], [dueAgg], [{ pendingVisits }]] = await Promise.all([
    db.select({
      totalBilled: sum(visits.totalAmount),
      totalPaid: sum(visits.paidAmount),
      visitCount: count(),
      lastVisit: max(visits.visitDate),
    }).from(visits).where(and(eq(visits.patientId, id), eq(visits.organizationId, orgId))),

    db.select({
      totalBilled: sum(visits.totalAmount),
      totalPaid: sum(visits.paidAmount),
    }).from(visits).where(and(eq(visits.patientId, id), eq(visits.organizationId, orgId), eq(visits.status, "OPEN"))),

    db.select({ pendingVisits: count() })
      .from(visits)
      .where(and(eq(visits.patientId, id), eq(visits.organizationId, orgId), eq(visits.status, "OPEN"))),
  ]);

  return NextResponse.json({
    totalBilled: Number(agg?.totalBilled) || 0,
    totalPaid: Number(agg?.totalPaid) || 0,
    totalDue: (Number(dueAgg?.totalBilled) || 0) - (Number(dueAgg?.totalPaid) || 0),
    visitCount: Number(agg?.visitCount) || 0,
    pendingVisits: Number(pendingVisits) || 0,
    lastVisit: agg?.lastVisit || null,
  });
}
