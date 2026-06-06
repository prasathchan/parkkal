import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { emergencyContacts, patients, organizationPatients, organizationMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { z } from "zod";

const createSchema = z.object({
  entityType: z.enum(["USER", "PATIENT"]),
  entityId: z.string().min(1),
  name: z.string().min(1),
  relationship: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("GET /api/emergency-contacts", session);

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") as "USER" | "PATIENT" | null;
  const entityId = searchParams.get("entityId");

  if (!entityType || !entityId) return NextResponse.json({ contacts: [] });

  const db = getDb();

  // Verify entity belongs to this org before returning contacts
  if (entityType === "PATIENT") {
    const [membership] = await db
      .select({ patientId: organizationPatients.patientId })
      .from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, entityId)));
    if (!membership) {
      log.security("Forbidden: patient not in org", { entityId });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (entityType === "USER") {
    const [membership] = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, entityId)));
    if (!membership) {
      log.security("Forbidden: user not in org", { entityId });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
  }

  const contacts = await db.select().from(emergencyContacts)
    .where(and(eq(emergencyContacts.entityType, entityType), eq(emergencyContacts.entityId, entityId)));

  return NextResponse.json({ contacts });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("POST /api/emergency-contacts", session);

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const db = getDb();

    // Verify entity belongs to the org
    if (data.entityType === "PATIENT") {
      const [membership] = await db
        .select({ patientId: organizationPatients.patientId })
        .from(organizationPatients)
        .where(and(eq(organizationPatients.organizationId, session.orgId), eq(organizationPatients.patientId, data.entityId)));
      if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (data.entityType === "USER") {
      const [membership] = await db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, data.entityId)));
      if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = Date.now();

    const contact = {
      id: crypto.randomUUID(),
      entityType: data.entityType,
      entityId: data.entityId,
      name: data.name,
      relationship: data.relationship,
      phone: data.phone,
      email: data.email || null,
      address: data.address || null,
      createdAt: now,
    };

    await db.insert(emergencyContacts).values(contact);

    // Update patient flag if needed
    if (data.entityType === "PATIENT") {
      await db.update(patients).set({ emergencyContactAdded: 1 }).where(eq(patients.id, data.entityId));
    }

    log.info("Emergency contact created", { contactId: contact.id, entityType: data.entityType, entityId: data.entityId });
    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    log.error("Failed to create emergency contact", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
