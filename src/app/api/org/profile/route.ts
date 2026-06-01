import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizations } from "@/db/schema";
import { getSession } from "@/lib/auth";

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
    const { name, address, phone, email, logoUrl, themeConfig } = body;

    const db = getDb();
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (themeConfig !== undefined) updates.themeConfig = typeof themeConfig === "string" ? themeConfig : JSON.stringify(themeConfig);

    await db.update(organizations).set(updates).where(eq(organizations.id, session.orgId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update org error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
