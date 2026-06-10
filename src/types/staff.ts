/**
 * types/staff.ts
 *
 * TypeScript shapes for staff members (doctors, nurses, etc.),
 * their roles, and their salary records.
 */

// ─── System role ──────────────────────────────────────────────────────────────

/** The built-in system roles. Determines what a staff member can do by default. */
export type SystemRole =
  | "ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "RECEPTIONIST"
  | "ATTENDANT"
  | "HELPER";

// ─── Staff member ─────────────────────────────────────────────────────────────

export interface StaffMember {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  bloodGroup?: string | null;
  /** Only visible to ADMIN. Encrypted at rest. */
  panNumber?: string | null;
  /** Only visible to ADMIN. Encrypted at rest. */
  aadhaarNumber?: string | null;
  profileImageUrl?: string | null;
  role: SystemRole;
  orgRoleId?: string | null;
  orgRoleName?: string | null;
  orgRoleColor?: string | null;
  salaryType?: "FIXED" | "PER_APPOINTMENT";
  salaryAmount?: number;
  joinedAt?: string | null;
  isActive: 0 | 1;
  isDoctor: 0 | 1;
  isVerified: 0 | 1;
  portalAccess: 0 | 1;
  createdAt: number;
}

// ─── Custom role ──────────────────────────────────────────────────────────────

export interface OrgRole {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  color: string;
  isSystem: 0 | 1;
  permissions: string[];
  userCount: number;
}

// ─── Salary record ────────────────────────────────────────────────────────────

export interface SalaryRecord {
  id: string;
  userId: string;
  month: string;               // "YYYY-MM"
  salaryAmount: number;
  salaryType: "FIXED" | "PER_APPOINTMENT";
  appointmentCount: number;
  paidAmount: number;
  paidAt?: number | null;
  status: "PENDING" | "PAID" | "PARTIALLY_PAID";
  notes?: string | null;
  userName?: string | null;
  userEmail?: string | null;
}
