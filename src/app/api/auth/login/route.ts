import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, organizationMembers, organizations } from "@/db/schema";
import { verifyPassword, createToken, createOrgToken } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const db = getDb();
    const user = (await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      )[0];

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (user.isActive === 0) {
      return NextResponse.json(
        { error: "Account is inactive" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Find all orgs this user belongs to
    const memberships = await db
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        orgAddress: organizations.address,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, user.id));

    if (memberships.length === 0) {
      return NextResponse.json(
        { error: "No organization access. Contact your administrator." },
        { status: 403 }
      );
    }

    if (memberships.length === 1) {
      // Auto-select the only org
      const m = memberships[0];
      const orgToken = await createOrgToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        orgId: m.orgId,
        orgName: m.orgName,
        orgSlug: m.orgSlug,
        role: m.role,
      });
      const response = NextResponse.json({ redirect: "/dashboard" });
      response.cookies.set("pkd_org_session", orgToken, {
        ...COOKIE_OPTS,
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }

    // Multiple orgs — set pre-org session and return org list
    const preToken = await createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
    const response = NextResponse.json({
      requireOrgSelection: true,
      organizations: memberships.map((m) => ({
        id: m.orgId,
        name: m.orgName,
        slug: m.orgSlug,
        address: m.orgAddress,
        role: m.role,
      })),
    });
    response.cookies.set("pkd_session", preToken, {
      ...COOKIE_OPTS,
      maxAge: 60 * 60, // 1 hour
    });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
