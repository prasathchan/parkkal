import { NextRequest, NextResponse } from "next/server";
import { eq, and, sum, count, max } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { visits } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const [agg] = await db
    .select({
      totalBilled: sum(visits.totalAmount),
      totalPaid: sum(visits.paidAmount),
      visitCount: count(),
      lastVisit: max(visits.visitDate),
    })
    .from(visits)
    .where(eq(visits.patientId, id));

  const [{ pendingVisits }] = await db
    .select({ pendingVisits: count() })
    .from(visits)
    .where(and(eq(visits.patientId, id), eq(visits.status, "OPEN")));

  const totalBilled = Number(agg?.totalBilled) || 0;
  const totalPaid = Number(agg?.totalPaid) || 0;

  return NextResponse.json({
    totalBilled,
    totalPaid,
    totalDue: totalBilled - totalPaid,
    visitCount: Number(agg?.visitCount) || 0,
    pendingVisits: Number(pendingVisits) || 0,
    lastVisit: agg?.lastVisit || null,
  });
}
