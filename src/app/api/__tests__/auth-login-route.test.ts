/**
 * Tests for POST /api/auth/login
 *
 * The login route does NOT use withRoute() — it calls helpers directly.
 * DB query order (for a single-org user):
 *   results[0] → user row from `users` table
 *   results[1] → membership rows from `organizationMembers JOIN organizations`
 *
 * No member-active or revocation check here — those are withRoute concerns.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeDbMock, responseJson } from "@/lib/__tests__/helpers/db-mock";

// ── Module-level mocks ──────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  verifyPassword:  vi.fn(),
  createToken:     vi.fn().mockResolvedValue("pre_token_abc"),
  createOrgToken:  vi.fn().mockResolvedValue("org_token_xyz"),
}));
vi.mock("@/lib/permissions", () => ({
  resolveRolePermissions: vi.fn().mockResolvedValue(["patients.view"]),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 }),
  getClientIp:    vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    forRoute: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn(), debug: vi.fn() }),
  },
}));
vi.mock("@/db/schema", () => ({
  users:                { id: "id", email: "email", name: "name", isActive: "isActive", passwordHash: "passwordHash" },
  organizationMembers:  { userId: "userId", organizationId: "orgId", isActive: "isActive", role: "role", orgRoleId: "orgRoleId", portalAccess: "portalAccess" },
  organizations:        { id: "id", name: "name", slug: "slug", address: "address", isActive: "isActive" },
}));
vi.mock("drizzle-orm", () => ({
  eq:       vi.fn(),
  and:      vi.fn((...a: unknown[]) => a),
  innerJoin: vi.fn(),
}));

import { getDb }           from "@/lib/db";
import { verifyPassword }  from "@/lib/auth";
import { checkRateLimit }  from "@/lib/rate-limit";

// ── Fixtures ────────────────────────────────────────────────────────────────

const ACTIVE_USER = {
  id: "u1", email: "admin@test.com", name: "Admin",
  isActive: 1, passwordHash: "$2b$12$hashedpw",
};

const MEMBERSHIP = {
  orgId: "org1", orgName: "Test Clinic", orgSlug: "test-clinic",
  orgAddress: "Chennai", orgIsActive: 1,
  role: "ADMIN", orgRoleId: "role1",
  memberIsActive: 1, portalAccess: 1,
};

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
  });

  it("returns 400 for missing email", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeReq({ password: "pass1234" }));
    expect(res.status).toBe(400);
    expect(( await responseJson(res) ).error).toBe("Invalid input");
  });

  it("returns 400 for invalid email format", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeReq({ email: "not-an-email", password: "pass1234" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limit exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 10_000 });
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeReq({ email: "a@b.com", password: "x" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 401 when user not found", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [],           // users query → empty
    ]) as never);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeReq({ email: "notfound@test.com", password: "pass1234" }));
    expect(res.status).toBe(401);
    expect(( await responseJson(res) ).error).toMatch(/Invalid email or password/i);
  });

  it("returns 401 for inactive account", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ ...ACTIVE_USER, isActive: 0 }],
    ]) as never);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeReq({ email: "admin@test.com", password: "pass1234" }));
    expect(res.status).toBe(401);
    expect(( await responseJson(res) ).error).toMatch(/inactive/i);
  });

  it("returns 401 for account with no password hash (invite pending)", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ ...ACTIVE_USER, passwordHash: null }],
    ]) as never);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeReq({ email: "admin@test.com", password: "pass1234" }));
    expect(res.status).toBe(401);
    expect(( await responseJson(res) ).error).toMatch(/incomplete/i);
  });

  it("returns 401 for wrong password", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [ACTIVE_USER],
    ]) as never);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeReq({ email: "admin@test.com", password: "wrongpass" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no active org memberships", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [ACTIVE_USER],
      [],   // memberships → empty
    ]) as never);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeReq({ email: "admin@test.com", password: "pass1234" }));
    expect(res.status).toBe(403);
    expect(( await responseJson(res) ).error).toMatch(/No organization access/i);
  });

  it("single org: sets org session cookie and redirects to /dashboard", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [ACTIVE_USER],
      [MEMBERSHIP],
    ]) as never);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeReq({ email: "admin@test.com", password: "pass1234" }));
    expect(res.status).toBe(200);
    const body = await responseJson(res);
    expect(body.redirect).toBe("/dashboard");
    // HttpOnly org session cookie must be set
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("pkd_org_session");
  });

  it("multi-org: returns org list and sets pre-org cookie", async () => {
    const secondMembership = { ...MEMBERSHIP, orgId: "org2", orgName: "Branch Clinic", orgSlug: "branch" };
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [ACTIVE_USER],
      [MEMBERSHIP, secondMembership],
    ]) as never);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeReq({ email: "admin@test.com", password: "pass1234" }));
    expect(res.status).toBe(200);
    const body = await responseJson(res);
    expect(body.requireOrgSelection).toBe(true);
    expect(body.organizations).toHaveLength(2);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("pkd_session");
  });

  it("filters out inactive org memberships before login decision", async () => {
    const inactiveMembership = { ...MEMBERSHIP, memberIsActive: 0 };
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [ACTIVE_USER],
      [inactiveMembership],   // only membership is inactive → should 403
    ]) as never);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeReq({ email: "admin@test.com", password: "pass1234" }));
    expect(res.status).toBe(403);
  });
});
