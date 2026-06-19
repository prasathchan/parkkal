import { eq, and } from "drizzle-orm";
import { emergencyContacts, organizationPatients, organizationMembers } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { encryptField } from "@/lib/encryption";

/** Verify that the contact's entity belongs to the requesting org. */
async function assertContactOwnership(
  db: ReturnType<typeof import("@/lib/db").getDb>,
  orgId: string,
  contact: { entityType: string; entityId: string }
): Promise<boolean> {
  if (contact.entityType === "PATIENT") {
    const [m] = await db.select({ patientId: organizationPatients.patientId }).from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, orgId), eq(organizationPatients.patientId, contact.entityId)));
    return !!m;
  } else if (contact.entityType === "USER") {
    const [m] = await db.select({ userId: organizationMembers.userId }).from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, contact.entityId)));
    return !!m;
  }
  return false;
}

/** PATCH /api/emergency-contacts/[id] — update name, relationship, phone, etc. */
export const PATCH = withRoute<{ id: string }>(
  { route: "PATCH /api/emergency-contacts/[id]", rateLimit: RATE_LIMITS.WRITE },
  async (req, { session, db, log }, { id }) => {
    const [contact] = await db.select().from(emergencyContacts).where(eq(emergencyContacts.id, id));
    if (!contact) return apiError("Not found", 404);

    if (!await assertContactOwnership(db, session.orgId, contact)) return apiError("Forbidden", 403);

    const { name, relationship, phone, email, address } = await req.json() as Record<string, string | undefined>;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (relationship !== undefined) updates.relationship = relationship;
    if (phone !== undefined) updates.phone = await encryptField(phone) ?? phone;
    if (email !== undefined) updates.email = await encryptField(email || null) ?? null;
    if (address !== undefined) updates.address = await encryptField(address || null) ?? null;

    await db.update(emergencyContacts).set(updates).where(eq(emergencyContacts.id, id));
    log.info("Emergency contact updated", { contactId: id });
    return apiOk({ success: true });
  }
);

/** DELETE /api/emergency-contacts/[id] — remove an emergency contact */
export const DELETE = withRoute<{ id: string }>(
  { route: "DELETE /api/emergency-contacts/[id]" },
  async (_req, { session, db, log }, { id }) => {
    const [contact] = await db.select().from(emergencyContacts).where(eq(emergencyContacts.id, id));
    if (!contact) return apiError("Not found", 404);

    if (!await assertContactOwnership(db, session.orgId, contact)) return apiError("Forbidden", 403);

    await db.delete(emergencyContacts).where(eq(emergencyContacts.id, id));
    log.info("Emergency contact deleted", { contactId: id });
    return apiOk({ success: true });
  }
);
