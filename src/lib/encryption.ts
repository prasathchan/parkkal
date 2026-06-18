/**
 * lib/encryption.ts
 *
 * AES-256-GCM field-level encryption for sensitive Indian government IDs.
 * Used to protect PAN numbers and Aadhaar numbers at rest in the database.
 *
 * ─── VERSIONED KEY FORMAT ────────────────────────────────────────────────────
 *   enc:<base64>          → legacy v1 (pre-rotation; decrypts with ENCRYPTION_KEY)
 *   enc:v1:<base64>       → explicit v1 (post-rotation re-encrypt with old key)
 *   enc:v2:<base64>       → v2 (set ENCRYPTION_KEY_V2 to activate)
 *
 *   encrypt() always uses the latest active version:
 *     - v2 if ENCRYPTION_KEY_V2 is set
 *     - v1 (legacy format) otherwise
 *
 *   decrypt() reads the version prefix and routes to the matching key.
 *   This means both keys must be present during key rotation.
 *
 * ─── HOW TO ROTATE ───────────────────────────────────────────────────────────
 *   1. Generate a new key: openssl rand -hex 32
 *   2. Set ENCRYPTION_KEY_V2 in your environment (keep ENCRYPTION_KEY too).
 *   3. Run: node scripts/rotate-encryption-key.js
 *      This re-encrypts all PII fields in the DB with v2.
 *   4. Once all rows are migrated, ENCRYPTION_KEY can be removed.
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *   encryptField(value)  → versioned ciphertext, or original value if no key
 *   decryptField(value)  → plaintext, or null on decryption failure
 */

import env from "@/lib/env";

const LEGACY_PREFIX = "enc:";
const V1_PREFIX     = "enc:v1:";
const V2_PREFIX     = "enc:v2:";

type KeyCache = { hex: string; key: CryptoKey };
const _keyCache: Record<"v1" | "v2", KeyCache | null> = { v1: null, v2: null };
let _keyMissingWarned = false;

async function importHexKey(hex: string, version: "v1" | "v2"): Promise<CryptoKey> {
  if (_keyCache[version]?.hex === hex) return _keyCache[version]!.key;
  const raw = new Uint8Array(32);
  for (let i = 0; i < 64; i += 2) raw[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  _keyCache[version] = { hex, key };
  return key;
}

async function getActiveKey(): Promise<{ key: CryptoKey; prefix: string } | null> {
  const v2hex = env.ENCRYPTION_KEY_V2;
  if (v2hex) {
    return { key: await importHexKey(v2hex, "v2"), prefix: V2_PREFIX };
  }
  const v1hex = env.ENCRYPTION_KEY;
  if (!v1hex || v1hex.length !== 64) {
    if (env.NODE_ENV !== "test") {
      throw new Error("ENCRYPTION_KEY is not set or invalid — refusing to store PII without encryption");
    }
    if (!_keyMissingWarned) {
      _keyMissingWarned = true;
      console.warn("[SECURITY] ENCRYPTION_KEY not set — PII encryption disabled (test mode only)");
    }
    return null;
  }
  return { key: await importHexKey(v1hex, "v1"), prefix: LEGACY_PREFIX };
}

async function getKeyForDecrypt(value: string): Promise<CryptoKey | null> {
  if (value.startsWith(V2_PREFIX)) {
    const hex = env.ENCRYPTION_KEY_V2;
    if (!hex) return null;
    return importHexKey(hex, "v2");
  }
  // Legacy "enc:" and explicit "enc:v1:" both use ENCRYPTION_KEY
  const hex = env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return null;
  return importHexKey(hex, "v1");
}

function stripPrefix(value: string): string {
  if (value.startsWith(V2_PREFIX)) return value.slice(V2_PREFIX.length);
  if (value.startsWith(V1_PREFIX)) return value.slice(V1_PREFIX.length);
  return value.slice(LEGACY_PREFIX.length); // legacy "enc:"
}

export async function encryptField(value: string | null | undefined): Promise<string | null | undefined> {
  if (value === null || value === undefined || value === "") return value;
  if (value.startsWith(LEGACY_PREFIX)) return value; // already encrypted

  const active = await getActiveKey();
  if (!active) return value;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    active.key,
    new TextEncoder().encode(value)
  );

  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), 12);
  return active.prefix + btoa(String.fromCharCode(...combined));
}

export async function decryptField(value: string | null | undefined): Promise<string | null | undefined> {
  if (value === null || value === undefined || value === "") return value;
  if (!value.startsWith(LEGACY_PREFIX)) return value; // plaintext passthrough (legacy row)

  const key = await getKeyForDecrypt(value);
  if (!key) return value;

  try {
    const b64 = stripPrefix(value);
    const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: combined.slice(0, 12) },
      key,
      combined.slice(12)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
