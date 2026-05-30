import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizationMembers, organizations } from "@/db/schema";
import { getPreOrgSession, createOrgToken } from "@/lib/auth";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function POST(request: NextRequest) {
  const preSession = await getPreOrgSession(request);
  if (!preSession) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { orgId } = await request.json();
    if (!orgId) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }

    const db = getDb();
    const membership = await db
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMembers.userId, preSession.userId),
          eq(organizationMembers.organizationId, orgId)
        )
      )
      .get();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    const orgToken = await createOrgToken({
      userId: preSession.userId,
      email: preSession.email,
      name: preSession.name,
      orgId: membership.orgId,
      orgName: membership.orgName,
      orgSlug: membership.orgSlug,
      role: membership.role,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set("pkd_org_session", orgToken, {
      ...COOKIE_OPTS,
      maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.delete("pkd_session");
    return response;
  } catch (error) {
    console.error("Select org error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
