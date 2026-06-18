import { eq, inArray } from "drizzle-orm";
import { locations, locationSettings } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { generateId } from "@/lib/utils";
import { z } from "zod";

const createSchema = z.object({
  name:                    z.string().min(1).max(100),
  address:                 z.string().max(500).optional(),
  phone:                   z.string().max(30).optional(),
  gstin:                   z.string().max(20).optional(),
  timezone:                z.string().max(60).optional().default("Asia/Kolkata"),
  openingTime:             z.string().regex(/^\d{2}:\d{2}$/).optional().default("09:00"),
  closingTime:             z.string().regex(/^\d{2}:\d{2}$/).optional().default("18:00"),
  slotDurationMinutes:     z.number().int().min(10).max(120).optional().default(30),
  maxAdvanceBookingDays:   z.number().int().min(1).max(365).optional().default(60),
});

export const GET = withRoute(
  { route: "GET /api/locations", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.ORG_SETTINGS },
  async (_req, { session, db }) => {
    const rows = await db
      .select()
      .from(locations)
      .where(eq(locations.organizationId, session.orgId))
      .orderBy(locations.isDefault, locations.createdAt);

    const locationIds = rows.map((l: typeof rows[number]) => l.id);
    const settingsRows = locationIds.length > 0
      ? await db.select().from(locationSettings).where(inArray(locationSettings.locationId, locationIds))
      : [];

    type SettingsRow = typeof settingsRows[number];
    const settingsMap = Object.fromEntries(settingsRows.map((s: SettingsRow) => [s.locationId, s]));
    const result = rows.map((loc: typeof rows[number]) => ({
      ...loc,
      settings: settingsMap[loc.id] ?? null,
    }));

    return apiOk({ locations: result });
  }
);

export const POST = withRoute(
  { route: "POST /api/locations", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.LOCATIONS_MANAGE },
  async (req, { session, db }) => {
    const body = createSchema.safeParse(await req.json());
    if (!body.success) return apiError("Invalid location data", 422);

    const { name, address, phone, gstin, timezone, openingTime, closingTime, slotDurationMinutes, maxAdvanceBookingDays } = body.data;
    const now = Date.now();
    const id = generateId();

    await db.insert(locations).values({
      id,
      organizationId: session.orgId,
      name,
      address: address ?? null,
      phone: phone ?? null,
      gstin: gstin ?? null,
      timezone: timezone ?? "Asia/Kolkata",
      isActive: 1,
      isDefault: 0,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(locationSettings).values({
      locationId: id,
      openingTime: openingTime ?? "09:00",
      closingTime: closingTime ?? "18:00",
      slotDurationMinutes: slotDurationMinutes ?? 30,
      maxAdvanceBookingDays: maxAdvanceBookingDays ?? 60,
      updatedAt: now,
    });

    const [location] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, id));

    return apiOk({ location }, 201);
  }
);
