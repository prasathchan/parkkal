/**
 * lib/audit.ts
 *
 * Compliance audit trail with tamper-detection hash chain.
 *
 * Each row stores SHA-256(previous_row_hash + row_json) in `row_hash`.
 * Walking the chain via GET /api/admin/audit-log/verify detects any mutation.
 * The first row per org uses "genesis" as the previous hash.
 *
 * writeAuditLog() is fire-and-forget — a failure never blocks the primary operation.
 * writeSensitiveAuditLog() is awaited — used for HIGH-severity events where the
 * audit record must commit before the response is returned.
 */

import { getDb } from "@/lib/db";
import { adminAuditLog } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export type AuditAction =
  | "MEMBER_INVITED"
  | "MEMBER_DEACTIVATED"
  | "MEMBER_ROLE_CHANGED"
  | "MEMBER_UPDATED"
  | "MEMBER_DELETED"
  | "MEMBER_ACTIVATION_SENT"
  | "MEMBER_PORTAL_ACCESS_CHANGED"
  | "ROLE_CREATED"
  | "ROLE_UPDATED"
  | "ROLE_DELETED"
  | "PATIENT_DELETED"
  | "PATIENT_CONSENT_WITHDRAWN"
  | "ORG_PROFILE_UPDATED"
  | "ORG_LOGO_DELETED"
  | "SALARY_GENERATED"
  | "SALARY_DELETED"
  | "VISIT_DELETED"
  | "TREATMENT_DELETED"
  | "ORG_DELETED"
  | "BACKUP_RESTORE"
  | "SUBSCRIPTION_ACTIVATED_VIA_CONSOLE"
  | "CONSENT_EMERGENCY_OVERRIDE";

export interface AuditParams {
  organizationId: string;
  actorId: string;
  actorRole: string;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  severity?: "INFO" | "HIGH";
}

async function computeHash(prevHash: string, rowJson: string): Promise<string> {
  const data = new TextEncoder().encode(prevHash + rowJson);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function insertAuditRow(params: AuditParams): Promise<void> {
  const db = getDb();

  // Fetch the latest row hash for this org to build the chain
  const [lastRow] = await db
    .select({ rowHash: adminAuditLog.rowHash })
    .from(adminAuditLog)
    .where(eq(adminAuditLog.organizationId, params.organizationId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(1);

  const prevHash = lastRow?.rowHash ?? "genesis";

  const id = crypto.randomUUID();
  const now = Date.now();
  const severity = params.severity ?? "INFO";
  const metadataStr = params.metadata ? JSON.stringify(params.metadata) : null;

  const rowJson = JSON.stringify({
    id,
    organizationId: params.organizationId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId ?? null,
    metadata: metadataStr,
    severity,
    createdAt: now,
  });

  const rowHash = await computeHash(prevHash, rowJson);

  await db.insert(adminAuditLog).values({
    id,
    organizationId: params.organizationId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId ?? null,
    metadata: metadataStr,
    severity,
    rowHash,
    createdAt: now,
  });
}

/** Fire-and-forget. A failure never surfaces to callers. */
export function writeAuditLog(params: AuditParams): void {
  (async () => {
    try {
      await insertAuditRow(params);
    } catch {
      console.error("[audit] Failed to write audit log entry", params.action);
    }
  })();
}

/** Awaited variant for HIGH-severity events — ensures the record commits before responding. */
export async function writeSensitiveAuditLog(params: AuditParams): Promise<void> {
  try {
    await insertAuditRow({ ...params, severity: "HIGH" });
  } catch {
    console.error("[audit] Failed to write sensitive audit log entry", params.action);
  }
}
