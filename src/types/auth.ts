/**
 * types/auth.ts
 *
 * TypeScript shapes for session / auth context.
 */

import type { SystemRole } from "./staff";

/** The decoded JWT session payload — returned by GET /api/auth/me */
export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: SystemRole;
  permissions: string[];
  orgRoleId?: string | null;
}

/** Lightweight user summary returned by GET /api/users (no PHI, no salary) */
export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: SystemRole;
}
