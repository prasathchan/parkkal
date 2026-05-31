import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgRoles, organizationMembers, users } from "@/db/schema";
import { getSession } from "@/lib/auth";

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export async function GET(
  request: NextRequest,
  { params }: { params: { roleId: string } }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [role] = await db
    .select()
    .from(orgRoles)
    .where(
      and(eq(orgRoles.id, params.roleId), eq(orgRoles.organizationId, session.orgId))
    );

  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(organizationMembers)
    .leftJoin(users, eq(organizationMembers.userId, users.id))
    .where(
      and(
        eq(organizationMembers.orgRoleId, params.roleId),
        eq(organizationMembers.organizationId, session.orgId),
        eq(organizationMembers.isActive, 1)
      )
    );

  return NextResponse.json({
    role: { ...role, permissions: JSON.parse(role.permissions || "[]") },
    members,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { roleId: string } }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const [role] = await db
    .select()
    .from(orgRoles)
    .where(
      and(eq(orgRoles.id, params.roleId), eq(orgRoles.organizationId, session.orgId))
    );

  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  const body = await request.json();
  const { name, description, color, permissions } = body as {
    name?: string;
    description?: string;
    color?: string;
    permissions?: string[];
  };

  // Count affected users
  const membersWithRole = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(organizationMembers)
    .leftJoin(users, eq(organizationMembers.userId, users.id))
    .where(
      and(
        eq(organizationMembers.orgRoleId, params.roleId),
        eq(organizationMembers.organizationId, session.orgId),
        eq(organizationMembers.isActive, 1)
      )
    );

  const updates: Partial<typeof role> = { updatedAt: Date.now() };
  if (name !== undefined) {
    updates.name = name.trim();
    if (!role.isSystem) updates.slug = nameToSlug(name.trim());
  }
  if (description !== undefined) updates.description = description || null;
  if (color !== undefined) updates.color = color;
  if (permissions !== undefined) updates.permissions = JSON.stringify(permissions);

  await db.update(orgRoles).set(updates).where(eq(orgRoles.id, params.roleId));

  return NextResponse.json({
    role: { ...role, ...updates, permissions: permissions ?? JSON.parse(role.permissions || "[]") },
    affectedUsers: membersWithRole.length,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { roleId: string } }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const [role] = await db
    .select()
    .from(orgRoles)
    .where(
      and(eq(orgRoles.id, params.roleId), eq(orgRoles.organizationId, session.orgId))
    );

  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.isSystem) {
    return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 403 });
  }

  const membersWithRole = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(organizationMembers)
    .leftJoin(users, eq(organizationMembers.userId, users.id))
    .where(
      and(
        eq(organizationMembers.orgRoleId, params.roleId),
        eq(organizationMembers.organizationId, session.orgId),
        eq(organizationMembers.isActive, 1)
      )
    );

  if (membersWithRole.length > 0) {
    return NextResponse.json(
      {
        error: "ROLE_HAS_USERS",
        userCount: membersWithRole.length,
        users: membersWithRole,
      },
      { status: 409 }
    );
  }

  await db.delete(orgRoles).where(eq(orgRoles.id, params.roleId));
  return NextResponse.json({ success: true });
}
