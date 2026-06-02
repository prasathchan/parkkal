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
  phone: z.string().min(10).max(15),
  clinicName: z.string().min(2),
});

const SIGNUP_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }; // 5 per hour per IP

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
  return Math.random().toString(36).slice(2, 6);
}

const ALL_PERMISSIONS = [
  "patients.view", "patients.create", "patients.edit", "patients.delete",
  "visits.view", "visits.create", "visits.edit",
  "billing.view", "billing.manage",
  "staff.view", "staff.manage",
  "salary.view", "salary.manage",
  "settings.manage",
  "reports.view",
  "roles.manage",
];

// Default roles seeded for every new organization so the roles screen and
// permission system have sensible starting points.
const DEFAULT_ROLES: { name: string; slug: string; color: string; isSystem: number; permissions: string[] }[] = [
  { name: "Administrator", slug: "administrator", color: "#3B82F6", isSystem: 1, permissions: ALL_PERMISSIONS },
  { name: "Doctor", slug: "doctor", color: "#10B981", isSystem: 0, permissions: ["patients.view", "patients.create", "patients.edit", "visits.view", "visits.create", "visits.edit", "billing.view", "reports.view"] },
  { name: "Nurse", slug: "nurse", color: "#F59E0B", isSystem: 0, permissions: ["patients.view", "visits.view", "visits.create"] },
  { name: "Receptionist", slug: "receptionist", color: "#8B5CF6", isSystem: 0, permissions: ["patients.view", "patients.create", "visits.view", "billing.view"] },
];

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`signup:${ip}`, SIGNUP_RATE_LIMIT);
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

    // Check email uniqueness
    const existingEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (existingEmail.length > 0) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Check phone uniqueness
    const existingPhone = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phone));
    if (existingPhone.length > 0) {
      return NextResponse.json({ error: "Phone number already registered" }, { status: 409 });
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
