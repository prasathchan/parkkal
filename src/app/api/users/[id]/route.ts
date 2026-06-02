import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, organizationMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const isSelf = session.userId === id;
  if (!isSelf) {
    if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const db = getDb();
    const [membership] = await db.select().from(organizationMembers)
      .where(eq(organizationMembers.userId, id));
    if (!membership || membership.organizationId !== session.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    const db = getDb();
    await db.update(users).set({ ...data, updatedAt: Date.now() }).where(eq(users.id, id));
    const [updated] = await db
      .select({ id: users.id, name: users.name, phone: users.phone, email: users.email, dateOfBirth: users.dateOfBirth, gender: users.gender, address: users.address })
      .from(users)
      .where(eq(users.id, id));
    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
