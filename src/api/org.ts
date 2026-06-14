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

import { apiFetch } from "./_client";
import type {
  OrgProfile,
  StaffMember,
  OrgRole,
  SalaryRecord,
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

export function uploadLogo(file: File): Promise<{ logoUrl: string }> {
  const fd = new FormData();
  fd.append("logo", file);
  // Don't pass Content-Type header — browser sets multipart boundary automatically
  return apiFetch<{ logoUrl: string }>("/api/org/logo", {
    method: "POST",
    body: fd,
    headers: {},
  });
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
  drugs: {
    list:   listOrgDrugs,
    add:    addOrgDrug,
    delete: deleteOrgDrug,
  },
};

async function acceptDpa(): Promise<{ accepted: boolean; version: string }> {
  return apiFetch("/api/org/accept-dpa", { method: "POST" });
}
