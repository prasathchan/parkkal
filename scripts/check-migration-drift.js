#!/usr/bin/env node
/**
 * scripts/check-migration-drift.js
 *
 * Verifies that every .sql file in drizzle/migrations/ has been recorded in
 * the D1 migrations table (d1_migrations). Run this in CI after deploying to
 * catch schema drift before it causes production issues.
 *
 * Usage:
 *   # Against the remote production D1 database:
 *   node scripts/check-migration-drift.js --remote
 *
 *   # Against local D1:
 *   node scripts/check-migration-drift.js
 *
 * Exit codes:
 *   0  All migration files are present in d1_migrations — schema is in sync.
 *   1  One or more files are missing — deployment is out of sync with code.
 *
 * How it works:
 *   1. Reads the filenames from drizzle/migrations/*.sql (source of truth = repo)
 *   2. Queries the d1_migrations table for applied migration names
 *   3. Diffs the two sets and reports any unapplied files
 *
 * Note: d1_migrations is Wrangler's internal tracking table. It stores the
 * migration filename without the .sql extension as the "name" column.
 */

const { execSync } = require("child_process");
const fs            = require("fs");
const path          = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "..", "drizzle", "migrations");
const REMOTE_FLAG    = process.argv.includes("--remote");
const ENV_ARG        = process.argv.find((a) => a.startsWith("--env="));
const ENV_NAME       = ENV_ARG ? ENV_ARG.replace("--env=", "") : "prod";
const DB_NAME        = REMOTE_FLAG && ENV_NAME === "staging" ? "parkkal-db-staging" : "parkkal-db";
const ENV_FLAG       = REMOTE_FLAG ? `--env=${ENV_NAME} --remote` : "--local";

// ── 1. Collect migration files from the repo ──────────────────────────────────
const sqlFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (sqlFiles.length === 0) {
  console.error("[drift-check] No .sql files found in", MIGRATIONS_DIR);
  process.exit(1);
}

console.log(`[drift-check] Found ${sqlFiles.length} migration file(s) in repo.`);

// ── 2. Query the applied migrations table ─────────────────────────────────────
let appliedNames;
try {
  const output = execSync(
    `npx wrangler d1 execute ${DB_NAME} ${ENV_FLAG} --command "SELECT name FROM d1_migrations ORDER BY name" --json`,
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  );
  // wrangler --json returns an array of result sets
  const parsed = JSON.parse(output);
  const rows   = parsed?.[0]?.results ?? [];
  appliedNames = new Set(rows.map((r) => r.name));
} catch (err) {
  // If d1_migrations doesn't exist yet (very first deploy), treat as empty
  const msg = err.message ?? String(err);
  if (msg.includes("no such table") || msg.includes("d1_migrations")) {
    console.warn("[drift-check] d1_migrations table not found — database may not be initialised yet.");
    appliedNames = new Set();
  } else {
    console.error("[drift-check] Failed to query d1_migrations:", msg);
    process.exit(1);
  }
}

// ── 3. Compare and report ─────────────────────────────────────────────────────
// Wrangler stores migration names WITHOUT the .sql extension
const unapplied = sqlFiles.filter(
  (f) => !appliedNames.has(f) && !appliedNames.has(f.replace(/\.sql$/, ""))
);

if (unapplied.length > 0) {
  console.error("[drift-check] SCHEMA DRIFT DETECTED — unapplied migration(s):");
  unapplied.forEach((f) => console.error("  ✗", f));
  console.error("\nRun the following to apply:");
  console.error(`  npx wrangler d1 migrations apply ${DB_NAME} ${ENV_FLAG}\n`);
  process.exit(1);
}

console.log("[drift-check] All migrations applied. Schema is in sync.");
