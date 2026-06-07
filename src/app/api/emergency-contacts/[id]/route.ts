import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { emergencyContacts, organizationPatients, organizationMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const WRITE_RATE_LIMIT = { limit: 120, windowMs: 60_000 };

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`write:${session.userId}`, WRITE_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("PATCH /api/emergency-contacts/[id]", session);
  const { id } = await params;

  try {
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

    const body = await request.json() as { name?: string; relationship?: string; phone?: string; email?: string; address?: string };
    const { name, relationship, phone, email, address } = body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (relationship !== undefined) updates.relationship = relationship;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;

    await db.update(emergencyContacts).set(updates).where(eq(emergencyContacts.id, id));
    log.info("Emergency contact updated", { contactId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Failed to update emergency contact", error, { contactId: id });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("DELETE /api/emergency-contacts/[id]", session);
  const { id } = await params;

  try {
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
    log.info("Emergency contact deleted", { contactId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Failed to delete emergency contact", error, { contactId: id });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
