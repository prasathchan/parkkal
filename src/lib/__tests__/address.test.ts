/**
 * Tests for src/lib/address.ts
 *
 * Covers: parseAddress, serializeAddress, formatAddressDisplay, EMPTY_ADDRESS
 */
import { describe, it, expect } from "vitest";
import { parseAddress, serializeAddress, formatAddressDisplay, EMPTY_ADDRESS } from "@/lib/address";

// ─── EMPTY_ADDRESS ────────────────────────────────────────────────────────────

describe("EMPTY_ADDRESS", () => {
  it("has country pre-filled to India", () => {
    expect(EMPTY_ADDRESS.country).toBe("India");
  });

  it("has all other fields as empty strings", () => {
    expect(EMPTY_ADDRESS.state).toBe("");
    expect(EMPTY_ADDRESS.city).toBe("");
    expect(EMPTY_ADDRESS.pincode).toBe("");
    expect(EMPTY_ADDRESS.fullAddress).toBe("");
  });
});

// ─── parseAddress ─────────────────────────────────────────────────────────────

describe("parseAddress", () => {
  it("returns EMPTY_ADDRESS for null", () => {
    const result = parseAddress(null);
    expect(result.country).toBe("India");
    expect(result.state).toBe("");
  });

  it("returns EMPTY_ADDRESS for undefined", () => {
    const result = parseAddress(undefined);
    expect(result.country).toBe("India");
  });

  it("returns EMPTY_ADDRESS for empty string", () => {
    const result = parseAddress("");
    expect(result.country).toBe("India");
  });

  it("parses a valid JSON address object", () => {
    const raw = JSON.stringify({
      country: "India",
      state: "Tamil Nadu",
      district: "Chennai",
      city: "Chennai",
      pincode: "600001",
      fullAddress: "12 Main St",
    });
    const result = parseAddress(raw);
    expect(result.state).toBe("Tamil Nadu");
    expect(result.city).toBe("Chennai");
    expect(result.pincode).toBe("600001");
    expect(result.fullAddress).toBe("12 Main St");
  });

  it("merges partial JSON with EMPTY_ADDRESS defaults", () => {
    const raw = JSON.stringify({ country: "India", state: "Kerala" });
    const result = parseAddress(raw);
    expect(result.state).toBe("Kerala");
    expect(result.city).toBe(""); // default
    expect(result.pincode).toBe(""); // default
  });

  it("falls back to legacy plain string as fullAddress", () => {
    const result = parseAddress("12 Main St, Chennai");
    expect(result.fullAddress).toBe("12 Main St, Chennai");
    expect(result.country).toBe("India");
  });

  it("handles malformed JSON as plain string fallback", () => {
    const result = parseAddress("{broken json}");
    // No `country` key in the broken object so fallback to legacy plain string
    expect(result.fullAddress).toBe("{broken json}");
  });
});

// ─── serializeAddress ─────────────────────────────────────────────────────────

describe("serializeAddress", () => {
  it("serializes an address to JSON string", () => {
    const addr = {
      country: "India",
      state: "Tamil Nadu",
      district: "Chennai",
      city: "Chennai",
      pincode: "600001",
      fullAddress: "12 Main St",
    };
    const json = serializeAddress(addr);
    expect(JSON.parse(json)).toEqual(addr);
  });

  it("round-trips correctly: serialize → parse", () => {
    const original = { ...EMPTY_ADDRESS, state: "Kerala", city: "Kochi", pincode: "682001" };
    const serialized = serializeAddress(original);
    const parsed = parseAddress(serialized);
    expect(parsed.state).toBe("Kerala");
    expect(parsed.city).toBe("Kochi");
    expect(parsed.pincode).toBe("682001");
  });
});

// ─── formatAddressDisplay ─────────────────────────────────────────────────────

describe("formatAddressDisplay", () => {
  it("joins non-empty parts with commas", () => {
    const addr = {
      country: "India",
      state: "Tamil Nadu",
      district: "",
      city: "Chennai",
      pincode: "600001",
      fullAddress: "12 Main St",
    };
    const result = formatAddressDisplay(addr);
    expect(result).toContain("12 Main St");
    expect(result).toContain("Chennai");
    expect(result).toContain("Tamil Nadu - 600001");
    expect(result).toContain("India");
  });

  it("combines state and pincode as 'State - Pincode'", () => {
    const addr = { ...EMPTY_ADDRESS, state: "Kerala", pincode: "682001" };
    const result = formatAddressDisplay(addr);
    expect(result).toContain("Kerala - 682001");
  });

  it("shows state alone when pincode is missing", () => {
    const addr = { ...EMPTY_ADDRESS, state: "Kerala", pincode: "" };
    const result = formatAddressDisplay(addr);
    expect(result).toContain("Kerala");
    expect(result).not.toContain("-");
  });

  it("skips empty fields gracefully", () => {
    const result = formatAddressDisplay(EMPTY_ADDRESS);
    // Only "India" should remain
    expect(result).toBe("India");
  });
});
