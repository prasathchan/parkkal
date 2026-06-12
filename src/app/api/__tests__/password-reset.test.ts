/**
 * Tests for POST /api/auth/forgot-password and POST /api/auth/reset-password.
 *
 * Security properties under test:
 *   - forgot-password gives a UNIFORM response whether or not the email exists
 *     (no account enumeration)
 *   - reset-password rejects bad/expired codes with a generic error
 *   - rate limiting returns 429 with Retry-After
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeDbMock, responseJson, NO_ROW } from "@/lib/__tests__/helpers/db-mock";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60_000 }),
  getClientIp:    vi.fn().mockReturnValue("203.0.113.7"),
}));
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/otp", () => ({
  hashOTP:   vi.fn().mockResolvedValue("hashed-otp"),
  verifyOTP: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
}));
vi.mock("@/lib/logger", () => ({
  logger: { forRoute: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));
vi.mock("@/lib/utils", () => ({ generateId: vi.fn().mockReturnValue("tok_1") }));
vi.mock("@/db/schema", () => ({
  users:              { id: "id", email: "email", name: "name", isVerified: "isVerified", passwordHash: "ph", updatedAt: "ua" },
  verificationTokens: { id: "id", userId: "userId", type: "type", code: "code", expiresAt: "expiresAt", used: "used", createdAt: "createdAt" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(), and: vi.fn((...a: unknown[]) => a), gt: vi.fn(),
}));

import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";
import { verifyOTP } from "@/lib/otp";
import { POST as forgotPOST } from "@/app/api/auth/forgot-password/route";
import { POST as resetPOST }  from "@/app/api/auth/reset-password/route";

function makeReq(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60_000 });
  });

  it("returns the SAME 200 message for an unknown email (no enumeration)", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([NO_ROW]) as never); // user lookup → not found
    const res = await forgotPOST(makeReq("http://localhost/api/auth/forgot-password", { email: "nobody@x.com" }));
    expect(res.status).toBe(200);
    expect((await responseJson(res)).message).toMatch(/If that email/);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("returns the SAME 200 message and sends the email for a known verified user", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      { id: "u1", name: "Prasath", isVerified: 1 }, // user lookup
      undefined,                                     // invalidate old tokens (update)
      undefined,                                     // insert new token
    ]) as never);
    const res = await forgotPOST(makeReq("http://localhost/api/auth/forgot-password", { email: "real@x.com" }));
    expect(res.status).toBe(200);
    expect((await responseJson(res)).message).toMatch(/If that email/);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const code = vi.mocked(sendPasswordResetEmail).mock.calls[0][2];
    expect(code).toMatch(/^\d{6}$/);
  });

  it("does not send a reset email to an unverified account", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      { id: "u1", name: "P", isVerified: 0 },
    ]) as never);
    const res = await forgotPOST(makeReq("http://localhost/api/auth/forgot-password", { email: "unverified@x.com" }));
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30_000 });
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const res = await forgotPOST(makeReq("http://localhost/api/auth/forgot-password", { email: "x@x.com" }));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

describe("POST /api/auth/reset-password", () => {
  const GOOD_BODY = { email: "real@x.com", code: "123456", password: "NewPass123" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
    vi.mocked(verifyOTP).mockResolvedValue(true);
  });

  it("rejects a weak password (no number) with 400", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([]) as never);
    const res = await resetPOST(makeReq("http://localhost/api/auth/reset-password", { ...GOOD_BODY, password: "onlyletters" }));
    expect(res.status).toBe(400);
  });

  it("returns generic 400 when no valid token exists", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      { id: "u1" },  // user lookup
      NO_ROW,        // token lookup → none
    ]) as never);
    const res = await resetPOST(makeReq("http://localhost/api/auth/reset-password", GOOD_BODY));
    expect(res.status).toBe(400);
    expect((await responseJson(res)).error).toMatch(/Invalid or expired/);
  });

  it("returns generic 400 when the code does not match", async () => {
    vi.mocked(verifyOTP).mockResolvedValue(false);
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      { id: "u1" },
      { id: "t1", code: "stored-hash" },
    ]) as never);
    const res = await resetPOST(makeReq("http://localhost/api/auth/reset-password", GOOD_BODY));
    expect(res.status).toBe(400);
    expect((await responseJson(res)).error).toMatch(/Invalid or expired/);
  });

  it("updates the password and consumes the token on success", async () => {
    vi.mocked(getDb).mockReturnValue(makeDbMock([
      { id: "u1" },                  // user lookup
      { id: "t1", code: "hash" },    // token lookup
      undefined,                     // update users
      undefined,                     // update verification_tokens
    ]) as never);
    const res = await resetPOST(makeReq("http://localhost/api/auth/reset-password", GOOD_BODY));
    expect(res.status).toBe(200);
    expect((await responseJson(res)).message).toMatch(/reset successfully/);
  });
});
