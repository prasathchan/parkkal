/**
 * Tests for GET /api/appointments and POST /api/appointments
 *
 * Key business rules:
 *   - DOCTOR role sees only their own appointments (server-enforced)
 *   - DOCTOR role can only book appointments for themselves
 *   - Patient must be linked to the org → 400 if not
 *   - Double-booking triggers SLOT_TAKEN sentinel → 409
 *   - appointmentDate must be YYYY-MM-DD; appointmentTime must be HH:MM
 *
 * getDb() call order in withRoute:
 *   ADMIN:      no member-check → handler queries start at results[0]
 *   non-ADMIN:  member-check is results[0], handler starts at results[1]
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
    APPOINTMENTS_VIEW:   "appointments.view",
    APPOINTMENTS_CREATE: "appointments.create",
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
vi.mock("@/lib/utils", () => ({ generateId: vi.fn().mockReturnValue("appt_new") }));
vi.mock("@/db/schema", () => ({
  appointments:         { id: "id", organizationId: "orgId", patientId: "patientId", doctorId: "doctorId", appointmentDate: "ad", status: "status" },
  patients:             { id: "id", name: "name", patientCode: "pc" },
  users:                { id: "id", name: "name" },
  organizationPatients: { organizationId: "orgId", patientId: "patientId", isActive: "isActive" },
  organizationMembers:  { organizationId: "orgId", userId: "userId", isActive: "isActive" },
}));
vi.mock("drizzle-orm", () => ({
  like: vi.fn(), or: vi.fn(), and: vi.fn((...a: unknown[]) => a),
  desc: vi.fn(), count: vi.fn(() => "count"), eq: vi.fn(),
  gte: vi.fn(), lte: vi.fn(), ne: vi.fn(), asc: vi.fn(), inArray: vi.fn(), notInArray: vi.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { getDb }      from "@/lib/db";
import { getSession } from "@/lib/auth";
import { GET, POST }  from "@/app/api/appointments/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_SESSION = {
  userId: "u_admin", email: "a@p.com", name: "Admin",
  orgId: "org1", orgName: "Parkkal", orgSlug: "parkkal",
  role: "ADMIN", jti: "tok1", permissions: ["appointments.view", "appointments.create"],
};
const DOCTOR_SESSION = { ...ADMIN_SESSION, userId: "u_doc", role: "DOCTOR", jti: "tok2" };

const APPOINTMENT = {
  id: "a1", organizationId: "org1", patientId: "p1", doctorId: "u_doc",
  appointmentDate: "2025-06-15", appointmentTime: "10:00",
  type: "CONSULTATION", status: "SCHEDULED", notes: null,
  createdAt: 1_700_000_000_000,
  patientName: "Ravi Kumar", patientCode: "PKL-000001", doctorName: "Dr. Sharma",
};

const VALID_POST = {
  patientId: "p1", doctorId: "u_doc",
  appointmentDate: "2025-08-01", appointmentTime: "10:00",
  type: "CONSULTATION",
};

function makeReq(url: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(url, {
    method, headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const CTX = { params: Promise.resolve({}) };

// ─── GET /api/appointments ────────────────────────────────────────────────────

describe("GET /api/appointments", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns appointment list and total for ADMIN", async () => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ total: 1 }],
      [APPOINTMENT],
    ]) as never);

    const res = await GET(makeReq("http://localhost/api/appointments"), CTX);
    expect(res.status).toBe(200);
    const body = await responseJson(res);
    expect(body.total).toBe(1);
    expect(body.appointments).toHaveLength(1);
    expect(body.appointments[0].patientName).toBe("Ravi Kumar");
  });

  it("returns empty list when org has no appointments", async () => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([[{ total: 0 }], []]) as never);

    const body = await responseJson(await GET(makeReq("http://localhost/api/appointments"), CTX));
    expect(body.appointments).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("DOCTOR: uses server-enforced doctorId filter without error", async () => {
    vi.mocked(getSession).mockResolvedValue(DOCTOR_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ isActive: 1 }],    // member-active check
      [{ total: 0 }],
      [],
    ]) as never);

    const res = await GET(makeReq("http://localhost/api/appointments"), CTX);
    expect(res.status).toBe(200);
  });

  it("hasMore is true when results.length equals limit", async () => {
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
    // 3 total, offset=0, limit=2 → hasMore=true
    const twoAppts = [APPOINTMENT, { ...APPOINTMENT, id: "a2" }];
    vi.mocked(getDb).mockReturnValue(makeDbMock([[{ total: 3 }], twoAppts]) as never);

    const body = await responseJson(await GET(makeReq("http://localhost/api/appointments?limit=2&offset=0"), CTX));
    expect(body.hasMore).toBe(true);
  });
});

// ─── POST /api/appointments ───────────────────────────────────────────────────

describe("POST /api/appointments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION);
  });

  it("creates an appointment and returns 201", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ patientId: "p1", isActive: 1 }],  // patient-org check
      [],                                   // slot conflict check (no conflict)
      undefined,                            // insert
    ]) as never);

    const res = await POST(makeReq("http://localhost/api/appointments", "POST", VALID_POST), CTX);
    expect(res.status).toBe(201);
    expect(( await responseJson(res) ).appointment.patientId).toBe("p1");
  });

  it("DOCTOR: overrides doctorId to their own userId", async () => {
    vi.mocked(getSession).mockResolvedValue(DOCTOR_SESSION);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ isActive: 1 }],                  // member-active check
      [{ patientId: "p1", isActive: 1 }],
      [],                                  // slot conflict check (no conflict)
      undefined,
    ]) as never);

    const res = await POST(makeReq("http://localhost/api/appointments", "POST", {
      ...VALID_POST, doctorId: "u_admin",  // body says admin, but session is DOCTOR
    }), CTX);
    expect(res.status).toBe(201);
    expect(( await responseJson(res) ).appointment.doctorId).toBe("u_doc");
  });

  it("returns 409 when the slot is already taken (application-level check)", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ patientId: "p1", isActive: 1 }],  // patient-org check
      [{ id: "a_existing" }],               // slot conflict check → conflict found
    ]) as never);

    const res = await POST(makeReq("http://localhost/api/appointments", "POST", VALID_POST), CTX);
    expect(res.status).toBe(409);
    expect(( await responseJson(res) ).error).toMatch(/already has an appointment/i);
  });

  it("returns 409 when DB trigger fires SLOT_TAKEN (double-booking)", async () => {
    // Belt-and-suspenders: application check passes (race) but trigger still fires
    let callCount = 0;
    vi.mocked(getDb).mockReturnValue({
      select: () => ({
        from: () => ({
          where: async () => {
            callCount++;
            // call 1 = patient-org, call 2 = slot conflict (returns empty = no conflict)
            if (callCount === 1) return [{ patientId: "p1", isActive: 1 }];
            return [];
          },
        }),
      }),
      insert: () => ({
        values: async () => { throw new Error("SLOT_TAKEN: already booked"); },
      }),
    } as never);

    const res = await POST(makeReq("http://localhost/api/appointments", "POST", VALID_POST), CTX);
    expect(res.status).toBe(409);
    expect(( await responseJson(res) ).error).toMatch(/already has an appointment/i);
  });

  it("returns 400 for invalid appointmentDate format (must be YYYY-MM-DD)", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const res = await POST(makeReq("http://localhost/api/appointments", "POST", {
      ...VALID_POST, appointmentDate: "15-06-2025",
    }), CTX);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid appointmentTime format (must be HH:MM)", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const res = await POST(makeReq("http://localhost/api/appointments", "POST", {
      ...VALID_POST, appointmentTime: "10:00 AM",
    }), CTX);
    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown appointment type", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const res = await POST(makeReq("http://localhost/api/appointments", "POST", {
      ...VALID_POST, type: "SURGERY",
    }), CTX);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing patientId", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const { patientId: _pid, ...noPatient } = VALID_POST; // eslint-disable-line @typescript-eslint/no-unused-vars
    const res = await POST(makeReq("http://localhost/api/appointments", "POST", noPatient), CTX);
    expect(res.status).toBe(400);
  });

  it("returns 400 when patient is not linked to the org", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [],   // empty → no patient-org link
    ]) as never);

    const res = await POST(makeReq("http://localhost/api/appointments", "POST", VALID_POST), CTX);
    expect(res.status).toBe(400);
    expect(( await responseJson(res) ).error).toMatch(/organization/i);
  });

  it("accepts all valid appointment types", async () => {
    for (const type of ["CONSULTATION", "CHECKUP", "TREATMENT", "FOLLOWUP"]) {
      vi.mocked(getDb).mockReturnValue(makeDbMock([
        [{ patientId: "p1", isActive: 1 }],
        [],        // slot conflict check (no conflict)
        undefined,
      ]) as never);
      const res = await POST(makeReq("http://localhost/api/appointments", "POST", {
        ...VALID_POST, type,
      }), CTX);
      expect(res.status).toBe(201);
    }
  });
});
