import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgRoles, organizationMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();

  const roles = await db
    .select({
      id: orgRoles.id,
      name: orgRoles.name,
      slug: orgRoles.slug,
      description: orgRoles.description,
      color: orgRoles.color,
      isSystem: orgRoles.isSystem,
      permissions: orgRoles.permissions,
    })
    .from(orgRoles)
    .where(eq(orgRoles.organizationId, session.orgId))
    .orderBy(orgRoles.name);

  // Get user counts per role
  const memberCounts = await db
    .select({
      orgRoleId: organizationMembers.orgRoleId,
      count: sql<number>`count(*)`,
    })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, session.orgId),
        eq(organizationMembers.isActive, 1)
      )
    )
    .groupBy(organizationMembers.orgRoleId);

  const countMap: Record<string, number> = {};
  for (const row of memberCounts) {
    if (row.orgRoleId) countMap[row.orgRoleId] = Number(row.count);
  }

  const result = roles.map((r) => ({
    ...r,
    permissions: JSON.parse(r.permissions || "[]") as string[],
    userCount: countMap[r.id] || 0,
  }));

  return NextResponse.json({ roles: result });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const { name, description, color, permissions } = body as {
      name: string;
      description?: string;
      color?: string;
      permissions?: string[];
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const slug = nameToSlug(name.trim());
    const db = getDb();

    // Check duplicate slug
    const [existing] = await db
      .select({ id: orgRoles.id })
      .from(orgRoles)
      .where(and(eq(orgRoles.organizationId, session.orgId), eq(orgRoles.slug, slug)));

    if (existing) {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 });
    }

    const now = Date.now();
    const newRole = {
      id: `role_${session.orgId}_${slug}_${now}`,
      organizationId: session.orgId,
      name: name.trim(),
      slug,
      description: description || null,
      color: color || "#3B82F6",
      isSystem: 0,
      permissions: JSON.stringify(permissions || []),
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(orgRoles).values(newRole);
    return NextResponse.json(
      { role: { ...newRole, permissions: permissions || [] } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create role error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
