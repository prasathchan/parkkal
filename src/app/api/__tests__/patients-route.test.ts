/**
 * Tests for GET /api/patients and POST /api/patients
 *
 * Key insight about getDb() call ordering in withRoute():
 *   - ADMIN role: member-active check is SKIPPED → getDb() called once (handler only)
 *   - Non-ADMIN:  member-active check runs first → results[0] = [{ isActive: 1 }]
 *                 then handler queries start at results[1]
 *
 * Build your makeDbMock([]) results array accordingly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeDbMock, responseJson } from "@/lib/__tests__/helpers/db-mock";

// ─── Module-level mocks (hoisted by Vitest) ───────────────────────────────────

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getSession:     vi.fn(),
  isTokenRevoked: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/permissions", () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  PERMISSIONS: {
    PATIENTS_VIEW:   "patients.view",
    PATIENTS_CREATE: "patients.create",
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
vi.mock("@/lib/encryption", () => ({
  encryptField: vi.fn().mockResolvedValue("encrypted"),
}));
vi.mock("@/lib/utils", () => ({
  generateId:  vi.fn().mockReturnValue("new_patient_id"),
  escapeLike:  vi.fn((v: string) => (v ?? "").replace(/%/g, "\\%").replace(/_/g, "\\_")),
}));
vi.mock("@/db/schema", () => ({
  patients:             { id: "id", name: "name", phone: "phone", patientCode: "pc", createdAt: "ca" },
  organizationPatients: { organizationId: "orgId", patientId: "patientId", isActive: "isActive" },
  emergencyContacts:    { id: "id", entityType: "et", entityId: "eid" },
  organizationMembers:  { organizationId: "orgId", userId: "userId", isActive: "isActive" },
}));
vi.mock("drizzle-orm", () => ({
  like: vi.fn(), or: vi.fn(), and: vi.fn((...a: unknown[]) => a),
  desc: vi.fn(), count: vi.fn(() => "count"), eq: vi.fn(),
  gte: vi.fn(), lte: vi.fn(), ne: vi.fn(), asc: vi.fn(), inArray: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { getDb }      from "@/lib/db";
import { getSession } from "@/lib/auth";
import { GET, POST }  from "@/app/api/patients/route";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const ADMIN_SESSION = {
  userId: "u1", email: "a@p.com", name: "Admin",
  orgId: "org1", orgName: "Parkkal", orgSlug: "parkkal",
  role: "ADMIN", jti: "tok1",
  permissions: ["patients.view", "patients.create"],
};

// SAMPLE_PATIENT has panNumber/aadhaarNumber to verify they get masked
const SAMPLE_PATIENT = {
  id: "p1", patientCode: "PKL-000001", name: "Ravi Kumar",
  phone: "9876543210", email: "ravi@example.com",
  dateOfBirth: "1985-06-15", gender: "MALE", bloodGroup: "O+",
  emergencyContactAdded: 0, createdAt: 1_700_000_000_000,
  panNumber: "ABCDE1234F", aadhaarNumber: "999900001111",
};

function makeReq(url: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const CTX = { params: Promise.resolve({}) };

// ─── GET /api/patients ────────────────────────────────────────────────────────

describe("GET /api/patients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
  });

  it("returns 200 with patient list and total", async () => {
    // ADMIN: no member-check query → results[0] = count, results[1] = list
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ total: 1 }],
      [SAMPLE_PATIENT],
    ]) as never);

    const res = await GET(makeReq("http://localhost/api/patients"), CTX);
    expect(res.status).toBe(200);
    const body = await responseJson(res);
    expect(body.total).toBe(1);
    expect(body.patients).toHaveLength(1);
    expect(body.patients[0].name).toBe("Ravi Kumar");
  });

  it("masks panNumber and aadhaarNumber to null in list response", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ total: 1 }],
      [SAMPLE_PATIENT],
    ]) as never);

    const res = await GET(makeReq("http://localhost/api/patients"), CTX);
    const body = await responseJson(res);
    expect(body.patients[0].panNumber).toBeNull();
    expect(body.patients[0].aadhaarNumber).toBeNull();
  });

  it("returns empty list when no patients exist", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ total: 0 }],
      [],
    ]) as never);

    const res = await GET(makeReq("http://localhost/api/patients"), CTX);
    const body = await responseJson(res);
    expect(body.total).toBe(0);
    expect(body.patients).toHaveLength(0);
  });

  it("clamps limit to 100 even when query param exceeds it", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([[{ total: 0 }], []]) as never);
    const res = await GET(makeReq("http://localhost/api/patients?limit=9999"), CTX);
    expect(res.status).toBe(200);
  });

  it("returns pagination metadata (limit, offset)", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ total: 50 }],
      [SAMPLE_PATIENT],
    ]) as never);

    const res = await GET(makeReq("http://localhost/api/patients?limit=10&offset=20"), CTX);
    const body = await responseJson(res);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(20);
  });
});

// ─── POST /api/patients ───────────────────────────────────────────────────────

describe("POST /api/patients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
  });

  const VALID_BODY = {
    name: "Sunita Devi",
    phone: "9123456789",
    email: "sunita@example.com",
    gender: "FEMALE",
  };

  it("creates a patient and returns 201", async () => {
    // ADMIN: handler queries = org count → total count → insert → insert org link
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ orgCount: 5 }],
      [{ totalCount: 10 }],
      undefined,   // insert patients
      undefined,   // insert organizationPatients
    ]) as never);

    const res = await POST(makeReq("http://localhost/api/patients", "POST", VALID_BODY), CTX);
    expect(res.status).toBe(201);
    const body = await responseJson(res);
    expect(body.patient.name).toBe("Sunita Devi");
    expect(body.patient.patientCode).toMatch(/^PKL-/);
  });

  it("returns 400 when name is missing", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const res = await POST(makeReq("http://localhost/api/patients", "POST", { phone: "9999900000" }), CTX);
    expect(res.status).toBe(400);
    expect(( await responseJson(res) ).error).toBe("Invalid input");
  });

  it("returns 400 when phone is missing", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const res = await POST(makeReq("http://localhost/api/patients", "POST", { name: "Test" }), CTX);
    expect(res.status).toBe(400);
  });

  it("returns 400 for phone with fewer than 10 digits", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const res = await POST(makeReq("http://localhost/api/patients", "POST", { name: "Test", phone: "123" }), CTX);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email format", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const res = await POST(makeReq("http://localhost/api/patients", "POST", {
      name: "Test", phone: "9999900000", email: "not-an-email",
    }), CTX);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid blood group", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const res = await POST(makeReq("http://localhost/api/patients", "POST", {
      ...VALID_BODY, bloodGroup: "Z+",
    }), CTX);
    expect(res.status).toBe(400);
  });

  it("accepts all 8 valid blood group values", async () => {
    for (const bg of ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]) {
      vi.mocked(getDb).mockReturnValue(makeDbMock([
        [{ orgCount: 0 }], [{ totalCount: 0 }], undefined, undefined,
      ]) as never);
      const res = await POST(makeReq("http://localhost/api/patients", "POST", {
        ...VALID_BODY, bloodGroup: bg,
      }), CTX);
      expect(res.status).toBe(201);
    }
  });
});
