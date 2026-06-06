import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizationMembers, users, organizations, orgRoles, verificationTokens, emergencyContacts } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { hashPassword } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { encryptField, decryptField } from "@/lib/encryption";
import { sendStaffInviteEmail } from "@/lib/email";
import { z } from "zod";

const addMemberSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().max(500).optional(),
  panNumber: z.string().max(10).optional(),
  aadhaarNumber: z.string().max(12).optional(),
  bloodGroup: z.string().optional(),
  role: z.enum(["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "ATTENDANT", "HELPER"]),
  orgRoleId: z.string().optional(),
  salaryType: z.enum(["FIXED", "PER_APPOINTMENT"]).default("FIXED"),
  salaryAmount: z.number().default(0),
  joinedAt: z.string().optional(),
  // activationMode controls how the new staff member's account is set up
  // invite_link   → inactive account, send activation email link (default)
  // set_password  → admin sets password, account active immediately
  // no_login_verify → active HR record, login disabled, send device-verify link
  activationMode: z.enum(["invite_link", "set_password", "no_login_verify"]).default("invite_link"),
  password: z.string().min(8).regex(
    /^(?=.*[A-Za-z])(?=.*\d).+$/,
    "Password must contain at least one letter and one number"
  ).optional(),
  emergencyContact: z.object({
    name: z.string().min(1),
    relationship: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email().optional(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("GET /api/org/members", session);
  if (!await hasPermission(session, PERMISSIONS.STAFF_VIEW)) {
    log.security("Permission denied: staff.view", {});
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const rows = await db
    .select({
      memberId: organizationMembers.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      dateOfBirth: users.dateOfBirth,
      gender: users.gender,
      address: users.address,
      panNumber: users.panNumber,
      aadhaarNumber: users.aadhaarNumber,
      role: organizationMembers.role,
      orgRoleId: organizationMembers.orgRoleId,
      orgRoleName: orgRoles.name,
      orgRoleColor: orgRoles.color,
      salaryType: organizationMembers.salaryType,
      salaryAmount: organizationMembers.salaryAmount,
      joinedAt: organizationMembers.joinedAt,
      isActive: organizationMembers.isActive,
      isVerified: users.isVerified,
      portalAccess: organizationMembers.portalAccess,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .leftJoin(orgRoles, eq(organizationMembers.orgRoleId, orgRoles.id))
    .where(eq(organizationMembers.organizationId, session.orgId));

  // Strip national IDs and salary info from non-ADMIN callers
  type MemberRow = (typeof rows)[number];
  let members: unknown[];
  if (session.role === "ADMIN") {
    members = await Promise.all(rows.map(async (r: MemberRow) => ({
      ...r,
      panNumber: await decryptField(r.panNumber) ?? null,
      aadhaarNumber: await decryptField(r.aadhaarNumber) ?? null,
    })));
  } else {
    members = rows.map((r: MemberRow) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { panNumber, aadhaarNumber, salaryType, salaryAmount, ...rest } = r;
      return rest;
    });
  }

  return NextResponse.json({ members });
}

export async function POST(request: NextRequest) {
  // Derive base URL from the incoming request so invite links work in any environment
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const log = logger.forRoute("POST /api/org/members", session);
  if (!["ADMIN"].includes(session.role)) {
    log.security("Permission denied: only ADMIN can add members", { role: session.role });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = addMemberSchema.parse(body);

    // Emergency contact is mandatory for staff
    if (!data.emergencyContact?.name || !data.emergencyContact?.relationship || !data.emergencyContact?.phone) {
      return NextResponse.json({ error: "Emergency contact (name, relationship, phone) is required for staff" }, { status: 400 });
    }

    const db = getDb();
    const now = Date.now();

    // Check if user exists
    let existingUser = (await db.select().from(users).where(eq(users.email, data.email)))[0];

    let isNewUser = false;

    if (!existingUser) {
      if (!data.name) {
        return NextResponse.json({ error: "New user requires a name" }, { status: 400 });
      }
      if (data.activationMode === "set_password" && !data.password) {
        return NextResponse.json({ error: "Password is required for immediate activation" }, { status: 400 });
      }

      isNewUser = true;
      const passwordHash = data.activationMode === "set_password" && data.password
        ? await hashPassword(data.password)
        : "";

      const userIsActive = data.activationMode === "set_password" ? 1 : (data.activationMode === "no_login_verify" ? 1 : 0);
      const userIsVerified = data.activationMode === "set_password" ? 1 : 0;

      const newUser = {
        id: crypto.randomUUID(),
        name: data.name,
        email: data.email,
        passwordHash,
        phone: data.phone || null,
        dateOfBirth: data.dateOfBirth || null,
        gender: data.gender || null,
        address: data.address || null,
        panNumber: await encryptField(data.panNumber || null) ?? null,
        aadhaarNumber: await encryptField(data.aadhaarNumber || null) ?? null,
        profileImageUrl: null,
        isActive: userIsActive,
        isVerified: userIsVerified,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(users).values(newUser);
      existingUser = newUser as typeof existingUser;
    }

    // Check not already member
    const existing = (await db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.userId, existingUser.id)))
      )[0];

    if (existing) {
      return NextResponse.json({ error: "User is already a member of this organization" }, { status: 409 });
    }

    // portal_access:
    //   invite_link     → 1 (will be able to login after activation)
    //   set_password    → 1 (login enabled immediately)
    //   no_login_verify → 0 (login disabled; stays disabled after verify)
    //   existing user   → 1 (they already have an account)
    const portalAccess = !isNewUser ? 1
      : data.activationMode === "no_login_verify" ? 0 : 1;

    // member is_active:
    //   invite_link  → 0 until user activates
    //   set_password → 1 immediately
    //   no_login_verify → 1 (HR record is active)
    //   existing user → 1
    const memberIsActive = !isNewUser ? 1
      : data.activationMode === "invite_link" ? 0 : 1;

    const member = {
      id: crypto.randomUUID(),
      organizationId: session.orgId,
      userId: existingUser.id,
      role: data.role,
      orgRoleId: data.orgRoleId || null,
      salaryType: data.salaryType,
      salaryAmount: data.salaryAmount,
      joinedAt: data.joinedAt || new Date().toISOString().split("T")[0],
      isActive: memberIsActive,
      portalAccess,
      createdAt: now,
    };

    await db.insert(organizationMembers).values(member);

    // Send activation/verification email for invite_link and no_login_verify modes
    if (isNewUser && data.activationMode !== "set_password") {
      const tokenCode = crypto.randomUUID();
      const tokenId = `vt_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (b: number) => b.toString(16).padStart(2, "0")).join("")}`;
      const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

      await db.insert(verificationTokens).values({
        id: tokenId,
        userId: existingUser.id,
        type: "STAFF_INVITE",
        code: tokenCode,
        expiresAt,
        used: 0,
        createdAt: now,
      });

      const org = (await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, session.orgId)))[0];
      const orgName = org?.name ?? "your clinic";

      const modeParam = data.activationMode === "no_login_verify" ? "&mode=verify" : "";
      const activationUrl = `${appBaseUrl}/activate?token=${tokenCode}${modeParam}`;

      try {
        await sendStaffInviteEmail(data.email, data.name ?? data.email, orgName, activationUrl);
      } catch (emailErr) {
        log.warn("Failed to send staff invite email", { email: data.email, error: String(emailErr) });
      }
    }

    // Insert emergency contact
    await db.insert(emergencyContacts).values({
      id: crypto.randomUUID(),
      entityType: "USER",
      entityId: existingUser.id,
      name: data.emergencyContact!.name,
      relationship: data.emergencyContact!.relationship,
      phone: data.emergencyContact!.phone,
      email: data.emergencyContact!.email || null,
      address: null,
      createdAt: now,
    });

    // Exclude passwordHash from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _omit, ...safeUser } = existingUser as typeof existingUser & { passwordHash: string };
    log.info("Staff member added", { newUserId: existingUser.id, role: data.role, isNewUser, activationMode: data.activationMode });
    return NextResponse.json({ member, user: safeUser }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    log.error("Failed to add member", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
