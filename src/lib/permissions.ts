/**
 * lib/permissions.ts
 *
 * Controls who can do what in the app.
 *
 * PERMISSIONS are strings like "patients.view", "billing.create".
 * They are stored in the JWT when a staff member logs in (so we don't
 * need to hit the database on every API request).
 *
 * hasPermission(session, PERMISSIONS.PATIENTS_VIEW) → true/false
 *
 * ADDING A NEW PERMISSION:
 *  1. Add the constant below (e.g. APPOINTMENTS_EXPORT: "appointments.export")
 *  2. Add it to the relevant roles in src/lib/default-roles.ts
 *  3. Use hasPermission() in the API route that needs protecting
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgRoles } from "@/db/schema";

// ── Permission constants ──────────────────────────────────────────────────────

export const PERMISSIONS = {
  // Patients
  PATIENTS_VIEW: "patients.view",
  PATIENTS_CREATE: "patients.create",
  PATIENTS_EDIT: "patients.edit",
  PATIENTS_DELETE: "patients.delete",
  // Appointments
  APPOINTMENTS_VIEW: "appointments.view",
  APPOINTMENTS_CREATE: "appointments.create",
  APPOINTMENTS_EDIT: "appointments.edit",
  APPOINTMENTS_DELETE: "appointments.delete",
  // Visits
  VISITS_VIEW: "visits.view",
  VISITS_CREATE: "visits.create",
  VISITS_EDIT: "visits.edit",
  VISITS_DELETE: "visits.delete",
  // Treatments
  TREATMENTS_VIEW: "treatments.view",
  TREATMENTS_CREATE: "treatments.create",
  TREATMENTS_EDIT: "treatments.edit",
  TREATMENTS_DELETE: "treatments.delete",
  // Billing
  BILLING_VIEW: "billing.view",
  BILLING_CREATE: "billing.create",
  BILLING_EDIT: "billing.edit",
  // Staff
  STAFF_VIEW: "staff.view",
  STAFF_MANAGE: "staff.manage",
  // Salary
  SALARY_VIEW: "salary.view",
  SALARY_MANAGE: "salary.manage",
  // Org
  ORG_SETTINGS: "org.settings",
  // Reports
  REPORTS_VIEW: "reports.view",
  // Roles
  ROLES_MANAGE: "roles.manage",
  // Locations (branches)
  LOCATIONS_MANAGE: "locations.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ── Coarse-role defaults (backward-compat fallback when orgRoleId is null) ───

const ROLE_PERMS: Record<string, Permission[]> = {
  ADMIN: Object.values(PERMISSIONS) as Permission[],
  DOCTOR: [
    PERMISSIONS.PATIENTS_VIEW,
    PERMISSIONS.PATIENTS_EDIT,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_CREATE,
    PERMISSIONS.APPOINTMENTS_EDIT,
    PERMISSIONS.VISITS_VIEW,
    PERMISSIONS.VISITS_CREATE,
    PERMISSIONS.VISITS_EDIT,
    PERMISSIONS.TREATMENTS_VIEW,
    PERMISSIONS.TREATMENTS_CREATE,
    PERMISSIONS.TREATMENTS_EDIT,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_CREATE,
    PERMISSIONS.BILLING_EDIT,
    PERMISSIONS.REPORTS_VIEW,
  ],
  NURSE: [
    PERMISSIONS.PATIENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.VISITS_VIEW,
    PERMISSIONS.VISITS_CREATE,
    PERMISSIONS.TREATMENTS_VIEW,
    PERMISSIONS.BILLING_VIEW,
  ],
  RECEPTIONIST: [
    PERMISSIONS.PATIENTS_VIEW,
    PERMISSIONS.PATIENTS_CREATE,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_CREATE,
    PERMISSIONS.APPOINTMENTS_EDIT,
    PERMISSIONS.VISITS_VIEW,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_CREATE,
  ],
  ATTENDANT: [PERMISSIONS.PATIENTS_VIEW, PERMISSIONS.APPOINTMENTS_VIEW],
  HELPER: [],
};

export function coarseRoleHasPermission(role: string, permission: Permission): boolean {
  return (ROLE_PERMS[role] ?? []).includes(permission);
}

// ── Fine-grained permission check ─────────────────────────────────────────────

export async function hasPermission(
  session: { role: string; orgRoleId?: string | null; permissions?: string[] | null },
  permission: Permission
): Promise<boolean> {
  // ADMIN always has all permissions
  if (session.role === "ADMIN") return true;

  // Fast path: permissions embedded in JWT (no DB query needed).
  if (Array.isArray(session.permissions)) {
    return session.permissions.includes(permission);
  }

  // No custom role → fall back to coarse role defaults
  if (!session.orgRoleId) return coarseRoleHasPermission(session.role, permission);

  // Slow path: legacy token without embedded permissions — query DB once.
  const db = getDb();
  const [role] = await db
    .select({ permissions: orgRoles.permissions })
    .from(orgRoles)
    .where(eq(orgRoles.id, session.orgRoleId));

  if (!role) return coarseRoleHasPermission(session.role, permission);

  try {
    const perms = JSON.parse(role.permissions) as string[];
    return perms.includes(permission);
  } catch {
    return coarseRoleHasPermission(session.role, permission);
  }
}

// ── Helper: resolve permissions for a role at token-mint time ────────────────

export async function resolveRolePermissions(
  role: string,
  orgRoleId: string | null | undefined
): Promise<string[]> {
  // ADMIN always gets all permissions
  if (role === "ADMIN") return Object.values(PERMISSIONS);

  if (!orgRoleId) {
    // No custom role → return coarse defaults
    return (ROLE_PERMS[role] ?? []) as string[];
  }

  const db = getDb();
  const [row] = await db
    .select({ permissions: orgRoles.permissions })
    .from(orgRoles)
    .where(eq(orgRoles.id, orgRoleId));

  if (!row) return (ROLE_PERMS[role] ?? []) as string[];

  try {
    return JSON.parse(row.permissions) as string[];
  } catch {
    return (ROLE_PERMS[role] ?? []) as string[];
  }
}
