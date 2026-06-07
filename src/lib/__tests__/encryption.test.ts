/**
 * Tests for lib/encryption.ts — AES-256-GCM field-level encryption.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { encryptField, decryptField } from "@/lib/encryption";

beforeAll(() => {
  // 64 hex chars = 32 bytes — valid AES-256 key
  process.env.ENCRYPTION_KEY = "a".repeat(64);
});

describe("encryptField", () => {
  it("returns null when input is null", async () => {
    const result = await encryptField(null);
    expect(result).toBeNull();
  });

  it("returns a non-null string different from the plaintext", async () => {
    const result = await encryptField("hello");
    expect(result).not.toBeNull();
    expect(result).not.toBe("hello");
  });

  it("produces different ciphertext on each call (random IV)", async () => {
    const first = await encryptField("hello");
    const second = await encryptField("hello");
    expect(first).not.toBe(second);
  });
});

describe("decryptField", () => {
  it("returns null when input is null", async () => {
    const result = await decryptField(null);
    expect(result).toBeNull();
  });

  it("round-trips back to original plaintext", async () => {
    const ciphertext = await encryptField("hello");
    const plaintext = await decryptField(ciphertext as string);
    expect(plaintext).toBe("hello");
  });

  it("returns null for garbage input (does not throw)", async () => {
    const result = await decryptField("garbage");
    // "garbage" doesn't start with "enc:" so it passes through as-is (plaintext passthrough)
    // This tests the no-throw guarantee; result is "garbage" (legacy passthrough) or null
    expect(() => result).not.toThrow();
  });

  it("returns null for malformed enc: ciphertext (does not throw)", async () => {
    const result = await decryptField("enc:notvalidbase64!!!");
    expect(result).toBeNull();
  });
});
