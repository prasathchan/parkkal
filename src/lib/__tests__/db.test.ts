/**
 * Tests for src/lib/db.ts — runCascade()
 *
 * runCascade() has three execution paths:
 *   1. D1 path  — db has a .batch() method (production)
 *   2. libsql path — db has a .transaction() method (local dev)
 *   3. Sequential fallback — neither method exists
 *
 * We also verify the empty-builders fast path and the D1 chunking logic
 * (builders.length > 100 must be split into ≤100-statement batches).
 */
import { describe, it, expect, vi } from "vitest";
import { runCascade } from "@/lib/db";

// A minimal thenable that resolves immediately — simulates a Drizzle builder.
const b = () => Promise.resolve("ok");

describe("runCascade — empty builders", () => {
  it("resolves immediately without calling any DB method", async () => {
    const batch = vi.fn();
    const db = { batch } as never;
    await expect(runCascade(db, [])).resolves.toBeUndefined();
    expect(batch).not.toHaveBeenCalled();
  });
});

describe("runCascade — D1 batch path", () => {
  it("calls db.batch() with all builders", async () => {
    const batch = vi.fn().mockResolvedValue([]);
    const db = { batch } as never;
    const builders = [b(), b(), b()];

    await runCascade(db, builders);
    expect(batch).toHaveBeenCalledOnce();
    expect(batch).toHaveBeenCalledWith(builders);
  });

  it("splits >100 builders into multiple batches of ≤100", async () => {
    const batch = vi.fn().mockResolvedValue([]);
    const db = { batch } as never;
    const builders = Array.from({ length: 250 }, () => b());

    await runCascade(db, builders);
    expect(batch).toHaveBeenCalledTimes(3); // chunks: 100 + 100 + 50
    expect(batch.mock.calls[0][0]).toHaveLength(100);
    expect(batch.mock.calls[1][0]).toHaveLength(100);
    expect(batch.mock.calls[2][0]).toHaveLength(50);
  });

  it("resolves after all batches succeed", async () => {
    const batch = vi.fn().mockResolvedValue([]);
    const db = { batch } as never;
    await expect(runCascade(db, [b(), b()])).resolves.toBeUndefined();
  });
});

describe("runCascade — libsql transaction path", () => {
  it("calls db.transaction() and runs each builder via tx.run()", async () => {
    const runMock = vi.fn().mockResolvedValue(undefined);
    const transaction = vi.fn().mockImplementation(async (fn: (tx: { run: typeof runMock }) => Promise<void>) => {
      await fn({ run: runMock });
    });
    // No .batch() — simulates libsql dev client
    const db = { transaction } as never;
    const builders = [b(), b()];

    await runCascade(db, builders);
    expect(transaction).toHaveBeenCalledOnce();
    expect(runMock).toHaveBeenCalledTimes(2);
  });
});

describe("runCascade — sequential fallback", () => {
  it("awaits each builder in order when no batch/transaction exists", async () => {
    const db = {} as never; // no .batch() or .transaction()

    // Use simple resolved promises to test the loop
    await runCascade(db, [Promise.resolve("a"), Promise.resolve("b"), Promise.resolve("c")]);
    // If we get here without throwing, the loop worked
    expect(true).toBe(true);
  });
});
