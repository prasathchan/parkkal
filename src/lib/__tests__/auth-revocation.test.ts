/**
 * Tests for token revocation in auth-edge.ts
 *
 * Covers:
 *   - createOrgToken: jti is generated and unique per token
 *   - verifyOrgToken: jti is preserved in the decoded payload
 *   - revokeToken / isTokenRevoked: fail-open behaviour in test env (no D1)
 *   - Integration: withRoute rejects a revoked token (via mocked isTokenRevoked)
 *
 * NOTE: revokeToken / isTokenRevoked communicate via the D1 database.
 * In the test environment there is no D1 binding, so both functions
 * fail open (revokeToken is a no-op, isTokenRevoked returns false).
 * The correctness of the revocation check INSIDE withRoute() is covered
 * in api.test.ts where isTokenRevoked is fully mocked.
 */
import { describe, it, expect } from "vitest";
import { createOrgToken, verifyOrgToken, revokeToken, isTokenRevoked } from "@/lib/auth-edge";

const SAMPLE_PAYLOAD = {
  userId: "user_1",
  email: "admin@parkkal.com",
  name: "Admin",
  orgId: "org_1",
  orgName: "Parkkal Dental",
  orgSlug: "parkkal",
  role: "ADMIN",
  permissions: ["patients.view"],
};

// ─── jti generation in createOrgToken ────────────────────────────────────────

describe("createOrgToken — jti", () => {
  it("embeds a jti claim in the token", async () => {
    const token = await createOrgToken(SAMPLE_PAYLOAD);
    const payload = await verifyOrgToken(token);
    expect(payload?.jti).toBeDefined();
    expect(typeof payload?.jti).toBe("string");
    expect(payload!.jti!.length).toBeGreaterThan(10);
  });

  it("generates a unique jti for each token", async () => {
    const token1 = await createOrgToken(SAMPLE_PAYLOAD);
    const token2 = await createOrgToken(SAMPLE_PAYLOAD);
    const p1 = await verifyOrgToken(token1);
    const p2 = await verifyOrgToken(token2);
    expect(p1?.jti).not.toBe(p2?.jti);
    expect(p1?.jti).toBeDefined();
    expect(p2?.jti).toBeDefined();
  });

  it("preserves all other payload fields alongside jti", async () => {
    const token = await createOrgToken(SAMPLE_PAYLOAD);
    const payload = await verifyOrgToken(token);
    expect(payload?.userId).toBe(SAMPLE_PAYLOAD.userId);
    expect(payload?.orgId).toBe(SAMPLE_PAYLOAD.orgId);
    expect(payload?.role).toBe(SAMPLE_PAYLOAD.role);
    expect(payload?.permissions).toEqual(SAMPLE_PAYLOAD.permissions);
  });

  it("jti looks like a UUID (8-4-4-4-12 hex format)", async () => {
    const token = await createOrgToken(SAMPLE_PAYLOAD);
    const payload = await verifyOrgToken(token);
    expect(payload?.jti).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

// ─── fail-open behaviour without D1 ──────────────────────────────────────────

describe("revokeToken / isTokenRevoked — no D1 (test environment)", () => {
  it("revokeToken does not throw when D1 is unavailable", async () => {
    await expect(revokeToken("some-jti", Date.now() + 3600_000)).resolves.not.toThrow();
  });

  it("isTokenRevoked returns false (fail open) when D1 is unavailable", async () => {
    // In test env, getD1() returns null → isTokenRevoked fails open
    const result = await isTokenRevoked("any-jti-value");
    expect(result).toBe(false);
  });

  it("isTokenRevoked returns false even for a jti we just 'revoked' (no D1 persistence)", async () => {
    const jti = crypto.randomUUID();
    await revokeToken(jti, Date.now() + 3600_000); // no-op without D1
    const result = await isTokenRevoked(jti); // still false
    expect(result).toBe(false);
  });
});

// ─── withRoute integration: revocation check ─────────────────────────────────
// The actual "withRoute blocks a revoked token" behaviour is tested in api.test.ts
// because that test mocks isTokenRevoked directly, which is the correct unit test boundary.
// Here we just confirm the plumbing: jti from a minted token can be passed to revokeToken.

describe("jti end-to-end plumbing", () => {
  it("jti from a minted token can be passed to revokeToken without error", async () => {
    const token = await createOrgToken(SAMPLE_PAYLOAD);
    const payload = await verifyOrgToken(token);
    const jti = payload?.jti;
    expect(jti).toBeDefined();
    // revokeToken accepts the jti from a real token without throwing
    await expect(revokeToken(jti!, Date.now() + 24 * 3600_000)).resolves.not.toThrow();
  });
});
