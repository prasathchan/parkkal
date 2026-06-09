/**
 * Tests for GET /api/visits and POST /api/visits
 *
 * withRoute() ADMIN: no member-active check → getDb() called once per handler.
 * withRoute() DOCTOR: results[0] = [{ isActive: 1 }] (member check), then handler.
 *
 * POST /api/visits — ADMIN DB query order:
 *   results[0]: orgExists        → [{ id: "org1" }]
 *   results[1]: patientOrgLink   → [{ patientId: "p1" }]
 *   results[2]: doctorMembership → [{ userId: "u_doc" }]
 *   results[3]: todayCount       → [{ todayCount: 0 }]
 *   results[4]: INSERT visits    → undefined
 *
 * GET /api/visits — ADMIN DB query order:
 *   results[0]: count query → [{ total: 1 }]
 *   results[1]: rows query  → [{...visitRow}]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeDbMock, NO_PARAMS } from "@/lib/__tests__/helpers/db-mock";

// ── Module-level mocks ──────────────────────────────────────────────────────

vi.mock("@/lib/db",         () => ({ getDb: vi.fn() }));
vi.mock("@/lib/auth",       () => ({ getSession: vi.fn(), isTokenRevoked: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/permissions",() => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  PERMISSIONS: { VISITS_VIEW: "visits.view", VISITS_CREATE: "visits.create" },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 }),
}));
vi.mock("@/lib/logger",     () => ({
  logger: { forRoute: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn(), debug: vi.fn() }) },
}));
vi.mock("@/lib/utils",      () => ({
  escapeLike: vi.fn((v: string) => (v ?? "").replace(/%/g, "\\%").replace(/_/g, "\\_")),
  generateId: vi.fn().mockReturnValue("new_visit_id"),
}));
vi.mock("@/lib/app-logger", () => ({ writeAppLog: vi.fn() }));
vi.mock("@/db/schema",      () => ({
  visits:               { id: "id", organizationId: "orgId", patientId: "patientId", doctorId: "doctorId",
                          visitDate: "visitDate", status: "status", totalAmount: "totalAmount",
                          paidAmount: "paidAmount", createdAt: "createdAt", updatedAt: "updatedAt",
                          visitCode: "visitCode", appointmentId: "appointmentId", visitType: "visitType" },
  patients:             { id: "id", name: "name", patientCode: "patientCode" },
  users:                { id: "id", name: "name" },
  organizations:        { id: "id" },
  organizationPatients: { organizationId: "orgId", patientId: "patientId" },
  organizationMembers:  { organizationId: "orgId", userId: "userId", isActive: "isActive" },
  appointments:         { id: "id", organizationId: "orgId", status: "status" },
}));
vi.mock("drizzle-orm", () => ({
  eq:    vi.fn(), and: vi.fn((...a: unknown[]) => a), count: vi.fn(() => "count"),
  desc:  vi.fn(), like: vi.fn(), or: vi.fn(), sql: vi.fn(),
  asc:   vi.fn(), gte: vi.fn(), lte: vi.fn(), ne: vi.fn(), inArray: vi.fn(),
}));

import { getDb }      from "@/lib/db";
import { getSession } from "@/lib/auth";

// ── Shared fixtures ─────────────────────────────────────────────────────────

const ADMIN_SESSION = {
  userId: "u_admin", orgId: "org1", role: "ADMIN",
  jti: "jti_admin", email: "admin@test.com", name: "Admin",
};
const DOCTOR_SESSION = {
  userId: "u_doc", orgId: "org1", role: "DOCTOR",
  jti: "jti_doc", email: "doc@test.com", name: "Dr. Kumar",
};
const SAMPLE_VISIT = {
  id: "v1", visitCode: "VIS-20260101-0001",
  patientId: "p1", doctorId: "u_doc", visitDate: "2026-01-01",
  status: "OPEN", totalAmount: 500, paidAmount: 0,
  createdAt: 1000000, updatedAt: 1000000,
  patientName: "Ravi Kumar", patientCode: "PAT-001", doctorName: "Dr. Kumar",
};

// ── GET /api/visits ─────────────────────────────────────────────────────────

describe("GET /api/visits", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION as never);
  });

  it("returns paginated visit list for ADMIN", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ total: 1 }],
      [SAMPLE_VISIT],
    ]) as never);
    const { GET } = await import("@/app/api/visits/route");
    const res = await GET(new NextRequest("http://localhost/api/visits"), NO_PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.visits).toHaveLength(1);
    expect(body.visits[0].visitCode).toBe("VIS-20260101-0001");
    expect(body.total).toBe(1);
  });

  it("returns empty list when no visits", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ total: 0 }],
      [],
    ]) as never);
    const { GET } = await import("@/app/api/visits/route");
    const res = await GET(new NextRequest("http://localhost/api/visits"), NO_PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.visits).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("DOCTOR: member-active check at results[0], then count at results[1]", async () => {
    vi.mocked(getSession).mockResolvedValue(DOCTOR_SESSION as never);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ isActive: 1 }],   // member check
      [{ total: 1 }],      // count
      [SAMPLE_VISIT],      // rows
    ]) as never);
    const { GET } = await import("@/app/api/visits/route");
    const res = await GET(new NextRequest("http://localhost/api/visits"), NO_PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.visits).toHaveLength(1);
  });

  it("DOCTOR: blocked if member is inactive (403)", async () => {
    vi.mocked(getSession).mockResolvedValue(DOCTOR_SESSION as never);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ isActive: 0 }],  // member check → inactive
    ]) as never);
    const { GET } = await import("@/app/api/visits/route");
    const res = await GET(new NextRequest("http://localhost/api/visits"), NO_PARAMS);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    const { GET } = await import("@/app/api/visits/route");
    const res = await GET(new NextRequest("http://localhost/api/visits"), NO_PARAMS);
    expect(res.status).toBe(401);
  });
});

// ── POST /api/visits ────────────────────────────────────────────────────────

describe("POST /api/visits", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION as never);
  });

  function makeReq(body: object) {
    return new NextRequest("http://localhost/api/visits", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  const VALID_BODY = {
    patientId: "p1", doctorId: "u_doc",
    visitDate: "2026-06-09", visitType: "WALKIN",
  };

  it("creates a visit and returns 201", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ id: "org1" }],              // orgExists
      [{ patientId: "p1" }],         // patientOrgLink
      [{ userId: "u_doc" }],         // doctorMembership
      [{ todayCount: 0 }],           // today count
      undefined,                     // INSERT visits
    ]) as never);
    const { POST } = await import("@/app/api/visits/route");
    const res = await POST(makeReq(VALID_BODY), NO_PARAMS);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.visit.visitCode).toMatch(/^VIS-/);
    expect(body.visit.status).toBe("OPEN");
    expect(body.visit.totalAmount).toBe(0);
  });

  it("returns 400 for missing patientId", async () => {
    const { POST } = await import("@/app/api/visits/route");
    const res = await POST(makeReq({ doctorId: "u_doc", visitDate: "2026-06-09" }), NO_PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid visitDate format", async () => {
    const { POST } = await import("@/app/api/visits/route");
    const res = await POST(makeReq({ ...VALID_BODY, visitDate: "09-06-2026" }), NO_PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 400 when patient not in org", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ id: "org1" }],   // orgExists
      [],                  // patientOrgLink → empty
    ]) as never);
    const { POST } = await import("@/app/api/visits/route");
    const res = await POST(makeReq(VALID_BODY), NO_PARAMS);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Patient does not belong/i);
  });

  it("returns 400 when doctor not in org", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ id: "org1" }],           // orgExists
      [{ patientId: "p1" }],      // patientOrgLink
      [],                          // doctorMembership → empty
    ]) as never);
    const { POST } = await import("@/app/api/visits/route");
    const res = await POST(makeReq(VALID_BODY), NO_PARAMS);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Doctor does not belong/i);
  });

  it("returns 409 when visit already exists for appointment", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ id: "org1" }],
      [{ patientId: "p1" }],
      [{ userId: "u_doc" }],
      [{ id: "v_existing" }],    // existing visit for appointment
    ]) as never);
    const { POST } = await import("@/app/api/visits/route");
    const res = await POST(makeReq({ ...VALID_BODY, appointmentId: "appt1" }), NO_PARAMS);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already exists/i);
  });

  it("DOCTOR: overrides doctorId to own userId regardless of body", async () => {
    vi.mocked(getSession).mockResolvedValue(DOCTOR_SESSION as never);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ isActive: 1 }],           // member check (non-ADMIN)
      [{ id: "org1" }],
      [{ patientId: "p1" }],
      [{ userId: "u_doc" }],
      [{ todayCount: 2 }],
      undefined,
    ]) as never);
    const { POST } = await import("@/app/api/visits/route");
    const res = await POST(makeReq({ ...VALID_BODY, doctorId: "u_someone_else" }), NO_PARAMS);
    expect(res.status).toBe(201);
    // DOCTOR should always be assigned to their own session userId
    expect((await res.json()).visit.doctorId).toBe("u_doc");
  });

  it("visit code uses todayCount + 1 as sequence", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ id: "org1" }],
      [{ patientId: "p1" }],
      [{ userId: "u_doc" }],
      [{ todayCount: 4 }],       // 4 existing → new seq = 5
      undefined,
    ]) as never);
    const { POST } = await import("@/app/api/visits/route");
    const res = await POST(makeReq(VALID_BODY), NO_PARAMS);
    expect(res.status).toBe(201);
    const { visit } = await res.json();
    expect(visit.visitCode).toMatch(/0005$/);
  });
});
