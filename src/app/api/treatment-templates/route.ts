import { eq, and, desc } from "drizzle-orm";
import { treatmentTemplates } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

// ── GET /api/treatment-templates ─────────────────────────────────────────────
export const GET = withRoute(
  { route: "GET /api/treatment-templates", permission: PERMISSIONS.TREATMENTS_VIEW },
  async (_req, { session, db }) => {
    const rows = await db
      .select()
      .from(treatmentTemplates)
      .where(eq(treatmentTemplates.organizationId, session.orgId))
      .orderBy(desc(treatmentTemplates.createdAt));
    return apiOk({ templates: rows });
  }
);

// ── POST /api/treatment-templates ────────────────────────────────────────────
const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  procedure: z.string().max(500).optional(),
  defaultCost: z.number().min(0).default(0),
});

export const POST = withRoute(
  { route: "POST /api/treatment-templates", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.TREATMENTS_CREATE },
  async (req, { session, db, log }) => {
    if (!["ADMIN", "DOCTOR"].includes(session.role)) {
      log.security("Permission denied: only ADMIN/DOCTOR can create templates", { role: session.role });
      return apiError("Forbidden", 403);
    }

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiError("Invalid input", 400);

    const id = crypto.randomUUID();
    await db.insert(treatmentTemplates).values({
      id,
      organizationId: session.orgId,
      name: parsed.data.name,
      description: parsed.data.description,
      procedure: parsed.data.procedure ?? null,
      defaultCost: parsed.data.defaultCost,
      createdBy: session.userId,
      createdAt: Date.now(),
    });

    log.info("Treatment template created", { id, name: parsed.data.name });
    return apiOk({ template: { id, ...parsed.data } }, 201);
  }
);
