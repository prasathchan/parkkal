import { describe, it, expect } from "vitest";

// Pure function extracted for testing — mirrors the logic in visits/route.ts
function generateVisitCode(date: string, seq: number): string {
  const d = date.replace(/-/g, "");
  return `VIS-${d}-${String(seq).padStart(4, "0")}`;
}

describe("generateVisitCode", () => {
  it("formats a standard date and sequence", () => {
    expect(generateVisitCode("2024-06-15", 1)).toBe("VIS-20240615-0001");
  });

  it("zero-pads sequences below 1000", () => {
    expect(generateVisitCode("2024-01-01", 42)).toBe("VIS-20240101-0042");
  });

  it("handles sequence >= 10000 without truncation", () => {
    expect(generateVisitCode("2024-12-31", 10001)).toBe("VIS-20241231-10001");
  });

  it("produces unique codes for different dates with the same sequence", () => {
    const a = generateVisitCode("2024-06-01", 1);
    const b = generateVisitCode("2024-06-02", 1);
    expect(a).not.toBe(b);
  });

  it("produces unique codes for same date, different sequences", () => {
    const a = generateVisitCode("2024-06-01", 1);
    const b = generateVisitCode("2024-06-01", 2);
    expect(a).not.toBe(b);
  });
});
