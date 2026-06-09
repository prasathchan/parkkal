/**
 * Tests for GET /api/visits/[id]/payments and POST /api/visits/[id]/payments
 *
 * POST DB query order (ADMIN, no treatmentId):
 *   results[0]: SELECT visit by id+orgId  → [{ id, status, totalAmount, paidAmount, patientId }]
 *   results[1]: INSERT payment             → undefined
 *   results[2]: UPDATE visits paidAmount   → undefined
 *
 * POST with treatmentId:
 *   results[0]: SELECT visit
 *   results[1]: SELECT visitTreatments link
 *   results[2]: INSERT payment
 *   results[3]: UPDATE visits paidAmount
 *
 * GET DB query order (ADMIN):
 *   results[0]: SELECT visit orgId check  → [{ organizationId: "org1" }]
 *   results[1]: SELECT payments JOIN treatments → [...]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeDbMock } from "@/lib/__tests__/helpers/db-mock";

// ── Module-level mocks ──────────────────────────────────────────────────────

vi.mock("@/lib/db",         () => ({ getDb: vi.fn() }));
vi.mock("@/lib/auth",       () => ({ getSession: vi.fn(), isTokenRevoked: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/permissions",() => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  PERMISSIONS: { BILLING_VIEW: "billing.view", BILLING_CREATE: "billing.create" },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99, resetAt: 0 }),
}));
vi.mock("@/lib/logger",     () => ({
  logger: { forRoute: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn(), debug: vi.fn() }) },
}));
vi.mock("@/lib/app-logger", () => ({ writeAppLog: vi.fn() }));
vi.mock("@/db/schema",      () => ({
  visits:         { id: "id", organizationId: "orgId", status: "status",
                    totalAmount: "totalAmount", paidAmount: "paidAmount", patientId: "patientId",
                    updatedAt: "updatedAt" },
  payments:       { id: "id", visitId: "visitId", patientId: "patientId", treatmentId: "treatmentId",
                    amount: "amount", paymentMethod: "paymentMethod", referenceNumber: "refNum",
                    notes: "notes", paidAt: "paidAt", recordedBy: "recordedBy" },
  treatments:     { id: "id", description: "description" },
  visitTreatments:{ visitId: "visitId", treatmentId: "treatmentId" },
  organizationMembers: { organizationId: "orgId", userId: "userId", isActive: "isActive" },
}));
vi.mock("drizzle-orm", () => ({
  eq:  vi.fn(), and: vi.fn((...a: unknown[]) => a), sql: vi.fn(),
  desc: vi.fn(), asc: vi.fn(), gte: vi.fn(), lte: vi.fn(),
}));

import { getDb }      from "@/lib/db";
import { getSession } from "@/lib/auth";

// ── Fixtures ────────────────────────────────────────────────────────────────

const ADMIN_SESSION = {
  userId: "u_admin", orgId: "org1", role: "ADMIN",
  jti: "jti_admin", email: "admin@test.com", name: "Admin",
};

const OPEN_VISIT = {
  id: "v1", organizationId: "org1", patientId: "p1",
  status: "OPEN", totalAmount: 1000, paidAmount: 0,
};

const SAMPLE_PAYMENT = {
  id: "pay1", visitId: "v1", patientId: "p1", treatmentId: null,
  amount: 500, paymentMethod: "CASH", referenceNumber: null,
  notes: null, paidAt: 1000000, recordedBy: "u_admin",
  treatmentDescription: null,
};

function makeReq(visitId: string, body: object) {
  return new NextRequest(`http://localhost/api/visits/${visitId}/payments`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetReq(visitId: string) {
  return new NextRequest(`http://localhost/api/visits/${visitId}/payments`);
}

// ── GET payments ────────────────────────────────────────────────────────────

describe("GET /api/visits/[id]/payments", () => {
  beforeEach(() => vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION as never));

  it("returns payments for a valid visit", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ organizationId: "org1" }],   // visit org check
      [SAMPLE_PAYMENT],               // payment rows
    ]) as never);
    const { GET } = await import("@/app/api/visits/[id]/payments/route");
    const res = await GET(makeGetReq("v1"), { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payments).toHaveLength(1);
    expect(body.payments[0].amount).toBe(500);
  });

  it("returns 404 when visit not found or wrong org", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [],   // visit not found
    ]) as never);
    const { GET } = await import("@/app/api/visits/[id]/payments/route");
    const res = await GET(makeGetReq("v_missing"), { params: Promise.resolve({ id: "v_missing" }) });
    expect(res.status).toBe(404);
  });

  it("returns empty payments array when no payments recorded", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ organizationId: "org1" }],
      [],
    ]) as never);
    const { GET } = await import("@/app/api/visits/[id]/payments/route");
    const res = await GET(makeGetReq("v1"), { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(200);
    expect((await res.json()).payments).toHaveLength(0);
  });
});

// ── POST payments ───────────────────────────────────────────────────────────

describe("POST /api/visits/[id]/payments", () => {
  beforeEach(() => vi.mocked(getSession).mockResolvedValue(ADMIN_SESSION as never));

  it("records a cash payment and returns 201", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [OPEN_VISIT],     // visit fetch
      undefined,        // INSERT payment
      undefined,        // UPDATE visits.paidAmount
    ]) as never);
    const { POST } = await import("@/app/api/visits/[id]/payments/route");
    const res = await POST(makeReq("v1", { amount: 500, paymentMethod: "CASH" }), { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.payment.amount).toBe(500);
    expect(body.payment.paymentMethod).toBe("CASH");
  });

  it("returns 400 for amount = 0", async () => {
    const { POST } = await import("@/app/api/visits/[id]/payments/route");
    const res = await POST(makeReq("v1", { amount: 0, paymentMethod: "CASH" }), { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative amount", async () => {
    const { POST } = await import("@/app/api/visits/[id]/payments/route");
    const res = await POST(makeReq("v1", { amount: -100, paymentMethod: "CASH" }), { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid payment method", async () => {
    const { POST } = await import("@/app/api/visits/[id]/payments/route");
    const res = await POST(makeReq("v1", { amount: 100, paymentMethod: "CRYPTO" }), { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when visit not found", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [],   // visit not found
    ]) as never);
    const { POST } = await import("@/app/api/visits/[id]/payments/route");
    const res = await POST(makeReq("v_missing", { amount: 100, paymentMethod: "CASH" }), { params: Promise.resolve({ id: "v_missing" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 for cancelled visit", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ ...OPEN_VISIT, status: "CANCELLED" }],
    ]) as never);
    const { POST } = await import("@/app/api/visits/[id]/payments/route");
    const res = await POST(makeReq("v1", { amount: 100, paymentMethod: "CASH" }), { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cancelled/i);
  });

  it("returns 400 when visit is already fully paid", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ ...OPEN_VISIT, totalAmount: 500, paidAmount: 500 }],
    ]) as never);
    const { POST } = await import("@/app/api/visits/[id]/payments/route");
    const res = await POST(makeReq("v1", { amount: 1, paymentMethod: "UPI" }), { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/fully paid/i);
  });

  it("returns 400 when payment exceeds balance due", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [{ ...OPEN_VISIT, totalAmount: 500, paidAmount: 200 }],
    ]) as never);
    const { POST } = await import("@/app/api/visits/[id]/payments/route");
    // Due = 300, trying to pay 400 → should reject
    const res = await POST(makeReq("v1", { amount: 400, paymentMethod: "CARD" }), { params: Promise.resolve({ id: "v1" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/exceeds balance/i);
  });

  it("returns 422 when treatmentId is not linked to this visit", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [OPEN_VISIT],
      [],              // visitTreatments link → not found
    ]) as never);
    const { POST } = await import("@/app/api/visits/[id]/payments/route");
    const res = await POST(
      makeReq("v1", { amount: 100, paymentMethod: "CASH", treatmentId: "tx_unlinked" }),
      { params: Promise.resolve({ id: "v1" }) }
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/not linked/i);
  });

  it("accepts UPI with referenceNumber", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      [OPEN_VISIT],
      undefined,
      undefined,
    ]) as never);
    const { POST } = await import("@/app/api/visits/[id]/payments/route");
    const res = await POST(
      makeReq("v1", { amount: 200, paymentMethod: "UPI", referenceNumber: "UPI123456" }),
      { params: Promise.resolve({ id: "v1" }) }
    );
    expect(res.status).toBe(201);
    expect((await res.json()).payment.referenceNumber).toBe("UPI123456");
  });

  it("all four payment methods are accepted", async () => {
    const methods = ["CASH", "CARD", "UPI", "BANK_TRANSFER"] as const;
    const { POST } = await import("@/app/api/visits/[id]/payments/route");
    for (const method of methods) {
      vi.mocked(getDb).mockReturnValue(makeDbMock([
        [OPEN_VISIT], undefined, undefined,
      ]) as never);
      const res = await POST(makeReq("v1", { amount: 100, paymentMethod: method }), { params: Promise.resolve({ id: "v1" }) });
      expect(res.status, `Expected 201 for ${method}`).toBe(201);
    }
  });
});
