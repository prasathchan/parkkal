/**
 * Tests for src/lib/utils.ts
 *
 * Covers: formatCurrency, formatDate, calculateAge, generatePatientCode,
 *         formatDoctorName, formatBytes, escapeLike
 */
import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  calculateAge,
  generatePatientCode,
  formatDoctorName,
  formatBytes,
  escapeLike,
} from "@/lib/utils";

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats whole rupee amounts", () => {
    expect(formatCurrency(1500)).toContain("1,500");
  });

  it("includes the ₹ symbol", () => {
    expect(formatCurrency(100)).toContain("₹");
  });

  it("formats zero correctly", () => {
    expect(formatCurrency(0)).toContain("0");
  });

  it("formats large amounts with commas (Indian numbering)", () => {
    // Indian format: 1,00,000 for 100000
    const result = formatCurrency(100000);
    expect(result).toContain("1,00,000");
  });

  it("has no decimal places (maximumFractionDigits: 0)", () => {
    const result = formatCurrency(1500.75);
    expect(result).not.toContain(".");
  });
});

// ─── calculateAge ─────────────────────────────────────────────────────────────

describe("calculateAge", () => {
  it("calculates a simple age correctly", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 30);
    const dateStr = dob.toISOString().split("T")[0];
    expect(calculateAge(dateStr)).toBe(30);
  });

  it("returns 0 for a newborn (today's date)", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(calculateAge(today)).toBe(0);
  });

  it("correctly handles birthday that hasn't happened yet this year (decrements by 1)", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() - 25);
    // Push the birthday one day into the future to simulate "not had birthday yet"
    future.setDate(future.getDate() + 1);
    const dateStr = future.toISOString().split("T")[0];
    expect(calculateAge(dateStr)).toBe(24);
  });
});

// ─── generatePatientCode ──────────────────────────────────────────────────────

describe("generatePatientCode", () => {
  it("formats with PKL- prefix and 6-digit zero-padded number", () => {
    expect(generatePatientCode(1)).toBe("PKL-000001");
    expect(generatePatientCode(42)).toBe("PKL-000042");
    expect(generatePatientCode(999999)).toBe("PKL-999999");
  });

  it("handles 0 as edge case", () => {
    expect(generatePatientCode(0)).toBe("PKL-000000");
  });
});

// ─── formatDoctorName ─────────────────────────────────────────────────────────

describe("formatDoctorName", () => {
  it("adds Dr. prefix to a plain name", () => {
    expect(formatDoctorName("Ravi Kumar")).toBe("Dr. Ravi Kumar");
  });

  it("does not double-prefix a name that already starts with Dr.", () => {
    expect(formatDoctorName("Dr. Ravi Kumar")).toBe("Dr. Ravi Kumar");
  });

  it("does not double-prefix a name starting with Dr (no dot)", () => {
    expect(formatDoctorName("Dr Ravi Kumar")).toBe("Dr. Ravi Kumar");
  });

  it("returns em-dash for null", () => {
    expect(formatDoctorName(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(formatDoctorName(undefined)).toBe("—");
  });

  it("returns em-dash for empty string", () => {
    expect(formatDoctorName("")).toBe("—");
  });
});

// ─── formatBytes ─────────────────────────────────────────────────────────────

describe("formatBytes", () => {
  it("formats bytes under 1 KB as '... B'", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("formats bytes between 1 KB and 1 MB as '... KB'", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024 - 1)).toContain("KB");
  });

  it("formats bytes 1 MB and above as '... MB'", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });

  it("rounds to 1 decimal place", () => {
    // 1500 bytes = 1500/1024 ≈ 1.464... KB → rounds to 1.5
    expect(formatBytes(1500)).toBe("1.5 KB");
  });
});

// ─── escapeLike ──────────────────────────────────────────────────────────────

describe("escapeLike", () => {
  it("escapes % wildcard", () => {
    expect(escapeLike("50%")).toBe("50\\%");
  });

  it("escapes _ wildcard", () => {
    expect(escapeLike("user_name")).toBe("user\\_name");
  });

  it("escapes backslash", () => {
    expect(escapeLike("path\\to")).toBe("path\\\\to");
  });

  it("escapes multiple special characters", () => {
    expect(escapeLike("100%_off\\deal")).toBe("100\\%\\_off\\\\deal");
  });

  it("returns null for null input", () => {
    expect(escapeLike(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(escapeLike(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(escapeLike("")).toBeNull();
  });

  it("passes through safe strings unchanged", () => {
    expect(escapeLike("Dr. Ravi Kumar")).toBe("Dr. Ravi Kumar");
    expect(escapeLike("PKL-000042")).toBe("PKL-000042");
  });
});
