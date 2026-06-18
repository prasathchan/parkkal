/**
 * scripts/rotate-encryption-key.js
 *
 * Re-encrypts all PII fields (panNumber, aadhaarNumber) from ENCRYPTION_KEY (v1)
 * to ENCRYPTION_KEY_V2 (v2) in the local D1 database.
 *
 * Run AFTER setting ENCRYPTION_KEY_V2 in your environment:
 *   ENCRYPTION_KEY=<old> ENCRYPTION_KEY_V2=<new> node scripts/rotate-encryption-key.js
 *
 * Tables processed: patients, users
 *
 * The script is idempotent — rows already encrypted with v2 (enc:v2:...) are skipped.
 * Run it against staging first; verify, then run against production.
 */

const LEGACY_PREFIX = "enc:";
const V1_PREFIX = "enc:v1:";
const V2_PREFIX = "enc:v2:";

const v1Hex = process.env.ENCRYPTION_KEY;
const v2Hex = process.env.ENCRYPTION_KEY_V2;

if (!v1Hex || v1Hex.length !== 64) {
  console.error("ENCRYPTION_KEY must be a 64-char hex string (the OLD key)");
  process.exit(1);
}
if (!v2Hex || v2Hex.length !== 64) {
  console.error("ENCRYPTION_KEY_V2 must be a 64-char hex string (the NEW key)");
  process.exit(1);
}

const { webcrypto } = require("crypto");

function hexToBytes(hex) {
  const raw = new Uint8Array(32);
  for (let i = 0; i < 64; i += 2) raw[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return raw;
}

async function importKey(hex) {
  return webcrypto.subtle.importKey("raw", hexToBytes(hex), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function stripPrefix(value) {
  if (value.startsWith(V2_PREFIX)) return value.slice(V2_PREFIX.length);
  if (value.startsWith(V1_PREFIX)) return value.slice(V1_PREFIX.length);
  return value.slice(LEGACY_PREFIX.length);
}

async function decryptWith(value, key) {
  const combined = Buffer.from(stripPrefix(value), "base64");
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const plainBuf = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return Buffer.from(plainBuf).toString("utf8");
}

async function encryptWith(plain, key) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    Buffer.from(plain, "utf8")
  );
  const combined = Buffer.concat([Buffer.from(iv), Buffer.from(cipherBuf)]);
  return V2_PREFIX + combined.toString("base64");
}

async function rotateField(value, v1Key, v2Key) {
  if (!value || !value.startsWith(LEGACY_PREFIX)) return null; // not encrypted or already plaintext
  if (value.startsWith(V2_PREFIX)) return null; // already v2 — skip
  const plain = await decryptWith(value, v1Key);
  return encryptWith(plain, v2Key);
}

async function main() {
  const { execSync } = require("child_process");

  const v1Key = await importKey(v1Hex);
  const v2Key = await importKey(v2Hex);

  const tables = [
    { table: "patients",  cols: ["pan_number", "aadhaar_number"] },
    { table: "users",     cols: ["pan_number", "aadhaar_number"] },
  ];

  for (const { table, cols } of tables) {
    const jsonOut = execSync(
      `npx wrangler d1 execute parkkal-db --local --command "SELECT id, ${cols.join(", ")} FROM ${table}" --json`,
      { cwd: process.cwd() }
    );

    let rows;
    try {
      const parsed = JSON.parse(jsonOut.toString());
      rows = parsed[0]?.results ?? [];
    } catch {
      console.error(`Failed to parse results for ${table}`);
      continue;
    }

    let updated = 0;
    for (const row of rows) {
      const sets = [];
      for (const col of cols) {
        const camel = col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        const val = row[col] ?? row[camel];
        const rotated = await rotateField(val, v1Key, v2Key);
        if (rotated) sets.push(`${col} = '${rotated}'`);
      }
      if (sets.length === 0) continue;
      execSync(
        `npx wrangler d1 execute parkkal-db --local --command "UPDATE ${table} SET ${sets.join(", ")} WHERE id = '${row.id}'"`,
        { cwd: process.cwd() }
      );
      updated++;
    }
    console.log(`${table}: rotated ${updated} / ${rows.length} rows`);
  }

  console.log("Rotation complete. Verify, then remove ENCRYPTION_KEY from environment.");
}

main().catch((e) => { console.error(e); process.exit(1); });
