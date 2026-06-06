import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizations, organizationMembers, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  logoUrl: z.string().url().optional().or(z.literal("")).nullable(),
  themeConfig: z.union([z.string(), z.record(z.unknown())]).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const org = (await db.select().from(organizations).where(eq(organizations.id, session.orgId)))[0];
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  return NextResponse.json({ organization: org });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const parsed = updateOrgSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.errors }, { status: 400 });
    }

    const { name, address, phone, email, logoUrl, themeConfig } = parsed.data;

    const db = getDb();
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email || null;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl || null;
    if (themeConfig !== undefined) updates.themeConfig = typeof themeConfig === "string" ? themeConfig : JSON.stringify(themeConfig);

    await db.update(organizations).set(updates).where(eq(organizations.id, session.orgId));

    // Keep the default admin's phone in sync with the org phone
    if (phone !== undefined && phone !== null) {
      const [adminMember] = await db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, session.orgId), eq(organizationMembers.role, "ADMIN")))
        .limit(1);
      if (adminMember) {
        await db.update(users)
          .set({ phone, updatedAt: Date.now() })
          .where(eq(users.id, adminMember.userId));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update org error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
