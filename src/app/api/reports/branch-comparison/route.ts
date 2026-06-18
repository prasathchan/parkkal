/**
 * GET /api/reports/branch-comparison?period=30d&from=&to=
 *
 * Returns side-by-side metrics for every active branch so admins can compare
 * performance across locations in a single view.
 *
 * Response: [{ locationId, locationName, visits, billed, collected, appointments, collectionRate }]
 */
import { eq, and, gte, lte, count, sum, ne } from "drizzle-orm";
import { visits, payments, appointments, locations } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export const GET = withRoute(
  { route: "GET /api/reports/branch-comparison", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.REPORTS_VIEW },
  async (req, { session, db }) => {
    const { searchParams } = new URL(req.url);
    const fromParam  = searchParams.get("from");
    const toParam    = searchParams.get("to");
    const period     = searchParams.get("period") ?? "30d";

    const now = Date.now();
    let start: number, end: number;
    if (fromParam && toParam) {
      start = dayStart(new Date(fromParam));
      end   = dayStart(new Date(toParam)) + 86_400_000;
    } else {
      const days = period === "365d" ? 365 : period === "90d" ? 90 : period === "7d" ? 7 : 30;
      start = dayStart(new Date(now - (days - 1) * 86_400_000));
      end   = dayStart(new Date(now)) + 86_400_000;
    }

    const orgId = session.orgId;

    const locs = await db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(and(eq(locations.organizationId, orgId), eq(locations.isActive, 1)))
      .orderBy(locations.isDefault, locations.createdAt);

    const results = await Promise.all(
      locs.map(async (loc: { id: string; name: string }) => {
        const locFilter = and(
          eq(visits.organizationId, orgId),
          eq(visits.locationId, loc.id),
          gte(visits.createdAt, start),
          lte(visits.createdAt, end),
          ne(visits.status, "CANCELLED"),
        );

        const apptFilter = and(
          eq(appointments.organizationId, orgId),
          eq(appointments.locationId, loc.id),
          gte(appointments.createdAt, start),
          lte(appointments.createdAt, end),
        );

        const [[visitRow], [billedRow], [collectedRow], [apptRow]] = await Promise.all([
          db.select({ val: count() }).from(visits).where(locFilter),
          db.select({ val: sum(visits.totalAmount) }).from(visits).where(locFilter),
          db.select({ val: sum(payments.amount) }).from(payments)
            .innerJoin(visits, eq(payments.visitId, visits.id))
            .where(and(
              eq(visits.organizationId, orgId),
              eq(visits.locationId, loc.id),
              gte(payments.paidAt, start),
              lte(payments.paidAt, end),
            )),
          db.select({ val: count() }).from(appointments).where(apptFilter),
        ]);

        const billed    = Number(billedRow?.val)    || 0;
        const collected = Number(collectedRow?.val) || 0;

        return {
          locationId:     loc.id,
          locationName:   loc.name,
          visits:         Number(visitRow?.val)  || 0,
          appointments:   Number(apptRow?.val)   || 0,
          billed,
          collected,
          collectionRate: billed > 0 ? Math.round((collected / billed) * 100) : 100,
        };
      })
    );

    return apiOk({ branches: results, period: { start, end } });
  }
);
