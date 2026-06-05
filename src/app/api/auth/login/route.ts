import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, organizationMembers, organizations } from "@/db/schema";
import { verifyPassword, createToken, createOrgToken } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const LOGIN_RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`login:${ip}`, LOGIN_RATE_LIMIT);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many login attempts. Please wait before trying again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(LOGIN_RATE_LIMIT.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const db = getDb();
    const user = (await db.select().from(users).where(eq(users.email, email)))[0];

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (user.isActive === 0) {
      return NextResponse.json({ error: "Account is inactive. Check your email to complete setup." }, { status: 401 });
    }

    // Reject empty-hash accounts (invited but never activated)
    if (!user.passwordHash) {
      return NextResponse.json({ error: "Account setup incomplete. Check your invite email." }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Find all active orgs this user belongs to (both org and membership must be active)
    const memberships = await db
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        orgAddress: organizations.address,
        orgIsActive: organizations.isActive,
        role: organizationMembers.role,
        memberIsActive: organizationMembers.isActive,
        portalAccess: organizationMembers.portalAccess,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, user.id));

    const activeMemberships = memberships.filter(
      (m: (typeof memberships)[number]) =>
        m.memberIsActive === 1 &&
        m.orgIsActive === 1 &&
        (m.role !== "HELPER" || m.portalAccess === 1)
    );

    if (activeMemberships.length === 0) {
      return NextResponse.json(
        { error: "No organization access. Contact your administrator." },
        { status: 403 }
      );
    }

    if (activeMemberships.length === 1) {
      const m = activeMemberships[0];
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
        maxAge: 60 * 60 * 24,
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
      organizations: activeMemberships.map((m: (typeof activeMemberships)[number]) => ({
        id: m.orgId,
        name: m.orgName,
        slug: m.orgSlug,
        address: m.orgAddress,
        role: m.role,
      })),
    });
    response.cookies.set("pkd_session", preToken, {
      ...COOKIE_OPTS,
      maxAge: 60 * 60,
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
