/**
 * api/org.ts
 *
 * API calls for organisation management: profile, logo, members, roles, salary.
 *
 * HOW TO USE:
 *   import { orgApi } from "@/api";
 *
 *   const { profile } = await orgApi.getProfile();
 *   const { members } = await orgApi.listMembers();
 *   await orgApi.updateProfile({ name: "Parkkal Dental" });
 */

import { apiFetch, ApiError } from "./_client";
import type {
  OrgProfile,
  StaffMember,
  OrgRole,
  SalaryRecord,
  StaffProfile,
  CredentialDoc,
  CredentialDocType,
} from "@/types";

// ─── Profile ──────────────────────────────────────────────────────────────────

export function getOrgProfile(): Promise<{ organization: OrgProfile }> {
  return apiFetch<{ organization: OrgProfile }>("/api/org/profile");
}

export interface UpdateOrgProfilePayload {
  name?: string;
  tagline?: string | null;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  registrationNumber?: string;
  themeConfig?: unknown;
  timezone?: string;
}

export function updateOrgProfile(
  data: UpdateOrgProfilePayload,
): Promise<{ organization: OrgProfile }> {
  return apiFetch<{ organization: OrgProfile }>("/api/org/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

export async function uploadLogo(file: File): Promise<{ logoUrl: string }> {
  const fd = new FormData();
  fd.append("logo", file);
  // Use raw fetch — apiFetch always sets Content-Type: application/json which
  // overwrites the multipart/form-data boundary the browser must set itself.
  const res = await fetch("/api/org/logo", { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new ApiError(res.status, body.error || `Upload failed (${res.status})`);
  }
  return res.json() as Promise<{ logoUrl: string }>;
}

export function deleteLogo(): Promise<{ success: true }> {
  return apiFetch<{ success: true }>("/api/org/logo", { method: "DELETE" });
}

// ─── Members ──────────────────────────────────────────────────────────────────

export function listMembers(): Promise<{ members: StaffMember[] }> {
  return apiFetch<{ members: StaffMember[] }>("/api/org/members");
}

export interface AddMemberPayload {
  email: string;
  name?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  panNumber?: string;
  aadhaarNumber?: string;
  role: string;
  orgRoleId?: string;
  activationMode?: "invite_link" | "set_password" | "send_otp" | "no_login_verify";
  password?: string;
  salaryType?: "FIXED" | "PER_APPOINTMENT";
  salaryAmount?: number;
  isActive?: boolean;
  isDoctor?: boolean;
  joinedAt?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  };
}

export function addMember(data: AddMemberPayload): Promise<{ member: StaffMember }> {
  return apiFetch<{ member: StaffMember }>("/api/org/members", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateMember(
  memberId: string,
  data: Partial<AddMemberPayload>,
): Promise<{ member: StaffMember }> {
  return apiFetch<{ member: StaffMember }>(`/api/org/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteMember(memberId: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/org/members/${memberId}`, {
    method: "DELETE",
  });
}

export function sendMemberActivation(
  memberId: string,
  mode: string,
): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/org/members/${memberId}/send-activation`, {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export function listRoles(): Promise<{ roles: OrgRole[] }> {
  return apiFetch<{ roles: OrgRole[] }>("/api/org/roles");
}

export interface UpsertRolePayload {
  name: string;
  description?: string;
  color?: string;
  permissions: string[];
}

export function createRole(data: UpsertRolePayload): Promise<{ role: OrgRole }> {
  return apiFetch<{ role: OrgRole }>("/api/org/roles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateRole(
  roleId: string,
  data: UpsertRolePayload,
): Promise<{ role: OrgRole }> {
  return apiFetch<{ role: OrgRole }>(`/api/org/roles/${roleId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteRole(roleId: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/org/roles/${roleId}`, {
    method: "DELETE",
  });
}

export function migrateRole(
  roleId: string,
  targetRoleId: string,
): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/org/roles/${roleId}/migrate`, {
    method: "POST",
    body: JSON.stringify({ targetRoleId }),
  });
}

// ─── Salary ───────────────────────────────────────────────────────────────────

export function listSalary(month?: string): Promise<{ records: SalaryRecord[]; month: string }> {
  const q = month ? `?month=${encodeURIComponent(month)}` : "";
  return apiFetch<{ records: SalaryRecord[]; month: string }>(`/api/org/salary${q}`);
}

export function generateSalary(month: string): Promise<{ records: SalaryRecord[] }> {
  return apiFetch<{ records: SalaryRecord[] }>("/api/org/salary", {
    method: "POST",
    body: JSON.stringify({ month }),
  });
}

export interface UpdateSalaryPayload {
  paidAmount?: number;
  status?: "PENDING" | "PAID" | "PARTIALLY_PAID";
  notes?: string;
}

export function updateSalaryRecord(
  id: string,
  data: UpdateSalaryPayload,
): Promise<{ record: SalaryRecord }> {
  return apiFetch<{ record: SalaryRecord }>(`/api/org/salary/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Delete org ───────────────────────────────────────────────────────────────

export function deleteOrg(confirmName: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>("/api/org/delete", {
    method: "POST",
    body: JSON.stringify({ confirmName }),
  });
}

// ─── Onboarding dismiss ───────────────────────────────────────────────────────

export function dismissOnboarding(): Promise<{ success: true }> {
  return apiFetch<{ success: true }>("/api/org/onboarding/dismiss", { method: "POST" });
}

// ─── Drug formulary ───────────────────────────────────────────────────────────

export interface OrgDrug {
  id: string;
  organizationId: string;
  name: string;
  defaultDosage: string | null;
  defaultFrequency: string | null;
  defaultDuration: string | null;
  createdAt: number;
}

export interface AddOrgDrugPayload {
  name: string;
  defaultDosage?: string;
  defaultFrequency?: string;
  defaultDuration?: string;
}

export function listOrgDrugs(): Promise<{ drugs: OrgDrug[] }> {
  return apiFetch<{ drugs: OrgDrug[] }>("/api/org/drugs");
}

export function addOrgDrug(data: AddOrgDrugPayload): Promise<{ drug: OrgDrug }> {
  return apiFetch<{ drug: OrgDrug }>("/api/org/drugs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteOrgDrug(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/org/drugs/${id}`, { method: "DELETE" });
}

// ─── Staff professional profile ───────────────────────────────────────────────

export function getStaffProfile(userId: string): Promise<{ profile: StaffProfile | null }> {
  return apiFetch<{ profile: StaffProfile | null }>(`/api/org/members/${userId}/profile`);
}

export interface UpdateStaffProfilePayload {
  bio?: string | null;
  specialization?: string | null;
  yearsExperience?: number | null;
  languages?: string[];
  qualifications?: Array<{ id: string; degree: string; institution: string; year: string; notes?: string }>;
  idaNumber?: string | null;
  dciNumber?: string | null;
  stateCouncilNumber?: string | null;
  licenseExpiry?: string | null;
  previousEmployer?: string | null;
}

export function updateStaffProfile(
  userId: string,
  data: UpdateStaffProfilePayload,
): Promise<{ profile: StaffProfile }> {
  return apiFetch<{ profile: StaffProfile }>(`/api/org/members/${userId}/profile`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function uploadStaffDoc(
  userId: string,
  file: File,
  docType: CredentialDocType,
): Promise<{ document: CredentialDoc }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("docType", docType);
  const res = await fetch(`/api/org/members/${userId}/profile/docs`, { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new ApiError(res.status, body.error || `Upload failed (${res.status})`);
  }
  return res.json() as Promise<{ document: CredentialDoc }>;
}

export function deleteStaffDoc(userId: string, docId: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/org/members/${userId}/profile/docs?docId=${encodeURIComponent(docId)}`, {
    method: "DELETE",
  });
}

export function reviewStaffDoc(
  userId: string,
  docId: string,
  action: "approve" | "reject",
  reviewNote?: string,
): Promise<{ document: CredentialDoc }> {
  return apiFetch<{ document: CredentialDoc }>(`/api/org/members/${userId}/profile/docs/${docId}`, {
    method: "PATCH",
    body: JSON.stringify({ action, reviewNote }),
  });
}

// ─── Self-service profile (own user) ─────────────────────────────────────────

export function getMyProfile(): Promise<{ user: { id: string; name: string; email: string; phone: string | null; dateOfBirth: string | null; gender: string | null; role: string }; profile: StaffProfile | null }> {
  return apiFetch("/api/profile");
}

export function updateMyProfile(data: UpdateStaffProfilePayload & { name?: string; phone?: string | null; dateOfBirth?: string | null; gender?: string | null }): Promise<{ success: true }> {
  return apiFetch("/api/profile", { method: "PATCH", body: JSON.stringify(data) });
}

export async function uploadMyDoc(file: File, docType: CredentialDocType): Promise<{ document: CredentialDoc }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("docType", docType);
  const res = await fetch("/api/profile/docs", { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new ApiError(res.status, body.error || `Upload failed (${res.status})`);
  }
  return res.json() as Promise<{ document: CredentialDoc }>;
}

// ─── Grouped export ───────────────────────────────────────────────────────────

export const orgApi = {
  getProfile:    getOrgProfile,
  updateProfile: updateOrgProfile,
  uploadLogo,
  deleteLogo,
  members: {
    list:           listMembers,
    add:            addMember,
    update:         updateMember,
    delete:         deleteMember,
    sendActivation: sendMemberActivation,
  },
  roles: {
    list:    listRoles,
    create:  createRole,
    update:  updateRole,
    delete:  deleteRole,
    migrate: migrateRole,
  },
  salary: {
    list:     listSalary,
    generate: generateSalary,
    update:   updateSalaryRecord,
  },
  delete:            deleteOrg,
  dismissOnboarding: dismissOnboarding,
  acceptDpa:         acceptDpa,
  profile: {
    get:       getStaffProfile,
    update:    updateStaffProfile,
    uploadDoc: uploadStaffDoc,
    deleteDoc: deleteStaffDoc,
    reviewDoc: reviewStaffDoc,
  },
  myProfile: {
    get:       getMyProfile,
    update:    updateMyProfile,
    uploadDoc: uploadMyDoc,
  },
  drugs: {
    list:   listOrgDrugs,
    add:    addOrgDrug,
    delete: deleteOrgDrug,
  },
};

async function acceptDpa(): Promise<{ accepted: boolean; version: string }> {
  return apiFetch("/api/org/accept-dpa", { method: "POST" });
}
