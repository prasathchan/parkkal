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

// ─── Professional profile ─────────────────────────────────────────────────────

export interface Qualification {
  id: string;
  degree: string;       // e.g. "BDS", "MDS"
  institution: string;  // e.g. "SRM Dental College"
  year: string;         // e.g. "2015"
  notes?: string;       // e.g. "Specialization: Orthodontics"
}

export type CredentialDocType =
  | "DEGREE_CERTIFICATE"
  | "REGISTRATION_CERTIFICATE"
  | "IDA_CARD"
  | "DCI_CARD"
  | "GOVERNMENT_ID"
  | "TRAINING_CERT"
  | "OTHER";

export interface CredentialDoc {
  id: string;
  docType: CredentialDocType;
  originalName: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: number;
  // Admin review workflow — defaults to PENDING on staff self-upload, VERIFIED on admin upload
  status: "PENDING" | "VERIFIED" | "REJECTED";
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: number | null;
}

export interface StaffProfile {
  userId: string;
  bio?: string | null;
  specialization?: string | null;
  yearsExperience?: number | null;
  languages: string[];
  qualifications: Qualification[];
  idaNumber?: string | null;
  dciNumber?: string | null;
  stateCouncilNumber?: string | null;
  licenseExpiry?: string | null;
  previousEmployer?: string | null;
  documents: CredentialDoc[];
  createdAt: number;
  updatedAt: number;
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
