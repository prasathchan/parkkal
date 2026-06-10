/**
 * api/auth.ts
 *
 * Auth-related API calls available from the dashboard
 * (session info, logout, password change).
 *
 * HOW TO USE:
 *   import { authApi } from "@/api";
 *
 *   const { user } = await authApi.me();
 *   await authApi.logout();
 */

import { apiFetch } from "./_client";
import type { SessionUser } from "@/types";

// ─── Current session ──────────────────────────────────────────────────────────

export function getMe(): Promise<{ user: SessionUser }> {
  return apiFetch<{ user: SessionUser }>("/api/auth/me");
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export function logout(): Promise<{ success: true }> {
  return apiFetch<{ success: true }>("/api/auth/logout", { method: "POST" });
}

// ─── Change password ──────────────────────────────────────────────────────────

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export function changePassword(
  data: ChangePasswordPayload,
): Promise<{ success: true }> {
  return apiFetch<{ success: true }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Grouped export ───────────────────────────────────────────────────────────

export const authApi = {
  me:             getMe,
  logout,
  changePassword,
};
