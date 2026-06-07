/**
 * Tests for lib/auth-edge.ts — JWT creation and verification.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  createToken,
  createOrgToken,
  verifyToken,
  verifyOrgToken,
  type JWTPayload,
  type OrgSessionPayload,
} from "@/lib/auth-edge";

const PRE_ORG_PAYLOAD: JWTPayload = {
  userId: "user-123",
  email: "test@example.com",
  name: "Test User",
};

const ORG_PAYLOAD: OrgSessionPayload = {
  userId: "user-123",
  email: "test@example.com",
  name: "Test User",
  orgId: "org-456",
  orgName: "Parkkal Dental",
  orgSlug: "parkkal",
  role: "admin",
  permissions: ["read:patients", "write:patients"],
};

beforeAll(() => {
  // Reset the cached secret so the new value is picked up
  process.env.JWT_SECRET = "test-secret-minimum-32-characters-ok";
});

describe("createToken + verifyToken (pre-org)", () => {
  it("round-trip returns correct payload", async () => {
    const token = await createToken(PRE_ORG_PAYLOAD);
    expect(typeof token).toBe("string");
    const result = await verifyToken(token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe(PRE_ORG_PAYLOAD.userId);
    expect(result!.email).toBe(PRE_ORG_PAYLOAD.email);
    expect(result!.name).toBe(PRE_ORG_PAYLOAD.name);
  });
});

describe("createOrgToken + verifyOrgToken", () => {
  it("round-trip returns correct payload", async () => {
    const token = await createOrgToken(ORG_PAYLOAD);
    expect(typeof token).toBe("string");
    const result = await verifyOrgToken(token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe(ORG_PAYLOAD.userId);
    expect(result!.orgId).toBe(ORG_PAYLOAD.orgId);
    expect(result!.orgSlug).toBe(ORG_PAYLOAD.orgSlug);
    expect(result!.role).toBe(ORG_PAYLOAD.role);
  });
});

describe("audience enforcement", () => {
  it("verifyToken rejects an org token (wrong audience)", async () => {
    const orgToken = await createOrgToken(ORG_PAYLOAD);
    const result = await verifyToken(orgToken);
    expect(result).toBeNull();
  });

  it("verifyOrgToken rejects a pre-org token (wrong audience)", async () => {
    const preOrgToken = await createToken(PRE_ORG_PAYLOAD);
    const result = await verifyOrgToken(preOrgToken);
    expect(result).toBeNull();
  });

  it("verifyOrgToken returns null for an invalid/tampered token", async () => {
    const result = await verifyOrgToken("this.is.not.a.valid.jwt");
    expect(result).toBeNull();
  });
});
