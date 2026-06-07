/**
 * Tests for lib/rate-limit.ts (in-memory path)
 *
 * Since D1 is not available in the test environment, checkRateLimit
 * automatically falls back to the in-memory implementation.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

// The in-memory store is module-level; reset it between tests by re-importing
// or by letting the fake clock expire windows naturally.
describe("checkRateLimit (in-memory fallback)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first call", async () => {
    const key = `test:first:${Date.now()}`;
    const result = await checkRateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
  });

  it("stays allowed within the limit", async () => {
    const key = `test:within:${Date.now()}`;
    const config = { limit: 3, windowMs: 60_000 };
    await checkRateLimit(key, config);
    await checkRateLimit(key, config);
    const result = await checkRateLimit(key, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blocks after limit is exceeded", async () => {
    const key = `test:exceed:${Date.now()}`;
    const config = { limit: 3, windowMs: 60_000 };
    await checkRateLimit(key, config);
    await checkRateLimit(key, config);
    await checkRateLimit(key, config);
    const result = await checkRateLimit(key, config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    const key = `test:reset:${Date.now()}`;
    const config = { limit: 2, windowMs: 10_000 };
    await checkRateLimit(key, config);
    await checkRateLimit(key, config);
    // Both used — should be blocked
    const blocked = await checkRateLimit(key, config);
    expect(blocked.allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(11_000);

    // Should be allowed again after reset
    const reset = await checkRateLimit(key, config);
    expect(reset.allowed).toBe(true);
  });

  it("different keys do not interfere with each other", async () => {
    const config = { limit: 1, windowMs: 60_000 };
    const keyA = `test:key-a:${Date.now()}`;
    const keyB = `test:key-b:${Date.now()}`;

    // Exhaust key A
    await checkRateLimit(keyA, config);
    const blockedA = await checkRateLimit(keyA, config);
    expect(blockedA.allowed).toBe(false);

    // Key B should still be allowed
    const allowedB = await checkRateLimit(keyB, config);
    expect(allowedB.allowed).toBe(true);
  });
});
