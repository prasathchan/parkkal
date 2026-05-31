import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizationMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { userId } = await params;
    const body = await request.json();
    const { role, salaryType, salaryAmount, isActive } = body;

    const db = getDb();
    const updates: Record<string, unknown> = {};
    if (role !== undefined) updates.role = role;
    if (salaryType !== undefined) updates.salaryType = salaryType;
    if (salaryAmount !== undefined) updates.salaryAmount = salaryAmount;
    if (isActive !== undefined) updates.isActive = isActive ? 1 : 0;

    await db.update(organizationMembers).set(updates).where(
      and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId))
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const db = getDb();
  await db.delete(organizationMembers).where(
    and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId))
  );
  return NextResponse.json({ success: true });
}
