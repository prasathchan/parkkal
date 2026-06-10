/**
 * api/users.ts
 *
 * Lightweight user list — all active org members with their role.
 * Available to all roles (used for dropdowns like the doctor picker).
 *
 * For full staff management (salary, personal details, permissions),
 * use orgApi.members which requires staff.view permission.
 *
 * HOW TO USE:
 *   import { usersApi } from "@/api";
 *
 *   const { users } = await usersApi.list();
 */

import { apiFetch } from "./_client";
import type { UserSummary } from "@/types";

export function listUsers(): Promise<{ users: UserSummary[] }> {
  return apiFetch<{ users: UserSummary[] }>("/api/users");
}

export interface UpdateUserPayload {
  name?: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  bloodGroup?: string | null;
}

export function updateUser(
  userId: string,
  data: UpdateUserPayload,
): Promise<{ user: UserSummary }> {
  return apiFetch<{ user: UserSummary }>(`/api/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export const usersApi = {
  list:   listUsers,
  update: updateUser,
};
