import { eq, and } from "drizzle-orm";
import { locations, locationSettings } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { z } from "zod";

const updateSchema = z.object({
  name:                    z.string().min(1).max(100).optional(),
  address:                 z.string().max(500).nullable().optional(),
  phone:                   z.string().max(30).nullable().optional(),
  gstin:                   z.string().max(20).nullable().optional(),
  timezone:                z.string().max(60).optional(),
  isActive:                z.number().int().min(0).max(1).optional(),
  openingTime:             z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closingTime:             z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotDurationMinutes:     z.number().int().min(10).max(120).optional(),
  maxAdvanceBookingDays:   z.number().int().min(1).max(365).optional(),
});

export const GET = withRoute<{ id: string }>(
  { route: "GET /api/locations/[id]", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.ORG_SETTINGS },
  async (_req, { session, db }, { id }) => {
    const [location] = await db
      .select()
      .from(locations)
      .where(and(eq(locations.id, id), eq(locations.organizationId, session.orgId)));

    if (!location) return apiError("Location not found", 404);

    const [settings] = await db
      .select()
      .from(locationSettings)
      .where(eq(locationSettings.locationId, id));

    return apiOk({ location: { ...location, settings: settings ?? null } });
  }
);

export const PATCH = withRoute<{ id: string }>(
  { route: "PATCH /api/locations/[id]", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.LOCATIONS_MANAGE },
  async (req, { session, db }, { id }) => {
    const body = updateSchema.safeParse(await req.json());
    if (!body.success) return apiError("Invalid update data", 422);

    const [existing] = await db
      .select({ id: locations.id, isDefault: locations.isDefault })
      .from(locations)
      .where(and(eq(locations.id, id), eq(locations.organizationId, session.orgId)));

    if (!existing) return apiError("Location not found", 404);

    const now = Date.now();
    const {
      name, address, phone, gstin, timezone, isActive,
      openingTime, closingTime, slotDurationMinutes, maxAdvanceBookingDays,
    } = body.data;

    const locationUpdates: Record<string, unknown> = { updatedAt: now };
    if (name !== undefined) locationUpdates.name = name;
    if (address !== undefined) locationUpdates.address = address;
    if (phone !== undefined) locationUpdates.phone = phone;
    if (gstin !== undefined) locationUpdates.gstin = gstin;
    if (timezone !== undefined) locationUpdates.timezone = timezone;
    if (isActive !== undefined) locationUpdates.isActive = isActive;

    if (Object.keys(locationUpdates).length > 1) {
      await db
        .update(locations)
        .set(locationUpdates)
        .where(and(eq(locations.id, id), eq(locations.organizationId, session.orgId)));
    }

    const settingsUpdates: Record<string, unknown> = { updatedAt: now };
    if (openingTime !== undefined) settingsUpdates.openingTime = openingTime;
    if (closingTime !== undefined) settingsUpdates.closingTime = closingTime;
    if (slotDurationMinutes !== undefined) settingsUpdates.slotDurationMinutes = slotDurationMinutes;
    if (maxAdvanceBookingDays !== undefined) settingsUpdates.maxAdvanceBookingDays = maxAdvanceBookingDays;

    if (Object.keys(settingsUpdates).length > 1) {
      await db
        .update(locationSettings)
        .set(settingsUpdates)
        .where(eq(locationSettings.locationId, id));
    }

    const [updated] = await db
      .select()
      .from(locations)
      .where(and(eq(locations.id, id), eq(locations.organizationId, session.orgId)));

    const [updatedSettings] = await db
      .select()
      .from(locationSettings)
      .where(eq(locationSettings.locationId, id));

    return apiOk({ location: { ...updated, settings: updatedSettings ?? null } });
  }
);

export const DELETE = withRoute<{ id: string }>(
  { route: "DELETE /api/locations/[id]", rateLimit: RATE_LIMITS.DESTRUCTIVE, permission: PERMISSIONS.LOCATIONS_MANAGE },
  async (_req, { session, db }, { id }) => {
    const [existing] = await db
      .select({ id: locations.id, isDefault: locations.isDefault })
      .from(locations)
      .where(and(eq(locations.id, id), eq(locations.organizationId, session.orgId)));

    if (!existing) return apiError("Location not found", 404);
    if (existing.isDefault) return apiError("Cannot delete the default location", 400);

    await db.delete(locationSettings).where(eq(locationSettings.locationId, id));
    await db
      .delete(locations)
      .where(and(eq(locations.id, id), eq(locations.organizationId, session.orgId)));

    return apiOk({ deleted: true });
  }
);
