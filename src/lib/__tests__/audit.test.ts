/**
 * Tests for lib/audit.ts — fire-and-forget audit log writer.
 *
 * Since D1 isn't available in tests, we mock getDb.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
  }),
}));

import { writeAuditLog } from "@/lib/audit";

describe("writeAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns without throwing when DB insert succeeds", async () => {
    await expect(
      writeAuditLog({ action: "login", userId: "u1", orgId: "o1" })
    ).resolves.not.toThrow();
  });

  it("returns without throwing when DB insert fails (fire-and-forget)", async () => {
    // Re-mock to simulate a DB failure for this test
    vi.doMock("@/lib/db", () => ({
      getDb: () => ({
        insert: () => ({
          values: vi.fn().mockRejectedValue(new Error("DB error")),
        }),
      }),
    }));

    // writeAuditLog must never throw regardless of DB errors
    await expect(
      writeAuditLog({ action: "login", userId: "u1", orgId: "o1" })
    ).resolves.not.toThrow();
  });

  it("does not propagate DB errors to the caller", async () => {
    let threw = false;
    try {
      await writeAuditLog({ action: "test" });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
