import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users, organizations, organizationMembers, verificationTokens } from "@/db/schema";
import { createOrgToken } from "@/lib/auth-edge";
import { verifyOTP } from "@/lib/otp";
import { resolveRolePermissions } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import env from "@/lib/env";

// Limit OTP guesses to prevent brute-forcing the 6-digit codes.
// 10 attempts per 15 min per IP, and 20 per 15 min per userId.
const VERIFY_RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };
const VERIFY_USER_RATE_LIMIT = { limit: 20, windowMs: 15 * 60 * 1000 };

const verifySchema = z.object({
  userId: z.string(),
  emailCode: z.string().length(6),
  phoneCode: z.string().length(6),
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const ipRl = await checkRateLimit(`verify:ip:${ip}`, VERIFY_RATE_LIMIT);
  if (!ipRl.allowed) {
    const retryAfter = Math.ceil((ipRl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many verification attempts. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const log = logger.forRoute("POST /api/auth/verify");
  try {
    const body = await request.json();
    const { userId, emailCode, phoneCode } = verifySchema.parse(body);

    const userRl = await checkRateLimit(`verify:user:${userId}`, VERIFY_USER_RATE_LIMIT);
    if (!userRl.allowed) {
      const retryAfter = Math.ceil((userRl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many verification attempts. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const db = getDb();
    const now = Date.now();

    // Find valid EMAIL token — fetch by userId+type only; bcrypt.compare checks the code
    const emailTokens = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.userId, userId),
          eq(verificationTokens.type, "EMAIL"),
          eq(verificationTokens.used, 0),
          gt(verificationTokens.expiresAt, now)
        )
      );

    const emailToken = emailTokens[0];
    if (!emailToken || !(await verifyOTP(emailCode, emailToken.code))) {
      log.security("Signup verification failed: invalid email code", { userId });
      return NextResponse.json({ error: "Invalid email code" }, { status: 400 });
    }

    // Find valid PHONE token — fetch by userId+type only; bcrypt.compare checks the code
    const phoneTokens = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.userId, userId),
          eq(verificationTokens.type, "PHONE"),
          eq(verificationTokens.used, 0),
          gt(verificationTokens.expiresAt, now)
        )
      );

    const phoneToken = phoneTokens[0];
    if (!phoneToken || !(await verifyOTP(phoneCode, phoneToken.code))) {
      log.security("Signup verification failed: invalid phone code", { userId });
      return NextResponse.json({ error: "Invalid phone code" }, { status: 400 });
    }

    // Mark both tokens as used
    await db
      .update(verificationTokens)
      .set({ used: 1 })
      .where(eq(verificationTokens.id, emailToken.id));
    await db
      .update(verificationTokens)
      .set({ used: 1 })
      .where(eq(verificationTokens.id, phoneToken.id));

    // Activate user
    await db
      .update(users)
      .set({ isActive: 1, isVerified: 1 })
      .where(eq(users.id, userId));

    // Find org membership
    const membership = await db
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        role: organizationMembers.role,
        orgMemberId: organizationMembers.id,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, userId));

    if (membership.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 500 });
    }

    const m = membership[0];

    // Activate organization and membership
    await db
      .update(organizations)
      .set({ isActive: 1 })
      .where(eq(organizations.id, m.orgId));
    await db
      .update(organizationMembers)
      .set({ isActive: 1, portalAccess: 1 })
      .where(eq(organizationMembers.id, m.orgMemberId));

    // Load user details
    const userRows = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId));

    if (userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 500 });
    }

    const user = userRows[0];

    // Create org session JWT — embed permissions to avoid per-request DB lookups
    const permissions = await resolveRolePermissions(m.role, null);
    const orgToken = await createOrgToken({
      userId,
      email: user.email,
      name: user.name,
      orgId: m.orgId,
      orgName: m.orgName,
      orgSlug: m.orgSlug,
      role: m.role,
      permissions,
    });

    log.info("Signup verification successful", { userId, orgId: m.orgId });
    const response = NextResponse.json({ redirect: "/dashboard" });
    response.cookies.set("pkd_org_session", orgToken, {
      ...COOKIE_OPTS,
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    log.error("Signup verification error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
