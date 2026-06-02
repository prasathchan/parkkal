export const ALL_PERMISSIONS = [
  "patients.view", "patients.create", "patients.edit", "patients.delete",
  "visits.view", "visits.create", "visits.edit",
  "billing.view", "billing.manage",
  "staff.view", "staff.manage",
  "salary.view", "salary.manage",
  "settings.manage",
  "reports.view",
  "roles.manage",
  "appointments.view", "appointments.create", "appointments.edit",
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
    color: "#3B82F6",
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
      "visits.view", "visits.create", "visits.edit",
      "appointments.view", "appointments.create", "appointments.edit",
      "billing.view",
      "reports.view",
    ],
  },
  {
    name: "Receptionist",
    slug: "receptionist",
    color: "#8B5CF6",
    description: "Front desk — patients, appointments, billing",
    isSystem: 0,
    permissions: [
      "patients.view", "patients.create",
      "appointments.view", "appointments.create", "appointments.edit",
      "visits.view",
      "billing.view", "billing.manage",
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
      "visits.view", "visits.create",
      "appointments.view",
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
