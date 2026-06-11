/**
 * Tests for GET /api/treatments and POST /api/treatments
 *
 * Key business rules:
 *   - DOCTOR role: server forces doctorId = session.userId (can't assign to others)
 *   - Patient must be linked to the org → 403 if not
 *   - Doctor must be an active org member → 400 if not
 *
 * getDb() call order in withRoute:
 *   ADMIN:      no member-check → handler queries start at results[0]
 *   non-ADMIN:  member-check → results[0] = [{ isActive:1 }], handler starts at results[1]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeDbMock, responseJson } from "@/lib/__tests__/helpers/db-mock";

// ─── Module-level mocks ────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getSession:     vi.fn(),
  isTokenRevoked: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/permissions", () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  PERMISSIONS: {
    TREATMENTS_VIEW:   "treatments.view",
    TREATMENTS_CREATE: "treatments.create",
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 }),
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    forRoute: () => ({
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn(), debug: vi.fn(),
    }),
  },
}));
vi.mock("@/db/schema", () => ({
  treatments:           { id: "id", organizationId: "orgId", patientId: "patientId", doctorId: "doctorId", status: "status", createdAt: "ca" },
  patients:             { id: "id", name: "name", patientCode: "pc" },
  users:                { id: "id", name: "name" },
  organizationPatients: { organizationId: "orgId", patientId: "patientId", isActive: "isActive" },
  organizationMembers:  { organizationId: "orgId", userId: "userId", isActive: "isActive" },
}));
vi.mock("drizzle-orm", () => ({
  like: vi.fn(), or: vi.fn(), and: vi.fn((...a: unknown[]) => a),
  desc: vi.fn(), count: vi.fn(() => "count"), eq: vi.fn(),
  gte: vi.fn(), lte: vi.fn(), ne: vi.fn(), asc: vi.fn(), inArray: vi.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { getDb }      from "@/lib/db";
import { getSession } from "@/lib/auth";
import { GET, POST }  from "@/app/api/treatments/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_SESSION = {
  userId: "u_admin", email: "a@p.com", name: "Admin",
  orgId: "org1", orgName: "Parkkal", orgSlug: "parkkal",
  role: "ADMIN", jti: "tok1", permissions: ["treatments.view", "treatments.create"],
};
const DOCTOR_SESSION = { ...ADMIN_SESSION, userId: "u_doc", role: "DOCTOR", jti: "tok2" };

const TREATMENT = {
  id: "t1", patientId: "p1", doctorId: "u_doc",
  description: "Root Canal", procedure: "RCT", toothNumbers: "16",
  cost: 5000, status: "PLANNED", createdAt: 1_700_000_000_000,
  patientName: "Ravi Kumar", patientCode: "PKL-000001", doctorName: "Dr. Sharma",
  consentStatus: null, consentDocumentUrl: null, consentDocumentName: null,
  consentUploadedAt: null, consentNotes: null, appointmentId: null,
};

function makeReq(url: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(url, {
    method, headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const CTX = { params: Promise.resolve({}) };

// ─── GET /api/treatments ──────────────────────────────────────────────────────

describe("GET /api/treatments", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns treatment list and total for ADMIN", async () => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ total: 1 }],
      [TREATMENT],
    ]) as never);

    const res = await GET(makeReq("http://localhost/api/treatments"), CTX);
    expect(res.status).toBe(200);
    const body = await responseJson(res);
    expect(body.total).toBe(1);
    expect(body.treatments).toHaveLength(1);
    expect(body.treatments[0].description).toBe("Root Canal");
  });

  it("DOCTOR gets own treatments without error (server enforces filter)", async () => {
    vi.mocked(getSession).mockResolvedValue(DOCTOR_SESSION);
    // DOCTOR: results[0] = member check, results[1-2] = handler
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ isActive: 1 }],          // member-active check
      [{ total: 1 }],
      [TREATMENT],
    ]) as never);

    const res = await GET(makeReq("http://localhost/api/treatments"), CTX);
    expect(res.status).toBe(200);
    expect(( await responseJson(res) ).treatments).toHaveLength(1);
  });

  it("returns empty list when no treatments", async () => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([[{ total: 0 }], []]) as never);

    const body = await responseJson(await GET(makeReq("http://localhost/api/treatments"), CTX));
    expect(body.treatments).toHaveLength(0);
    expect(body.hasMore).toBe(false);
  });

  it("clamps limit to 200", async () => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([[{ total: 0 }], []]) as never);
    const res = await GET(makeReq("http://localhost/api/treatments?limit=9999"), CTX);
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/treatments ─────────────────────────────────────────────────────

describe("POST /api/treatments", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const VALID = { patientId: "p1", doctorId: "u_doc", description: "Root Canal Treatment", cost: 5000 };

  it("creates a treatment and returns 201 (ADMIN)", async () => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ patientId: "p1", isActive: 1 }],  // patient-org check
      [{ userId: "u_doc" }],               // doctor-membership check
      undefined,                            // insert
    ]) as never);

    const res = await POST(makeReq("http://localhost/api/treatments", "POST", VALID), CTX);
    expect(res.status).toBe(201);
    const body = await responseJson(res);
    expect(body.treatment.description).toBe("Root Canal Treatment");
    expect(body.treatment.cost).toBe(5000);
  });

  it("DOCTOR: overrides doctorId to their own userId regardless of body", async () => {
    vi.mocked(getSession).mockResolvedValue(DOCTOR_SESSION); // userId = "u_doc"
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ isActive: 1 }],                  // member-active check (non-ADMIN)
      [{ patientId: "p1", isActive: 1 }],
      [{ userId: "u_doc" }],
      undefined,
    ]) as never);

    const res = await POST(makeReq("http://localhost/api/treatments", "POST", {
      ...VALID, doctorId: "u_someone_else",
    }), CTX);
    expect(res.status).toBe(201);
    // doctorId in response must be the session's userId, not the body's
    expect(( await responseJson(res) ).treatment.doctorId).toBe("u_doc");
  });

  it("returns 403 when patient is not linked to the org", async () => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [],   // empty → no patient-org link
    ]) as never);

    const res = await POST(makeReq("http://localhost/api/treatments", "POST", VALID), CTX);
    expect(res.status).toBe(403);
  });

  it("returns 400 when doctor is not an active org member", async () => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ patientId: "p1", isActive: 1 }],  // patient link OK
      [],                                   // doctor not in org
    ]) as never);

    const res = await POST(makeReq("http://localhost/api/treatments", "POST", VALID), CTX);
    expect(res.status).toBe(400);
    expect(( await responseJson(res) ).error).toMatch(/organization/i);
  });

  it("returns 400 for missing description", async () => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const res = await POST(makeReq("http://localhost/api/treatments", "POST", {
      patientId: "p1", doctorId: "u_doc", cost: 500,
    }), CTX);
    expect(res.status).toBe(400);
    expect(( await responseJson(res) ).error).toBe("Invalid input");
  });

  it("returns 400 for missing patientId", async () => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const res = await POST(makeReq("http://localhost/api/treatments", "POST", {
      doctorId: "u_doc", description: "Test",
    }), CTX);
    expect(res.status).toBe(400);
  });

  it("defaults cost to 0 when not provided", async () => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ patientId: "p1", isActive: 1 }],
      [{ userId: "u_doc" }],
      undefined,
    ]) as never);
    const res = await POST(makeReq("http://localhost/api/treatments", "POST", {
      patientId: "p1", doctorId: "u_doc", description: "Free checkup",
    }), CTX);
    expect(res.status).toBe(201);
    expect(( await responseJson(res) ).treatment.cost).toBe(0);
  });

  it("accepts optional procedure and toothNumbers", async () => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ patientId: "p1", isActive: 1 }],
      [{ userId: "u_doc" }],
      undefined,
    ]) as never);
    const res = await POST(makeReq("http://localhost/api/treatments", "POST", {
      ...VALID, procedure: "Root Canal Treatment", toothNumbers: "16,17",
    }), CTX);
    expect(res.status).toBe(201);
    const body = await responseJson(res);
    expect(body.treatment.procedure).toBe("Root Canal Treatment");
    expect(body.treatment.toothNumbers).toBe("16,17");
  });
});
