/**
 * Tests for GET /api/export
 *
 * Key invariant: visits export requires VISITS_VIEW; treatments export requires
 * TREATMENTS_VIEW; patients export is gated by the withRoute() PATIENTS_VIEW check.
 * A receptionist who has PATIENTS_VIEW but not VISITS_VIEW or TREATMENTS_VIEW
 * must get 403 on those export types.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/export/route";
import { makeDbMock, NO_PARAMS, responseJson } from "@/lib/__tests__/helpers/db-mock";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  isTokenRevoked: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 }),
}));

vi.mock("@/lib/app-logger", () => ({
  logAppEvent: vi.fn(),
  writeAppLog: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

// hasPermission is mocked per-test to simulate different role capabilities
vi.mock("@/lib/permissions", () => ({
  PERMISSIONS: {
    PATIENTS_VIEW:    "patients.view",
    VISITS_VIEW:      "visits.view",
    TREATMENTS_VIEW:  "treatments.view",
  },
  hasPermission: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { getDb }       from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

function makeSession(perms: string[]) {
  return {
    userId: "usr_test",
    email:  "test@test.com",
    name:   "Test User",
    orgId:  "org_test",
    orgName: "Test Org",
    orgSlug: "test",
    role:   "RECEPTIONIST",
    orgRoleId: null,
    permissions: perms,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
}

function makeRequest(type: string) {
  return new NextRequest(`http://localhost/api/export?type=${type}`, {
    headers: { cookie: "pkd_org_session=fake_token" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/export — permission gates", () => {
  it("returns 403 on visits export when user lacks VISITS_VIEW", async () => {
    // PATIENTS_VIEW only — withRoute() will pass, but the in-handler check must block
    vi.mocked(getSession).mockResolvedValue(makeSession(["patients.view"]) as never);
    // First DB call inside withRoute = member-active check → must return { isActive: 1 }
    vi.mocked(getDb).mockReturnValue(makeDbMock([[{ isActive: 1 }]]) as never);
    // hasPermission: PATIENTS_VIEW=true (passes withRoute), VISITS_VIEW=false (blocked)
    vi.mocked(hasPermission).mockImplementation(async (_s, perm) => perm === "patients.view");

    const res = await GET(makeRequest("visits"), NO_PARAMS);
    expect(res.status).toBe(403);
    const body = await responseJson(res);
    expect(body.error).toMatch(/permission/i);
  });

  it("returns 403 on treatments export when user lacks TREATMENTS_VIEW", async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession(["patients.view"]) as never);
    vi.mocked(getDb).mockReturnValue(makeDbMock([[{ isActive: 1 }]]) as never);
    vi.mocked(hasPermission).mockImplementation(async (_s, perm) => perm === "patients.view");

    const res = await GET(makeRequest("treatments"), NO_PARAMS);
    expect(res.status).toBe(403);
    const body = await responseJson(res);
    expect(body.error).toMatch(/permission/i);
  });

  it("allows visits export when user has VISITS_VIEW", async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession(["patients.view", "visits.view"]) as never);
    // results[0] = member-active check, results[1] = the visits SELECT query
    vi.mocked(getDb).mockReturnValue(makeDbMock([[{ isActive: 1 }], []]) as never);
    vi.mocked(hasPermission).mockResolvedValue(true);

    const res = await GET(makeRequest("visits"), NO_PARAMS);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
  });

  it("allows treatments export when user has TREATMENTS_VIEW", async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession(["patients.view", "treatments.view"]) as never);
    vi.mocked(getDb).mockReturnValue(makeDbMock([[{ isActive: 1 }], []]) as never);
    vi.mocked(hasPermission).mockResolvedValue(true);

    const res = await GET(makeRequest("treatments"), NO_PARAMS);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
  });

  it("returns 400 for unknown export type", async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession(["patients.view"]) as never);
    vi.mocked(getDb).mockReturnValue(makeDbMock([[{ isActive: 1 }]]) as never);
    vi.mocked(hasPermission).mockResolvedValue(true);

    const res = await GET(
      new NextRequest("http://localhost/api/export?type=invoices", {
        headers: { cookie: "pkd_org_session=fake_token" },
      }),
      NO_PARAMS
    );
    expect(res.status).toBe(400);
  });
});
