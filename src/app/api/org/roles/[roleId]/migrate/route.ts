import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgRoles, organizationMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const ADMIN_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`admin:${session.userId}`, ADMIN_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("POST /api/org/roles/[roleId]/migrate", session);
  if (session.role !== "ADMIN") {
    log.security("Permission denied: only ADMIN can migrate roles", { role: session.role });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { roleId } = await params;
  const body = await request.json();
  const { targetRoleId } = body as { targetRoleId: string };

  if (!targetRoleId) return NextResponse.json({ error: "targetRoleId is required" }, { status: 400 });

  const db = getDb();

  const [sourceRole] = await db.select().from(orgRoles).where(
    and(eq(orgRoles.id, roleId), eq(orgRoles.organizationId, session.orgId))
  );
  if (!sourceRole) return NextResponse.json({ error: "Source role not found" }, { status: 404 });
  if (sourceRole.isSystem) return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 403 });

  const [targetRole] = await db.select().from(orgRoles).where(
    and(eq(orgRoles.id, targetRoleId), eq(orgRoles.organizationId, session.orgId))
  );
  if (!targetRole) return NextResponse.json({ error: "Target role not found" }, { status: 404 });
  if (targetRoleId === roleId) return NextResponse.json({ error: "Source and target roles must be different" }, { status: 400 });

  const result = await db.update(organizationMembers).set({ orgRoleId: targetRoleId }).where(
    and(eq(organizationMembers.orgRoleId, roleId), eq(organizationMembers.organizationId, session.orgId))
  );

  await db.delete(orgRoles).where(eq(orgRoles.id, roleId));
  const migratedCount = (result as { rowsAffected?: number }).rowsAffected ?? 0;
  log.info("Role migrated and deleted", { sourceRoleId: roleId, targetRoleId, migratedCount });
  return NextResponse.json({ success: true, migratedCount });
}
