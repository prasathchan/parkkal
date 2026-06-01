import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { emergencyContacts, organizationPatients, organizationMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = getDb();

    const [contact] = await db.select().from(emergencyContacts).where(eq(emergencyContacts.id, id));
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Verify entity belongs to the org
    if (contact.entityType === "PATIENT") {
      const [membership] = await db
        .select({ patientId: organizationPatients.patientId })
        .from(organizationPatients)
        .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, contact.entityId)));
      if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (contact.entityType === "USER") {
      const [membership] = await db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, contact.entityId)));
      if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, relationship, phone, email, address } = body;
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

  try {
    const { id } = await params;
    const db = getDb();

    const [contact] = await db.select().from(emergencyContacts).where(eq(emergencyContacts.id, id));
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Verify entity belongs to the org
    if (contact.entityType === "PATIENT") {
      const [membership] = await db
        .select({ patientId: organizationPatients.patientId })
        .from(organizationPatients)
        .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, contact.entityId)));
      if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (contact.entityType === "USER") {
      const [membership] = await db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, contact.entityId)));
      if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.delete(emergencyContacts).where(eq(emergencyContacts.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete emergency contact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
