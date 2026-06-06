import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users, organizations, organizationMembers, verificationTokens, orgRoles } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmailOTP } from "@/lib/email";
import { sendSMSOTP } from "@/lib/sms";

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().min(10).max(16).transform((p) => {
    const digits = p.replace(/\D/g, "");
    if (p.startsWith("+")) return p;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    return p;
  }),
  clinicName: z.string().min(2),
});

const SIGNUP_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }; // 5 per hour per IP

function generateOTP(): string {
  // Math.random() is not cryptographically secure — use getRandomValues instead.
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function randomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 4);
}

import { DEFAULT_ROLES } from "@/lib/default-roles";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`signup:${ip}`, SIGNUP_RATE_LIMIT);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many signup attempts. Please wait before trying again." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  try {
    const body = await request.json();
    const { name, email, password, phone, clinicName } = signupSchema.parse(body);

    const db = getDb();

    // Helper: fully purge a stale unverified user and their orphaned org
    async function purgeUnverifiedUser(userId: string) {
      const memberships = await db
        .select({ orgId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, userId));
      for (const { orgId: staleOrgId } of memberships) {
        // Delete members first (FK: organization_members.org_role_id -> org_roles.id)
        await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, staleOrgId));
        await db.delete(orgRoles).where(eq(orgRoles.organizationId, staleOrgId));
        await db.delete(organizations).where(eq(organizations.id, staleOrgId));
      }
      await db.delete(verificationTokens).where(eq(verificationTokens.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    }

    // Check email uniqueness — allow re-registration only if the previous attempt was never verified
    const existingEmail = await db
      .select({ id: users.id, isVerified: users.isVerified })
      .from(users)
      .where(eq(users.email, email));
    if (existingEmail.length > 0) {
      if (existingEmail[0].isVerified) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
      await purgeUnverifiedUser(existingEmail[0].id);
    }

    // Check phone uniqueness — same: allow re-registration if never verified
    const existingPhone = await db
      .select({ id: users.id, isVerified: users.isVerified })
      .from(users)
      .where(eq(users.phone, phone));
    if (existingPhone.length > 0) {
      if (existingPhone[0].isVerified) {
        return NextResponse.json({ error: "Phone number already registered" }, { status: 409 });
      }
      // Only purge if different user (email check may have already removed them)
      if (existingPhone[0].id !== existingEmail[0]?.id) {
        await purgeUnverifiedUser(existingPhone[0].id);
      }
    }

    const passwordHash = await hashPassword(password);
    const now = Date.now();

    const userId = `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const orgId = `org_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const memberId = `mem_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

    // Generate slug
    let slug = generateSlug(clinicName);
    if (!slug) slug = "clinic";
    const existingSlug = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug));
    if (existingSlug.length > 0) {
      slug = `${slug}-${randomSuffix()}`;
    }

    // Create user
    await db.insert(users).values({
      id: userId,
      name,
      email,
      passwordHash,
      phone,
      isActive: 0,
      isVerified: 0,
      createdAt: now,
    });

    // Create organization
    await db.insert(organizations).values({
      id: orgId,
      name: clinicName,
      slug,
      isActive: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Seed default org roles and capture the Administrator role id for the owner.
    let adminRoleId: string | null = null;
    try {
      const roleRows = DEFAULT_ROLES.map((r) => {
        const id = `role_${orgId}_${r.slug}_${now}`;
        if (r.slug === "administrator") adminRoleId = id;
        return {
          id,
          organizationId: orgId,
          name: r.name,
          slug: r.slug,
          description: null,
          color: r.color,
          isSystem: r.isSystem,
          permissions: JSON.stringify(r.permissions),
          createdAt: now,
          updatedAt: now,
        };
      });
      await db.insert(orgRoles).values(roleRows);
    } catch (e) {
      // org_roles table may not exist on un-migrated DBs — don't block signup.
      console.error("Default role seeding skipped:", e);
      adminRoleId = null;
    }

    // Create org member
    await db.insert(organizationMembers).values({
      id: memberId,
      organizationId: orgId,
      userId,
      role: "ADMIN",
      orgRoleId: adminRoleId,
      isActive: 0,
      createdAt: now,
    });

    // Generate OTP codes
    const emailCode = generateOTP();
    const phoneCode = generateOTP();
    const expiresAt = now + 15 * 60 * 1000; // 15 minutes

    const emailTokenId = `vt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const phoneTokenId = `vt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

    await db.insert(verificationTokens).values([
      {
        id: emailTokenId,
        userId,
        type: "EMAIL",
        code: emailCode,
        expiresAt,
        used: 0,
        createdAt: now,
      },
      {
        id: phoneTokenId,
        userId,
        type: "PHONE",
        code: phoneCode,
        expiresAt,
        used: 0,
        createdAt: now,
      },
    ]);

    // Send OTPs in parallel (don't fail signup if sends fail)
    await Promise.allSettled([
      sendEmailOTP(email, name, emailCode),
      sendSMSOTP(phone, phoneCode),
    ]);

    return NextResponse.json({ userId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
