/**
 * Tests for POST /api/auth/logout and GET /api/auth/me
 *
 * logout: clears cookies, revokes token if jti present
 * me: returns session payload (uses withRoute — ADMIN, no member check)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeDbMock, NO_PARAMS, responseJson } from "@/lib/__tests__/helpers/db-mock";

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/db",         () => ({ getDb: vi.fn() }));
vi.mock("@/lib/auth",       () => ({
  getSession:     vi.fn(),
  isTokenRevoked: vi.fn().mockResolvedValue(false),
  revokeToken:    vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/permissions",() => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  PERMISSIONS: {},
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 19, resetAt: 0 }),
}));
vi.mock("@/lib/logger",     () => ({
  logger: { forRoute: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn(), debug: vi.fn() }) },
}));
vi.mock("@/lib/app-logger", () => ({ writeAppLog: vi.fn() }));
vi.mock("@/db/schema",      () => ({
  organizationMembers: { organizationId: "orgId", userId: "userId", isActive: "isActive" },
}));
vi.mock("drizzle-orm",      () => ({
  eq: vi.fn(), and: vi.fn((...a: unknown[]) => a),
}));

import { getSession, revokeToken } from "@/lib/auth";
import { checkRateLimit }           from "@/lib/rate-limit";
import { getDb }                    from "@/lib/db";

const SESSION = {
  userId: "u1", orgId: "org1", role: "ADMIN",
  jti: "jti_abc", email: "admin@test.com", name: "Admin",
};

// ── POST /api/auth/logout ───────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(SESSION as never);
    vi.mocked(revokeToken).mockClear();
  });

  it("returns 200 and clears both cookies", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");
    const req = new NextRequest("http://localhost/api/auth/logout", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(( await responseJson(res) ).success).toBe(true);
    // Both cookies should be cleared (set to empty + Max-Age=0)
    const cookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
    const cookieStr = cookies.join("; ");
    expect(cookieStr).toContain("pkd_session");
    expect(cookieStr).toContain("pkd_org_session");
  });

  it("revokes jti token when session has jti", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");
    const req = new NextRequest("http://localhost/api/auth/logout", { method: "POST" });
    await POST(req);
    expect(vi.mocked(revokeToken)).toHaveBeenCalledWith("jti_abc", expect.any(Number));
  });

  it("does not call revokeToken when session has no jti", async () => {
    vi.mocked(getSession).mockResolvedValue({ ...SESSION, jti: undefined } as never);
    const { POST } = await import("@/app/api/auth/logout/route");
    const req = new NextRequest("http://localhost/api/auth/logout", { method: "POST" });
    await POST(req);
    expect(vi.mocked(revokeToken)).not.toHaveBeenCalled();
  });

  it("still clears cookies when no session exists", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    const { POST } = await import("@/app/api/auth/logout/route");
    const req = new NextRequest("http://localhost/api/auth/logout", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 429 when rate limit exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 5000 });
    const { POST } = await import("@/app/api/auth/logout/route");
    const req = new NextRequest("http://localhost/api/auth/logout", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  it("returns the current session payload", async () => {
    vi.mocked(getSession).mockResolvedValue(SESSION as never);
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const { GET } = await import("@/app/api/auth/me/route");
    const req = new NextRequest("http://localhost/api/auth/me");
    const res = await GET(req, NO_PARAMS);
    expect(res.status).toBe(200);
    const body = await responseJson(res);
    expect(body.user.userId).toBe("u1");
    expect(body.user.orgId).toBe("org1");
    expect(body.user.role).toBe("ADMIN");
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    const { GET } = await import("@/app/api/auth/me/route");
    const res = await GET(new NextRequest("http://localhost/api/auth/me"), NO_PARAMS);
    expect(res.status).toBe(401);
  });
});
