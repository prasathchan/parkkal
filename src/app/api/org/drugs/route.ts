import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { orgDrugs } from "@/db/schema";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";

const addDrugSchema = z.object({
  name:             z.string().min(1).max(200).trim(),
  defaultDosage:    z.string().max(100).trim().optional(),
  defaultFrequency: z.string().max(100).trim().optional(),
  defaultDuration:  z.string().max(100).trim().optional(),
});

/** GET /api/org/drugs — list the clinic's curated formulary (any staff who can write prescriptions) */
export const GET = withRoute(
  { route: "GET /api/org/drugs", permission: PERMISSIONS.VISITS_VIEW, rateLimit: RATE_LIMITS.READ },
  async (_req, { session, db }) => {
    const drugs = await db
      .select()
      .from(orgDrugs)
      .where(eq(orgDrugs.organizationId, session.orgId))
      .orderBy(orgDrugs.name);
    return apiOk({ drugs });
  }
);

/** POST /api/org/drugs — add a drug to the clinic formulary (ORG_SETTINGS) */
export const POST = withRoute(
  { route: "POST /api/org/drugs", permission: PERMISSIONS.ORG_SETTINGS, rateLimit: RATE_LIMITS.WRITE },
  async (req, { session, db }) => {
    const body = addDrugSchema.safeParse(await req.json());
    if (!body.success) return apiError("Invalid drug data", 400);

    const { name, defaultDosage, defaultFrequency, defaultDuration } = body.data;

    // Case-insensitive dedupe within the same org
    const [dup] = await db
      .select({ id: orgDrugs.id })
      .from(orgDrugs)
      .where(
        and(
          eq(orgDrugs.organizationId, session.orgId),
          eq(sql`lower(${orgDrugs.name})`, name.toLowerCase())
        )
      );
    if (dup) return apiError("A drug with this name already exists in your formulary", 409);

    const now = Date.now();
    const drug = {
      id:               crypto.randomUUID(),
      organizationId:   session.orgId,
      name,
      defaultDosage:    defaultDosage || null,
      defaultFrequency: defaultFrequency || null,
      defaultDuration:  defaultDuration || null,
      createdAt:        now,
    };

    await db.insert(orgDrugs).values(drug);
    return apiOk({ drug }, 201);
  }
);
