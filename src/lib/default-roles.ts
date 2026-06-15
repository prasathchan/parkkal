/**
 * lib/default-roles.ts
 *
 * The five default staff roles and their permission sets.
 * Used when a new organisation is created — these roles are seeded automatically.
 *
 * ─── THE ROLES ────────────────────────────────────────────────────────────────
 *
 *   Administrator  Full access to everything.
 *   Doctor         Clinical access — patients, visits, treatments, billing, reports.
 *   Receptionist   Front-desk — patients, appointments, billing. No clinical write access.
 *   Nurse          Clinical support — can view patients and create/view visits.
 *   Attendant      Read-only — can only view patients and appointments.
 *
 * ─── CUSTOMISATION ───────────────────────────────────────────────────────────
 * Organisations can create custom roles via the Roles settings page.
 * These defaults are only used at org creation time or as a fallback.
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *   ALL_PERMISSIONS   — flat array of every permission string in the system
 *   DefaultRole       — TypeScript shape for a role definition
 *   DEFAULT_ROLES     — the five pre-built roles with their permission sets
 */
export const ALL_PERMISSIONS = [
  "patients.view", "patients.create", "patients.edit", "patients.delete",
  "appointments.view", "appointments.create", "appointments.edit", "appointments.delete",
  "visits.view", "visits.create", "visits.edit", "visits.delete",
  "treatments.view", "treatments.create", "treatments.edit", "treatments.delete",
  "billing.view", "billing.create", "billing.edit",
  "staff.view", "staff.manage",
  "salary.view", "salary.manage",
  "org.settings",
  "reports.view",
  "roles.manage",
];

export interface DefaultRole {
  name: string;
  slug: string;
  color: string;
  description: string;
  isSystem: number;
  permissions: string[];
}

export const DEFAULT_ROLES: DefaultRole[] = [
  {
    name: "Administrator",
    slug: "administrator",
    color: "#0B6E6E",
    description: "Full access to all features and settings",
    isSystem: 1,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: "Doctor",
    slug: "doctor",
    color: "#10B981",
    description: "Clinical access — patients, visits, treatment plans",
    isSystem: 0,
    permissions: [
      "patients.view", "patients.create", "patients.edit",
      "appointments.view", "appointments.create", "appointments.edit",
      "visits.view", "visits.create", "visits.edit",
      "treatments.view", "treatments.create", "treatments.edit",
      "billing.view", "billing.create", "billing.edit",
      "reports.view",
    ],
  },
  {
    name: "Receptionist",
    slug: "receptionist",
    color: "#645D50",
    description: "Front desk — patients, appointments, billing",
    isSystem: 0,
    permissions: [
      "patients.view", "patients.create",
      "appointments.view", "appointments.create", "appointments.edit",
      "visits.view",
      "billing.view", "billing.create", "billing.edit",
    ],
  },
  {
    name: "Nurse",
    slug: "nurse",
    color: "#F59E0B",
    description: "Clinical support — view patients and assist with visits",
    isSystem: 0,
    permissions: [
      "patients.view",
      "appointments.view",
      "visits.view", "visits.create",
      "treatments.view",
    ],
  },
  {
    name: "Attendant",
    slug: "attendant",
    color: "#6B7280",
    description: "Basic access — view patients and appointments",
    isSystem: 0,
    permissions: [
      "patients.view",
      "appointments.view",
    ],
  },
];
