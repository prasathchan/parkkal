/**
 * lib/encryption.ts
 *
 * AES-256-GCM field-level encryption for sensitive Indian government IDs.
 * Used to protect PAN numbers and Aadhaar numbers at rest in the database.
 *
 * ─── HOW IT WORKS ────────────────────────────────────────────────────────────
 *   1. A random 12-byte IV is generated for every encryption.
 *   2. The plaintext is encrypted with AES-256-GCM using ENCRYPTION_KEY.
 *   3. IV + ciphertext are base64-encoded and prefixed with "enc:".
 *   4. The database stores the "enc:..." string instead of the raw value.
 *
 *   On read: if the value starts with "enc:", it's decrypted.
 *            If it doesn't (legacy row), it's returned as-is (passthrough).
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────────
 *   Set ENCRYPTION_KEY to a 64-character hex string (= 32 bytes / 256 bits).
 *   Generate one with: openssl rand -hex 32
 *
 *   Without the key, fields are stored in plaintext with a warning.
 *   This is intentional for local dev — never skip the key in production.
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *   encryptField(value)  → "enc:..." ciphertext, or the original value if no key
 *   decryptField(value)  → plaintext, or null on decryption failure
 */

import env from "@/lib/env";

const PREFIX = "enc:";

// Cache the CryptoKey per hex value — importKey() is expensive and the ENCRYPTION_KEY
// env var is immutable for the lifetime of a Worker isolate.
let _keyCache: { hex: string; key: CryptoKey } | null = null;
let _keyMissingWarned = false;

async function importKey(): Promise<CryptoKey | null> {
  const hex = env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    if (env.NODE_ENV !== "test") {
      throw new Error("ENCRYPTION_KEY is not set or invalid — refusing to store PII without encryption");
    }
    if (!_keyMissingWarned) {
      _keyMissingWarned = true;
      console.warn("[SECURITY] ENCRYPTION_KEY not set — PII encryption disabled (test mode only)");
    }
    return null;
  }
  if (_keyCache?.hex === hex) return _keyCache.key;
  const raw = new Uint8Array(32);
  for (let i = 0; i < 64; i += 2) {
    raw[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  _keyCache = { hex, key };
  return key;
}

export async function encryptField(value: string | null | undefined): Promise<string | null | undefined> {
  if (value === null || value === undefined || value === "") return value;
  if (value.startsWith(PREFIX)) return value; // already encrypted
  const key = await importKey();
  if (!key) return value;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value)
  );

  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), 12);
  return PREFIX + btoa(String.fromCharCode(...combined));
}

export async function decryptField(value: string | null | undefined): Promise<string | null | undefined> {
  if (value === null || value === undefined || value === "") return value;
  if (!value.startsWith(PREFIX)) return value; // plaintext passthrough (legacy row)
  const key = await importKey();
  if (!key) return value;

  try {
    const combined = Uint8Array.from(atob(value.slice(PREFIX.length)), (c) => c.charCodeAt(0));
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: combined.slice(0, 12) },
      key,
      combined.slice(12)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    // Decryption failure — return null rather than expose raw ciphertext
    return null;
  }
}
