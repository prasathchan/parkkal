import { eq, and } from "drizzle-orm";
import { emergencyContacts, patients, organizationPatients, organizationMembers } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
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

/** Verify that entityId belongs to the requesting org. */
async function assertEntityOwnership(
  db: ReturnType<typeof import("@/lib/db").getDb>,
  orgId: string,
  entityType: "PATIENT" | "USER",
  entityId: string,
  log: ReturnType<typeof import("@/lib/logger").logger.forRoute>
): Promise<boolean> {
  if (entityType === "PATIENT") {
    const [m] = await db.select({ patientId: organizationPatients.patientId }).from(organizationPatients)
      .where(and(eq(organizationPatients.organizationId, orgId), eq(organizationPatients.patientId, entityId)));
    if (!m) { log.security("Forbidden: patient not in org", { entityId }); return false; }
  } else {
    const [m] = await db.select({ userId: organizationMembers.userId }).from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, entityId)));
    if (!m) { log.security("Forbidden: user not in org", { entityId }); return false; }
  }
  return true;
}

/** GET /api/emergency-contacts?entityType=X&entityId=Y */
export const GET = withRoute(
  { route: "GET /api/emergency-contacts" },
  async (req, { session, db, log }) => {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType") as "USER" | "PATIENT" | null;
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) return apiOk({ contacts: [] });

    if (!["PATIENT", "USER"].includes(entityType)) return apiError("Invalid entityType", 400);

    const allowed = await assertEntityOwnership(db, session.orgId, entityType, entityId, log);
    if (!allowed) return apiError("Forbidden", 403);

    const contacts = await db.select().from(emergencyContacts)
      .where(and(eq(emergencyContacts.entityType, entityType), eq(emergencyContacts.entityId, entityId)));

    return apiOk({ contacts });
  }
);

/** POST /api/emergency-contacts — create a new emergency contact */
export const POST = withRoute(
  { route: "POST /api/emergency-contacts", rateLimit: RATE_LIMITS.WRITE },
  async (req, { session, db, log }) => {
    const data = createSchema.parse(await req.json());

    const allowed = await assertEntityOwnership(db, session.orgId, data.entityType, data.entityId, log);
    if (!allowed) return apiError("Forbidden", 403);

    const contact = {
      id: crypto.randomUUID(),
      entityType: data.entityType,
      entityId: data.entityId,
      name: data.name,
      relationship: data.relationship,
      phone: data.phone,
      email: data.email || null,
      address: data.address || null,
      createdAt: Date.now(),
    };

    await db.insert(emergencyContacts).values(contact);

    // Mark patient record as having an emergency contact
    if (data.entityType === "PATIENT") {
      await db.update(patients).set({ emergencyContactAdded: 1 }).where(eq(patients.id, data.entityId));
    }

    log.info("Emergency contact created", { contactId: contact.id, entityType: data.entityType });
    return apiOk({ contact }, 201);
  }
);
