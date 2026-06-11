/**
 * Tests for GET /api/org/roles and POST /api/org/roles
 *
 * Both endpoints are ADMIN-only (adminOnly: true).
 * GET DB query order (roles already seeded):
 *   results[0]: SELECT orgRoles WHERE orgId        → [{ id, name, slug, permissions: "[]", ... }]
 *   results[1]: SELECT unassigned members          → []  (no backfill needed)
 *   results[2]: SELECT memberCounts GROUP BY roleId → []
 *
 * POST DB query order:
 *   results[0]: SELECT existing role by slug       → [] (no conflict)
 *   results[1]: INSERT orgRoles                    → undefined
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeDbMock, NO_PARAMS, responseJson } from "@/lib/__tests__/helpers/db-mock";

// ── Module-level mocks ──────────────────────────────────────────────────────

vi.mock("@/lib/db",         () => ({ getDb: vi.fn() }));
vi.mock("@/lib/auth",       () => ({ getSession: vi.fn(), isTokenRevoked: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/permissions",() => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  PERMISSIONS: {},
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 }),
}));
vi.mock("@/lib/logger",     () => ({
  logger: { forRoute: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn(), debug: vi.fn() }) },
}));
vi.mock("@/lib/app-logger", () => ({ writeAppLog: vi.fn() }));
vi.mock("@/lib/audit",      () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/default-roles", () => ({ DEFAULT_ROLES: [] }));
vi.mock("@/db/schema",      () => ({
  orgRoles:            { id: "id", organizationId: "orgId", name: "name", slug: "slug",
                         description: "description", color: "color", isSystem: "isSystem",
                         permissions: "permissions", createdAt: "createdAt", updatedAt: "updatedAt" },
  organizationMembers: { organizationId: "orgId", userId: "userId", isActive: "isActive",
                         orgRoleId: "orgRoleId", role: "role", id: "id" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(), and: vi.fn((...a: unknown[]) => a), isNull: vi.fn(),
  sql: vi.fn(), desc: vi.fn(), asc: vi.fn(),
}));

import { getDb }      from "@/lib/db";
import { getSession } from "@/lib/auth";

const ADMIN_SESSION = {
  userId: "u_admin", orgId: "org1", role: "ADMIN",
  jti: "jti_x", email: "admin@test.com", name: "Admin",
};

const NON_ADMIN_SESSION = {
  userId: "u_doc", orgId: "org1", role: "DOCTOR",
  jti: "jti_y", email: "doc@test.com", name: "Dr K",
};

const SAMPLE_ROLE = {
  id: "role_org1_doctor_1",
  name: "Doctor", slug: "doctor", description: "Clinical staff",
  color: "#3B82F6", isSystem: 1,
  permissions: '["patients.view","visits.view"]',
};

// ── GET /api/org/roles ──────────────────────────────────────────────────────

describe("GET /api/org/roles", () => {
  beforeEach(() => vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION as never));

  it("returns roles list with parsed permissions and user counts", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [SAMPLE_ROLE],    // roles query
      [],               // unassigned members backfill
      [],               // memberCounts
    ]) as never);
    const { GET } = await import("@/app/api/org/roles/route");
    const res = await GET(new NextRequest("http://localhost/api/org/roles"), NO_PARAMS);
    expect(res.status).toBe(200);
    const body = await responseJson(res);
    expect(body.roles).toHaveLength(1);
    expect(body.roles[0].permissions).toEqual(["patients.view", "visits.view"]);
    expect(body.roles[0].userCount).toBe(0);
  });

  it("returns 403 for non-ADMIN role", async () => {
    vi.mocked(getSession).mockResolvedValue(NON_ADMIN_SESSION as never);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ isActive: 1 }],  // member check (non-ADMIN)
    ]) as never);
    const { GET } = await import("@/app/api/org/roles/route");
    const res = await GET(new NextRequest("http://localhost/api/org/roles"), NO_PARAMS);
    expect(res.status).toBe(403);
  });

  it("attaches correct user count per role", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [SAMPLE_ROLE],
      [],
      [{ orgRoleId: "role_org1_doctor_1", count: 3 }],   // 3 members in this role
    ]) as never);
    const { GET } = await import("@/app/api/org/roles/route");
    const res = await GET(new NextRequest("http://localhost/api/org/roles"), NO_PARAMS);
    const body = await responseJson(res);
    expect(body.roles[0].userCount).toBe(3);
  });

  it("returns empty roles array for org with no roles defined", async () => {
    // Empty roles → triggers seed attempt → we return empty again (seed mock does nothing)
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [],   // roles query → empty (triggers seed)
      [],   // seed insert → fails silently (batch mock)
      [],   // roles re-query after seed
      [],   // unassigned backfill
      [],   // memberCounts
    ]) as never);
    const { GET } = await import("@/app/api/org/roles/route");
    const res = await GET(new NextRequest("http://localhost/api/org/roles"), NO_PARAMS);
    expect(res.status).toBe(200);
  });
});

// ── POST /api/org/roles ─────────────────────────────────────────────────────

describe("POST /api/org/roles", () => {
  beforeEach(() => vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION as never));

  function makeReq(body: object) {
    return new NextRequest("http://localhost/api/org/roles", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("creates a new role and returns 201", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [],          // no existing role with this slug
      undefined,   // INSERT orgRoles
    ]) as never);
    const { POST } = await import("@/app/api/org/roles/route");
    const res = await POST(makeReq({
      name: "Hygienist",
      description: "Dental hygienist",
      color: "#10B981",
      permissions: ["patients.view"],
    }), NO_PARAMS);
    expect(res.status).toBe(201);
    const body = await responseJson(res);
    expect(body.role.name).toBe("Hygienist");
    expect(body.role.permissions).toEqual(["patients.view"]);
    expect(body.role.slug).toBe("hygienist");
  });

  it("returns 400 when name is empty", async () => {
    const { POST } = await import("@/app/api/org/roles/route");
    const res = await POST(makeReq({ name: "   " }), NO_PARAMS);
    expect(res.status).toBe(400);
    expect(( await responseJson(res) ).error).toMatch(/Name is required/i);
  });

  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/org/roles/route");
    const res = await POST(makeReq({ permissions: ["patients.view"] }), NO_PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 409 when role name already exists (slug collision)", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ id: "role_existing" }],  // existing slug match
    ]) as never);
    const { POST } = await import("@/app/api/org/roles/route");
    const res = await POST(makeReq({ name: "Doctor", permissions: [] }), NO_PARAMS);
    expect(res.status).toBe(409);
    expect(( await responseJson(res) ).error).toMatch(/already exists/i);
  });

  it("defaults color to #3B82F6 when not provided", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([[], undefined]) as never);
    const { POST } = await import("@/app/api/org/roles/route");
    const res = await POST(makeReq({ name: "NewRole" }), NO_PARAMS);
    expect(res.status).toBe(201);
    expect(( await responseJson(res) ).role.color).toBe("#3B82F6");
  });

  it("returns 403 for non-ADMIN", async () => {
    vi.mocked(getSession).mockResolvedValue(NON_ADMIN_SESSION as never);
    vi.mocked(getDb).mockReturnValue(makeDbMock([[{ isActive: 1 }]]) as never);
    const { POST } = await import("@/app/api/org/roles/route");
    const res = await POST(makeReq({ name: "Test", permissions: [] }), NO_PARAMS);
    expect(res.status).toBe(403);
  });
});
