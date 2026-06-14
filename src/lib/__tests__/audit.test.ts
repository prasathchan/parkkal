/**
 * Tests for lib/audit.ts — fire-and-forget audit log writer.
 *
 * Since D1 isn't available in tests, we mock getDb.
 * writeAuditLog returns void synchronously and dispatches writes async.
 * We flush the microtask queue with a small delay to verify no error surfaces.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock must be at the top level (Vitest hoists it before imports).
// The factory closes over `mockValues` so individual tests can swap the impl.
const mockValues = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    insert: () => ({ values: mockValues }),
  }),
}));

import { writeAuditLog } from "@/lib/audit";

// Flush microtasks so the inner async IIFE has time to run
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("writeAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues.mockResolvedValue(undefined); // reset to success for each test
  });

  it("returns synchronously without throwing when DB insert succeeds", async () => {
    expect(() =>
      writeAuditLog({
        organizationId: "org1",
        actorId: "u1",
        actorRole: "ADMIN",
        action: "MEMBER_INVITED",
        targetType: "member",
        targetId: "u2",
      })
    ).not.toThrow();
    await flush();
  });

  it("does not throw even when DB insert fails (fire-and-forget)", async () => {
    mockValues.mockRejectedValue(new Error("D1 error"));

    expect(() =>
      writeAuditLog({
        organizationId: "org1",
        actorId: "u1",
        actorRole: "ADMIN",
        action: "ROLE_DELETED",
        targetType: "role",
        targetId: "role1",
      })
    ).not.toThrow();
    await flush();
  });

  it("accepts all AuditAction values without type error", async () => {
    const actions = [
      "MEMBER_INVITED", "MEMBER_DEACTIVATED", "MEMBER_ROLE_CHANGED",
      "MEMBER_DELETED", "ROLE_CREATED", "ROLE_UPDATED", "ROLE_DELETED",
      "PATIENT_DELETED", "VISIT_DELETED",
    ] as const;

    for (const action of actions) {
      expect(() =>
        writeAuditLog({ organizationId: "o", actorId: "u", actorRole: "ADMIN", action, targetType: "x" })
      ).not.toThrow();
    }
    await flush();
  });
});
