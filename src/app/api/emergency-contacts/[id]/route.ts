import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { emergencyContacts } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, relationship, phone, email, address } = body;
    const db = getDb();
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (relationship !== undefined) updates.relationship = relationship;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;

    await db.update(emergencyContacts).set(updates).where(eq(emergencyContacts.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update emergency contact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  await db.delete(emergencyContacts).where(eq(emergencyContacts.id, id));
  return NextResponse.json({ success: true });
}
