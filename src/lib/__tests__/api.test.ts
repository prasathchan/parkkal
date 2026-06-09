/**
 * Tests for src/lib/api.ts — the withRoute() HOF and response helpers
 *
 * Covers:
 *   - apiOk() and apiError() response helpers
 *   - withRoute() middleware: authentication, token revocation, member active check,
 *     rate limiting, permission checking, ZodError handling, generic error handling
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError, withRoute, RATE_LIMITS } from "@/lib/api";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// We mock the deps that withRoute() calls so tests don't need a real DB or JWT.
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  isTokenRevoked: vi.fn().mockResolvedValue(false),
  revokeToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/permissions", () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  PERMISSIONS: { PATIENTS_VIEW: "patients.view", PATIENTS_CREATE: "patients.create" },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    forRoute: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      security: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: async () => [{ isActive: 1 }],
      }),
    }),
  }),
}));

vi.mock("@/db/schema", () => ({
  organizationMembers: { organizationId: "organization_id", userId: "user_id", isActive: "is_active" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { isTokenRevoked } from "@/lib/auth";

const mockedGetSession = vi.mocked(getSession);
const mockedHasPermission = vi.mocked(hasPermission);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedIsTokenRevoked = vi.mocked(isTokenRevoked);

/** A session that passes all checks by default */
const VALID_SESSION = {
  userId: "user_1",
  email: "admin@parkkal.com",
  name: "Admin",
  orgId: "org_1",
  orgName: "Parkkal Dental",
  orgSlug: "parkkal",
  role: "ADMIN",
  jti: "jwt-id-abc123",
  permissions: ["patients.view", "patients.create"],
};

/** Build a minimal NextRequest */
function makeRequest(method = "GET", body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Build params as a Promise (Next.js 15 convention) */
function makeContext<P extends Record<string, string>>(params: P) {
  return { params: Promise.resolve(params) };
}

// ─── apiOk ────────────────────────────────────────────────────────────────────

describe("apiOk", () => {
  it("returns 200 with JSON body by default", async () => {
    const res = apiOk({ id: "abc" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "abc" });
  });

  it("accepts a custom status code", async () => {
    const res = apiOk({ id: "xyz" }, 201);
    expect(res.status).toBe(201);
  });

  it("serialises nested objects", async () => {
    const res = apiOk({ patients: [{ id: "1", name: "Ravi" }], total: 1 });
    const body = await res.json();
    expect(body.patients[0].name).toBe("Ravi");
  });
});

// ─── apiError ────────────────────────────────────────────────────────────────

describe("apiError", () => {
  it("returns the given status code", async () => {
    const res = apiError("Not found", 404);
    expect(res.status).toBe(404);
  });

  it("includes error message in body", async () => {
    const body = await apiError("Forbidden", 403).json();
    expect(body.error).toBe("Forbidden");
  });

  it("merges extra fields into the body", async () => {
    const body = await apiError("Visit exists", 409, { visitId: "v_123" }).json();
    expect(body.error).toBe("Visit exists");
    expect(body.visitId).toBe("v_123");
  });
});

// ─── RATE_LIMITS ─────────────────────────────────────────────────────────────

describe("RATE_LIMITS", () => {
  it("WRITE has higher limit than DESTRUCTIVE", () => {
    expect(RATE_LIMITS.WRITE.limit).toBeGreaterThan(RATE_LIMITS.DESTRUCTIVE.limit);
  });

  it("DESTRUCTIVE has the lowest limit", () => {
    const limits = Object.values(RATE_LIMITS).map((r) => r.limit);
    expect(RATE_LIMITS.DESTRUCTIVE.limit).toBe(Math.min(...limits));
  });

  it("READ has the highest limit", () => {
    const limits = Object.values(RATE_LIMITS).map((r) => r.limit);
    expect(RATE_LIMITS.READ.limit).toBe(Math.max(...limits));
  });
});

// ─── withRoute — authentication ───────────────────────────────────────────────

describe("withRoute — authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsTokenRevoked.mockResolvedValue(false);
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
    mockedHasPermission.mockResolvedValue(true);
  });

  it("returns 401 when there is no session cookie", async () => {
    mockedGetSession.mockResolvedValue(null);
    const handler = withRoute({ route: "GET /test" }, async () => apiOk({ ok: true }));
    const res = await handler(makeRequest(), makeContext({}));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("calls the handler when session is valid", async () => {
    mockedGetSession.mockResolvedValue(VALID_SESSION);
    const handler = withRoute({ route: "GET /test" }, async () => apiOk({ ok: true }));
    const res = await handler(makeRequest(), makeContext({}));
    expect(res.status).toBe(200);
  });
});

// ─── withRoute — token revocation ─────────────────────────────────────────────

describe("withRoute — token revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSession.mockResolvedValue(VALID_SESSION);
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
    mockedHasPermission.mockResolvedValue(true);
  });

  it("returns 401 when the token jti has been revoked", async () => {
    mockedIsTokenRevoked.mockResolvedValue(true);
    const handler = withRoute({ route: "GET /test" }, async () => apiOk({ ok: true }));
    const res = await handler(makeRequest(), makeContext({}));
    expect(res.status).toBe(401);
  });

  it("allows the request when the token is not revoked", async () => {
    mockedIsTokenRevoked.mockResolvedValue(false);
    const handler = withRoute({ route: "GET /test" }, async () => apiOk({ ok: true }));
    const res = await handler(makeRequest(), makeContext({}));
    expect(res.status).toBe(200);
  });

  it("skips revocation check when jti is absent (legacy token)", async () => {
    const sessionNoJti = { ...VALID_SESSION, jti: undefined };
    mockedGetSession.mockResolvedValue(sessionNoJti);
    mockedIsTokenRevoked.mockResolvedValue(false);
    const handler = withRoute({ route: "GET /test" }, async () => apiOk({ ok: true }));
    const res = await handler(makeRequest(), makeContext({}));
    expect(res.status).toBe(200);
    // isTokenRevoked should NOT have been called with undefined
    expect(mockedIsTokenRevoked).not.toHaveBeenCalled();
  });
});

// ─── withRoute — rate limiting ────────────────────────────────────────────────

describe("withRoute — rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSession.mockResolvedValue(VALID_SESSION);
    mockedIsTokenRevoked.mockResolvedValue(false);
    mockedHasPermission.mockResolvedValue(true);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const handler = withRoute(
      { route: "POST /test", rateLimit: RATE_LIMITS.WRITE },
      async () => apiOk({ ok: true })
    );
    const res = await handler(makeRequest("POST"), makeContext({}));
    expect(res.status).toBe(429);
  });

  it("does not call checkRateLimit when no rateLimit option is set", async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
    const handler = withRoute({ route: "GET /test" }, async () => apiOk({ ok: true }));
    await handler(makeRequest(), makeContext({}));
    expect(mockedCheckRateLimit).not.toHaveBeenCalled();
  });

  it("uses per-user key by default (write:userId)", async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
    const handler = withRoute(
      { route: "POST /test", rateLimit: RATE_LIMITS.WRITE },
      async () => apiOk({ ok: true })
    );
    await handler(makeRequest("POST"), makeContext({}));
    expect(mockedCheckRateLimit).toHaveBeenCalledWith(
      `write:${VALID_SESSION.userId}`,
      RATE_LIMITS.WRITE
    );
  });

  it("uses custom rateLimitKey function when provided", async () => {
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
    const handler = withRoute(
      {
        route: "POST /test",
        rateLimit: RATE_LIMITS.LOGIN,
        rateLimitKey: (_, req) => `ip:${req.headers.get("cf-connecting-ip") ?? "unknown"}`,
      },
      async () => apiOk({ ok: true })
    );
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      headers: { "cf-connecting-ip": "1.2.3.4" },
    });
    await handler(req, makeContext({}));
    expect(mockedCheckRateLimit).toHaveBeenCalledWith("ip:1.2.3.4", RATE_LIMITS.LOGIN);
  });
});

// ─── withRoute — authorization ────────────────────────────────────────────────

describe("withRoute — authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSession.mockResolvedValue(VALID_SESSION);
    mockedIsTokenRevoked.mockResolvedValue(false);
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
  });

  it("returns 403 when user lacks required permission", async () => {
    mockedHasPermission.mockResolvedValue(false);
    const handler = withRoute(
      { route: "GET /test", permission: "patients.view" as never },
      async () => apiOk({ ok: true })
    );
    const res = await handler(makeRequest(), makeContext({}));
    expect(res.status).toBe(403);
  });

  it("calls the handler when permission is granted", async () => {
    mockedHasPermission.mockResolvedValue(true);
    const handler = withRoute(
      { route: "GET /test", permission: "patients.view" as never },
      async () => apiOk({ ok: true })
    );
    const res = await handler(makeRequest(), makeContext({}));
    expect(res.status).toBe(200);
  });

  it("skips permission check when no permission option is set", async () => {
    const handler = withRoute({ route: "GET /test" }, async () => apiOk({ ok: true }));
    await handler(makeRequest(), makeContext({}));
    expect(mockedHasPermission).not.toHaveBeenCalled();
  });

  it("returns 403 for non-ADMIN on adminOnly route", async () => {
    const doctorSession = { ...VALID_SESSION, role: "DOCTOR" };
    mockedGetSession.mockResolvedValue(doctorSession);
    const handler = withRoute(
      { route: "DELETE /test", adminOnly: true },
      async () => apiOk({ ok: true })
    );
    const res = await handler(makeRequest("DELETE"), makeContext({}));
    expect(res.status).toBe(403);
  });

  it("allows ADMIN on adminOnly route", async () => {
    mockedGetSession.mockResolvedValue(VALID_SESSION); // role: ADMIN
    const handler = withRoute(
      { route: "DELETE /test", adminOnly: true },
      async () => apiOk({ ok: true })
    );
    const res = await handler(makeRequest("DELETE"), makeContext({}));
    expect(res.status).toBe(200);
  });
});

// ─── withRoute — error handling ───────────────────────────────────────────────

describe("withRoute — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSession.mockResolvedValue(VALID_SESSION);
    mockedIsTokenRevoked.mockResolvedValue(false);
    mockedHasPermission.mockResolvedValue(true);
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
  });

  it("returns 400 with details when handler throws ZodError", async () => {
    const schema = z.object({ name: z.string().min(1) });
    const handler = withRoute({ route: "POST /test" }, async () => {
      schema.parse({ name: "" }); // throws ZodError
      return apiOk({});
    });
    const res = await handler(makeRequest("POST"), makeContext({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid input");
    expect(body.details).toBeDefined();
  });

  it("returns 500 for unexpected errors without leaking details", async () => {
    const handler = withRoute({ route: "GET /test" }, async () => {
      throw new Error("DB connection failed — internal detail");
    });
    const res = await handler(makeRequest(), makeContext({}));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("DB connection failed");
  });
});

// ─── withRoute — path params ──────────────────────────────────────────────────

describe("withRoute — path params", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSession.mockResolvedValue(VALID_SESSION);
    mockedIsTokenRevoked.mockResolvedValue(false);
    mockedHasPermission.mockResolvedValue(true);
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
  });

  it("passes path params as the third argument to the handler", async () => {
    let capturedParams: Record<string, string> = {};
    const handler = withRoute<{ id: string }>(
      { route: "GET /test/[id]" },
      async (req, ctx, params) => {
        capturedParams = params;
        return apiOk({});
      }
    );
    await handler(makeRequest(), makeContext({ id: "patient_123" }));
    expect(capturedParams.id).toBe("patient_123");
  });

  it("handles spread path params (catch-all routes)", async () => {
    let capturedPath: string[] = [];
    const handler = withRoute<{ path: string[] }>(
      { route: "GET /files/[...path]" },
      async (req, ctx, { path }) => {
        capturedPath = path;
        return apiOk({});
      }
    );
    await handler(makeRequest(), makeContext({ path: ["patients", "abc", "file.jpg"] } as never));
    expect(capturedPath).toEqual(["patients", "abc", "file.jpg"]);
  });
});

// ─── withRoute — context values ───────────────────────────────────────────────

describe("withRoute — context values", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSession.mockResolvedValue(VALID_SESSION);
    mockedIsTokenRevoked.mockResolvedValue(false);
    mockedHasPermission.mockResolvedValue(true);
    mockedCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 });
  });

  it("provides session with correct userId and orgId", async () => {
    let capturedUserId: string | null = null;
    let capturedOrgId: string | null = null;
    const handler = withRoute({ route: "GET /test" }, async (req, { session }) => {
      capturedUserId = session.userId;
      capturedOrgId = session.orgId;
      return apiOk({});
    });
    await handler(makeRequest(), makeContext({}));
    expect(capturedUserId).toBe(VALID_SESSION.userId);
    expect(capturedOrgId).toBe(VALID_SESSION.orgId);
  });

  it("provides db object", async () => {
    let dbProvided = false;
    const handler = withRoute({ route: "GET /test" }, async (req, { db }) => {
      dbProvided = db !== null && db !== undefined;
      return apiOk({});
    });
    await handler(makeRequest(), makeContext({}));
    expect(dbProvided).toBe(true);
  });

  it("provides log object with info/warn/error/security methods", async () => {
    let logProvided = false;
    const handler = withRoute({ route: "GET /test" }, async (req, { log }) => {
      logProvided = typeof log.info === "function" &&
                    typeof log.error === "function" &&
                    typeof log.security === "function";
      return apiOk({});
    });
    await handler(makeRequest(), makeContext({}));
    expect(logProvided).toBe(true);
  });
});
