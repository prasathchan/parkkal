import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizationMembers, users, organizations, orgRoles } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const addMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  panNumber: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  role: z.enum(["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "ATTENDANT", "HELPER"]),
  orgRoleId: z.string().optional(),
  salaryType: z.enum(["FIXED", "PER_APPOINTMENT"]).default("FIXED"),
  salaryAmount: z.number().default(0),
  joinedAt: z.string().optional(),
  password: z.string().min(6).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const members = await db
    .select({
      memberId: organizationMembers.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      dateOfBirth: users.dateOfBirth,
      gender: users.gender,
      address: users.address,
      role: organizationMembers.role,
      orgRoleId: organizationMembers.orgRoleId,
      orgRoleName: orgRoles.name,
      orgRoleColor: orgRoles.color,
      salaryType: organizationMembers.salaryType,
      salaryAmount: organizationMembers.salaryAmount,
      joinedAt: organizationMembers.joinedAt,
      isActive: organizationMembers.isActive,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .leftJoin(orgRoles, eq(organizationMembers.orgRoleId, orgRoles.id))
    .where(eq(organizationMembers.organizationId, session.orgId));

  return NextResponse.json({ members });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = addMemberSchema.parse(body);
    const db = getDb();
    const now = Date.now();

    // Check if user exists
    let existingUser = (await db.select().from(users).where(eq(users.email, data.email)))[0];

    if (!existingUser) {
      if (!data.name || !data.password) {
        return NextResponse.json({ error: "New user requires name and password" }, { status: 400 });
      }
      const { hashPassword } = await import("@/lib/auth");
      const passwordHash = await hashPassword(data.password);
      const newUser = {
        id: crypto.randomUUID(),
        name: data.name,
        email: data.email,
        passwordHash,
        phone: data.phone || null,
        dateOfBirth: data.dateOfBirth || null,
        gender: data.gender || null,
        address: data.address || null,
        panNumber: data.panNumber || null,
        aadhaarNumber: data.aadhaarNumber || null,
        profileImageUrl: null,
        isActive: 1,
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

    const member = {
      id: crypto.randomUUID(),
      organizationId: session.orgId,
      userId: existingUser.id,
      role: data.role,
      orgRoleId: data.orgRoleId || null,
      salaryType: data.salaryType,
      salaryAmount: data.salaryAmount,
      joinedAt: data.joinedAt || new Date().toISOString().split("T")[0],
      isActive: 1,
      createdAt: now,
    };

    await db.insert(organizationMembers).values(member);
    // Exclude passwordHash from response
    const { passwordHash: _omit, ...safeUser } = existingUser as typeof existingUser & { passwordHash: string };
    return NextResponse.json({ member, user: safeUser }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Add member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
