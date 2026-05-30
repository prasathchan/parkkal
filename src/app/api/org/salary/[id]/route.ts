import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { salaryRecords } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const { status, paidAmount, paidAt, notes } = body;
    const db = getDb();
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (paidAmount !== undefined) updates.paidAmount = paidAmount;
    if (paidAt !== undefined) updates.paidAt = paidAt;
    if (notes !== undefined) updates.notes = notes;

    await db.update(salaryRecords).set(updates).where(
      and(eq(salaryRecords.id, params.id), eq(salaryRecords.organizationId, session.orgId))
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update salary record error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
