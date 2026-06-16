/**
 * Tests for PATCH/GET /api/appointments/[id]
 *
 * Regression coverage: the response must include patientName/doctorName
 * (joined from patients/users) even after a status change — previously the
 * PATCH handler did a bare `select()` with no join, so the calendar's quick
 * status actions (No Show, Cancelled, etc.) would silently replace a
 * patient's name with their raw patientId in the UI.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeDbMock, responseJson } from "@/lib/__tests__/helpers/db-mock";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getSession:     vi.fn(),
  isTokenRevoked: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/permissions", () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  PERMISSIONS: { APPOINTMENTS_VIEW: "appointments.view", APPOINTMENTS_EDIT: "appointments.edit" },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 }),
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    forRoute: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn(), debug: vi.fn() }),
  },
}));
vi.mock("@/lib/reminder-scheduler", () => ({
  rescheduleReminders: vi.fn().mockResolvedValue(undefined),
  cancelReminders:      vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/calendar-sync", () => ({
  syncAppointmentToCalendar:    vi.fn().mockResolvedValue(undefined),
  removeAppointmentFromCalendar: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/db/schema", () => ({
  appointments: { id: "id", organizationId: "orgId", patientId: "patientId", doctorId: "doctorId", appointmentDate: "ad", appointmentTime: "at", status: "status" },
  patients:     { id: "id", name: "name" },
  users:        { id: "id", name: "name" },
  visits:       { id: "id", appointmentId: "appointmentId", organizationId: "orgId" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(), and: vi.fn((...a: unknown[]) => a), notInArray: vi.fn(),
}));

import { getDb }      from "@/lib/db";
import { getSession } from "@/lib/auth";
import { GET, PATCH } from "@/app/api/appointments/[id]/route";

const ADMIN_SESSION = {
  userId: "u_admin", email: "a@p.com", name: "Admin",
  orgId: "org1", orgName: "Parkkal", orgSlug: "parkkal",
  role: "ADMIN", jti: "tok1", permissions: ["appointments.view", "appointments.edit"],
};

const ENRICHED_APPOINTMENT = {
  id: "a1", patientId: "p1", doctorId: "u_doc",
  appointmentDate: "2025-06-15", appointmentTime: "10:00",
  status: "NO_SHOW", type: "CONSULTATION", notes: null,
  createdAt: 1_700_000_000_000,
  patientName: "Ravi Kumar", doctorName: "Dr. Sharma",
};

function makeReq(method: string, body?: unknown): NextRequest {
  return new NextRequest("https://x.test/api/appointments/a1", {
    method, headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION as never);
});

describe("GET /api/appointments/[id]", () => {
  it("returns the joined patientName and doctorName", async () => {
    const db = makeDbMock([[ENRICHED_APPOINTMENT]]);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await GET(makeReq("GET"), { params: Promise.resolve({ id: "a1" }) });
    const body = await responseJson(res);

    expect(res.status).toBe(200);
    expect(body.appointment.patientName).toBe("Ravi Kumar");
    expect(body.appointment.doctorName).toBe("Dr. Sharma");
  });
});

describe("PATCH /api/appointments/[id]", () => {
  it("returns patientName and doctorName after a status change (e.g. No Show)", async () => {
    const db = makeDbMock([
      [{ id: "a1", patientId: "p1", doctorId: "u_doc", appointmentDate: "2025-06-15", appointmentTime: "10:00", status: "SCHEDULED" }], // existing-row lookup
      [],                          // update()
      [ENRICHED_APPOINTMENT],      // re-select with join
    ]);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await PATCH(makeReq("PATCH", { status: "NO_SHOW" }), { params: Promise.resolve({ id: "a1" }) });
    const body = await responseJson(res);

    expect(res.status).toBe(200);
    expect(body.appointment.status).toBe("NO_SHOW");
    expect(body.appointment.patientName).toBe("Ravi Kumar");
    expect(body.appointment.doctorName).toBe("Dr. Sharma");
  });

  it("returns patientName and doctorName after cancelling", async () => {
    const cancelled = { ...ENRICHED_APPOINTMENT, status: "CANCELLED" };
    const db = makeDbMock([
      [{ id: "a1", patientId: "p1", doctorId: "u_doc", appointmentDate: "2025-06-15", appointmentTime: "10:00", status: "SCHEDULED" }],
      [],
      [cancelled],
    ]);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await PATCH(makeReq("PATCH", { status: "CANCELLED" }), { params: Promise.resolve({ id: "a1" }) });
    const body = await responseJson(res);

    expect(res.status).toBe(200);
    expect(body.appointment.status).toBe("CANCELLED");
    expect(body.appointment.patientName).toBe("Ravi Kumar");
    expect(body.appointment.doctorName).toBe("Dr. Sharma");
  });
});
