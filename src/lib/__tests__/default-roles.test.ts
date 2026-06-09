/**
 * Tests for src/lib/default-roles.ts
 *
 * Covers: DEFAULT_ROLES shape, ALL_PERMISSIONS completeness, role permission logic
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_ROLES, ALL_PERMISSIONS } from "@/lib/default-roles";
import { PERMISSIONS } from "@/lib/permissions";

describe("ALL_PERMISSIONS", () => {
  it("contains every permission defined in PERMISSIONS constant", () => {
    const permValues = Object.values(PERMISSIONS);
    for (const perm of permValues) {
      expect(ALL_PERMISSIONS).toContain(perm);
    }
  });

  it("has no duplicates", () => {
    const unique = new Set(ALL_PERMISSIONS);
    expect(unique.size).toBe(ALL_PERMISSIONS.length);
  });
});

describe("DEFAULT_ROLES", () => {
  it("has exactly 5 roles", () => {
    expect(DEFAULT_ROLES).toHaveLength(5);
  });

  it("every role has a name, slug, color, description, and permissions array", () => {
    for (const role of DEFAULT_ROLES) {
      expect(typeof role.name).toBe("string");
      expect(typeof role.slug).toBe("string");
      expect(role.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(typeof role.description).toBe("string");
      expect(Array.isArray(role.permissions)).toBe(true);
    }
  });

  it("Administrator has all permissions", () => {
    const admin = DEFAULT_ROLES.find((r) => r.slug === "administrator");
    expect(admin).toBeDefined();
    for (const perm of ALL_PERMISSIONS) {
      expect(admin!.permissions).toContain(perm);
    }
  });

  it("Doctor can create visits and treatments", () => {
    const doctor = DEFAULT_ROLES.find((r) => r.slug === "doctor");
    expect(doctor!.permissions).toContain("visits.create");
    expect(doctor!.permissions).toContain("treatments.create");
  });

  it("Doctor cannot manage staff", () => {
    const doctor = DEFAULT_ROLES.find((r) => r.slug === "doctor");
    expect(doctor!.permissions).not.toContain("staff.manage");
  });

  it("Receptionist can create billing but not delete patients", () => {
    const rec = DEFAULT_ROLES.find((r) => r.slug === "receptionist");
    expect(rec!.permissions).toContain("billing.create");
    expect(rec!.permissions).not.toContain("patients.delete");
  });

  it("Nurse cannot create billing", () => {
    const nurse = DEFAULT_ROLES.find((r) => r.slug === "nurse");
    expect(nurse!.permissions).not.toContain("billing.create");
  });

  it("Attendant has only view permissions", () => {
    const attendant = DEFAULT_ROLES.find((r) => r.slug === "attendant");
    for (const perm of attendant!.permissions) {
      expect(perm).toContain(".view");
    }
  });

  it("all roles' permissions are valid (in ALL_PERMISSIONS)", () => {
    for (const role of DEFAULT_ROLES) {
      for (const perm of role.permissions) {
        expect(ALL_PERMISSIONS).toContain(perm);
      }
    }
  });

  it("slugs are unique", () => {
    const slugs = DEFAULT_ROLES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
