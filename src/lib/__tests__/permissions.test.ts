import { describe, it, expect, vi, beforeEach } from "vitest";
import { coarseRoleHasPermission, hasPermission, PERMISSIONS } from "@/lib/permissions";

// Mock the DB so hasPermission's slow path doesn't need a real database.
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: async () => [],
      }),
    }),
  }),
}));

describe("coarseRoleHasPermission", () => {
  it("ADMIN has all permissions", () => {
    for (const perm of Object.values(PERMISSIONS)) {
      expect(coarseRoleHasPermission("ADMIN", perm)).toBe(true);
    }
  });

  it("DOCTOR can view and create visits", () => {
    expect(coarseRoleHasPermission("DOCTOR", PERMISSIONS.VISITS_VIEW)).toBe(true);
    expect(coarseRoleHasPermission("DOCTOR", PERMISSIONS.VISITS_CREATE)).toBe(true);
  });

  it("DOCTOR cannot manage staff", () => {
    expect(coarseRoleHasPermission("DOCTOR", PERMISSIONS.STAFF_MANAGE)).toBe(false);
  });

  it("RECEPTIONIST can create billing", () => {
    expect(coarseRoleHasPermission("RECEPTIONIST", PERMISSIONS.BILLING_CREATE)).toBe(true);
  });

  it("NURSE cannot create billing", () => {
    expect(coarseRoleHasPermission("NURSE", PERMISSIONS.BILLING_CREATE)).toBe(false);
  });

  it("HELPER has no permissions", () => {
    for (const perm of Object.values(PERMISSIONS)) {
      expect(coarseRoleHasPermission("HELPER", perm)).toBe(false);
    }
  });

  it("unknown role has no permissions", () => {
    expect(coarseRoleHasPermission("GHOST", PERMISSIONS.VISITS_VIEW)).toBe(false);
  });
});

describe("hasPermission — fast path (JWT-embedded permissions)", () => {
  it("ADMIN always returns true without checking permissions array", async () => {
    const session = { role: "ADMIN", permissions: [] };
    expect(await hasPermission(session, PERMISSIONS.BILLING_CREATE)).toBe(true);
  });

  it("returns true when permission is in embedded array", async () => {
    const session = { role: "DOCTOR", permissions: ["billing.view", "visits.create"] };
    expect(await hasPermission(session, PERMISSIONS.BILLING_VIEW)).toBe(true);
    expect(await hasPermission(session, PERMISSIONS.VISITS_CREATE)).toBe(true);
  });

  it("returns false when permission is NOT in embedded array", async () => {
    const session = { role: "RECEPTIONIST", permissions: ["billing.view"] };
    expect(await hasPermission(session, PERMISSIONS.BILLING_CREATE)).toBe(false);
  });

  it("empty permissions array denies everything (non-ADMIN)", async () => {
    const session = { role: "NURSE", permissions: [] };
    expect(await hasPermission(session, PERMISSIONS.VISITS_VIEW)).toBe(false);
  });
});

describe("hasPermission — slow path (no embedded permissions — legacy token)", () => {
  it("falls back to coarse role when permissions is null and orgRoleId is null", async () => {
    const session = { role: "RECEPTIONIST", orgRoleId: null, permissions: null };
    expect(await hasPermission(session, PERMISSIONS.BILLING_CREATE)).toBe(true);
  });

  it("falls back to coarse role when permissions is undefined and orgRoleId is null", async () => {
    const session = { role: "NURSE", orgRoleId: null };
    expect(await hasPermission(session, PERMISSIONS.BILLING_CREATE)).toBe(false);
  });

  it("queries DB when orgRoleId is set but permissions absent; returns coarse fallback when DB returns nothing", async () => {
    // DB mock returns [] (no row), so falls back to coarse role
    const session = { role: "RECEPTIONIST", orgRoleId: "role_xyz", permissions: null };
    expect(await hasPermission(session, PERMISSIONS.BILLING_CREATE)).toBe(true);
  });
});
