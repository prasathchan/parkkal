/**
 * lib/audit.ts
 *
 * Fire-and-forget admin audit trail.
 *
 * Call writeAuditLog() after any sensitive admin action (role change, member
 * deactivation, patient deletion, etc.).  It never throws — a failure to log
 * should never block the primary operation.
 *
 * Usage:
 *   writeAuditLog({
 *     organizationId: session.orgId,
 *     actorId:        session.userId,
 *     actorRole:      session.role,
 *     action:         "MEMBER_DEACTIVATED",
 *     targetType:     "member",
 *     targetId:       userId,
 *     metadata:       { previousRole: "DOCTOR" },
 *   });
 */

import { getDb } from "@/lib/db";
import { adminAuditLog } from "@/db/schema";

export type AuditAction =
  | "MEMBER_INVITED"
  | "MEMBER_DEACTIVATED"
  | "MEMBER_ROLE_CHANGED"
  | "MEMBER_DELETED"
  | "MEMBER_ACTIVATION_SENT"
  | "MEMBER_PORTAL_ACCESS_CHANGED"
  | "ROLE_CREATED"
  | "ROLE_UPDATED"
  | "ROLE_DELETED"
  | "PATIENT_DELETED"
  | "ORG_PROFILE_UPDATED"
  | "ORG_LOGO_DELETED"
  | "SALARY_GENERATED"
  | "SALARY_DELETED"
  | "VISIT_DELETED"
  | "TREATMENT_DELETED";

export interface AuditParams {
  organizationId: string;
  actorId: string;
  actorRole: string;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export function writeAuditLog(params: AuditParams): void {
  // Fire-and-forget: deliberately not awaited.
  (async () => {
    try {
      const db = getDb();
      await db.insert(adminAuditLog).values({
        id: crypto.randomUUID(),
        organizationId: params.organizationId,
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        createdAt: Date.now(),
      });
    } catch {
      // Never surface audit failures to callers.
      console.error("[audit] Failed to write audit log entry", params.action);
    }
  })();
}
