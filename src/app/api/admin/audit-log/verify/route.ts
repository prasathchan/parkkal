/**
 * GET /api/admin/audit-log/verify
 *
 * Walks the audit log hash chain for the current org and reports any broken links.
 * A broken link means a row was mutated or deleted after it was written.
 *
 * Response:
 *   { valid: true,  checked: N }
 *   { valid: false, checked: N, firstBreakAt: { id, createdAt, expected, actual } }
 */
import { eq, asc } from "drizzle-orm";
import { adminAuditLog } from "@/db/schema";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";

export const GET = withRoute(
  { route: "GET /api/admin/audit-log/verify", rateLimit: RATE_LIMITS.READ, adminOnly: true },
  async (_req, { session, db }) => {
    const rows = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.organizationId, session.orgId))
      .orderBy(asc(adminAuditLog.createdAt));

    if (rows.length === 0) {
      return apiOk({ valid: true, checked: 0 });
    }

    let prevHash = "genesis";
    let checked = 0;

    for (const row of rows) {
      if (!row.rowHash) {
        // Rows written before migration 0063 have no hash — skip them.
        prevHash = "genesis";
        continue;
      }

      const rowJson = JSON.stringify({
        id: row.id,
        organizationId: row.organizationId,
        actorId: row.actorId,
        actorRole: row.actorRole,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId ?? null,
        metadata: row.metadata ?? null,
        severity: row.severity,
        createdAt: row.createdAt,
      });

      const data = new TextEncoder().encode(prevHash + rowJson);
      const hashBuf = await crypto.subtle.digest("SHA-256", data);
      const expected = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (expected !== row.rowHash) {
        return apiOk({
          valid: false,
          checked,
          firstBreakAt: {
            id: row.id,
            createdAt: row.createdAt,
            expected,
            actual: row.rowHash,
          },
        });
      }

      prevHash = row.rowHash;
      checked++;
    }

    return apiOk({ valid: true, checked });
  }
);
