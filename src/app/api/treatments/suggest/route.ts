import { eq, and, like, desc } from "drizzle-orm";
import { treatments } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk } from "@/lib/api";

// ── GET /api/treatments/suggest?q= ────────────────────────────────────────────
// Returns up to 10 distinct treatment descriptions matching the query,
// drawn from this org's historical treatments. Powers description autocomplete.
export const GET = withRoute(
  { route: "GET /api/treatments/suggest", permission: PERMISSIONS.TREATMENTS_VIEW },
  async (req, { session, db }) => {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return apiOk({ suggestions: [] });

    const rows = await db
      .select({ description: treatments.description })
      .from(treatments)
      .where(and(
        eq(treatments.organizationId, session.orgId),
        like(treatments.description, `%${q}%`),
      ))
      .orderBy(desc(treatments.createdAt))
      .limit(50);

    // Deduplicate preserving order, return up to 10
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const r of rows) {
      const key = r.description.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push(r.description);
        if (suggestions.length >= 10) break;
      }
    }

    return apiOk({ suggestions });
  }
);
