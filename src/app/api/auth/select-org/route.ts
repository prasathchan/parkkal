import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizationMembers, organizations } from "@/db/schema";
import { getPreOrgSession, createOrgToken } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`select-org:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const preSession = await getPreOrgSession(request);
  if (!preSession) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { orgId } = await request.json() as { orgId?: string };
    if (!orgId) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }

    const db = getDb();
    const membership = (await db
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        role: organizationMembers.role,
        orgRoleId: organizationMembers.orgRoleId,
        memberIsActive: organizationMembers.isActive,
        orgIsActive: organizations.isActive,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMembers.userId, preSession.userId),
          eq(organizationMembers.organizationId, orgId)
        )
      )
      )[0];

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    if (!membership.memberIsActive || !membership.orgIsActive) {
      return NextResponse.json({ error: "Your account or organization is inactive" }, { status: 403 });
    }

    const orgToken = await createOrgToken({
      userId: preSession.userId,
      email: preSession.email,
      name: preSession.name,
      orgId: membership.orgId,
      orgName: membership.orgName,
      orgSlug: membership.orgSlug,
      role: membership.role,
      orgRoleId: membership.orgRoleId ?? null,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set("pkd_org_session", orgToken, {
      ...COOKIE_OPTS,
      maxAge: 60 * 60 * 24,
    });
    response.cookies.delete("pkd_session");
    return response;
  } catch (error) {
    console.error("Select org error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
