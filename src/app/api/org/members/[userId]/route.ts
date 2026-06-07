import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizationMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const ADMIN_RATE_LIMIT = { limit: 30, windowMs: 60_000 };
const DESTRUCTIVE_RATE_LIMIT = { limit: 10, windowMs: 60_000 };

const patchSchema = z.object({
  role: z.enum(["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "ATTENDANT", "HELPER"]).optional(),
  salaryType: z.enum(["FIXED", "PER_APPOINTMENT"]).optional(),
  salaryAmount: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  orgRoleId: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`admin:${session.userId}`, ADMIN_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("PATCH /api/org/members/[userId]", session);
  const { userId } = await params;
  if (session.role !== "ADMIN") {
    log.security("Permission denied: only ADMIN can update members", { role: session.role });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.errors }, { status: 400 });
    }

    const data = parsed.data;
    const db = getDb();

    // Verify the target user is actually a member of this org
    const [membership] = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));
    if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (data.role !== undefined) updates.role = data.role;
    if (data.salaryType !== undefined) updates.salaryType = data.salaryType;
    if (data.salaryAmount !== undefined) updates.salaryAmount = data.salaryAmount;
    if (data.isActive !== undefined) updates.isActive = data.isActive ? 1 : 0;
    if (data.orgRoleId !== undefined) updates.orgRoleId = data.orgRoleId;

    await db.update(organizationMembers).set(updates).where(
      and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId))
    );
    const action = data.isActive === false ? "MEMBER_DEACTIVATED" : data.orgRoleId ? "MEMBER_ROLE_CHANGED" : "MEMBER_DEACTIVATED";
    writeAuditLog({ organizationId: session.orgId, actorId: session.userId, actorRole: session.role, action, targetType: "member", targetId: userId, metadata: { updatedFields: Object.keys(updates) } });
    log.info("Member updated", { targetUserId: userId, updates: Object.keys(updates) });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    log.error("Failed to update member", error, { targetUserId: userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(`destructive:${session.userId}`, DESTRUCTIVE_RATE_LIMIT);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const log = logger.forRoute("DELETE /api/org/members/[userId]", session);
  if (session.role !== "ADMIN") {
    log.security("Permission denied: only ADMIN can remove members", { role: session.role });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  if (userId === session.userId) {
    return NextResponse.json({ error: "You cannot remove yourself from the organization" }, { status: 400 });
  }
  const db = getDb();

  // Verify member belongs to this org before deleting
  const [membership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId)));
  if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await db.delete(organizationMembers).where(
    and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, userId))
  );
  writeAuditLog({ organizationId: session.orgId, actorId: session.userId, actorRole: session.role, action: "MEMBER_DELETED", targetType: "member", targetId: userId });
  log.info("Member removed from org", { targetUserId: userId });
  return NextResponse.json({ success: true });
}
