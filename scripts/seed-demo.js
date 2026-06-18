#!/usr/bin/env node
/**
 * scripts/seed-demo.js
 *
 * Seeds the local database with realistic demo data for development and demos.
 * Calls POST /api/internal/seed-demo on a running dev server.
 *
 * Usage:
 *   node scripts/seed-demo.js [--url http://localhost:3000]
 *
 * Requirements:
 *   - Dev server running (npm run dev)
 *   - INTERNAL_API_KEY set in .env.local
 *   - NODE_ENV must not be "production"
 */

const args = process.argv.slice(2);
const urlArg = args.find((a) => a.startsWith("--url="))?.split("=")[1]
  ?? (args[args.indexOf("--url") + 1] ?? "http://localhost:3000");

const BASE_URL = urlArg.replace(/\/$/, "");

// Load INTERNAL_API_KEY from .env.local
const fs   = require("fs");
const path = require("path");
const envPath = path.join(__dirname, "../.env.local");
let internalKey = process.env.INTERNAL_API_KEY;

if (!internalKey && fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const [k, ...v] = line.split("=");
    if (k?.trim() === "INTERNAL_API_KEY") {
      internalKey = v.join("=").trim().replace(/^["']|["']$/g, "");
      break;
    }
  }
}

if (!internalKey) {
  console.error("Error: INTERNAL_API_KEY not found in environment or .env.local");
  process.exit(1);
}

async function seed() {
  console.log(`Seeding demo data at ${BASE_URL}/api/internal/seed-demo …`);

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/internal/seed-demo`, {
      method: "POST",
      headers: { "x-internal-key": internalKey, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`Connection failed: ${e.message}`);
    console.error("Is the dev server running? Run: npm run dev");
    process.exit(1);
  }

  const data = await res.json();

  if (!res.ok) {
    console.error(`Seed failed (${res.status}):`, data.error ?? data);
    process.exit(1);
  }

  if (data.message?.includes("already seeded")) {
    console.log("Demo data already exists. Nothing to do.");
    console.log("To re-seed, clear the database first: node scripts/setup-local-db.js");
    return;
  }

  console.log("\nDemo data seeded successfully!");
  console.log(`\nOrg: ${data.orgId}`);
  console.log("\nLogin credentials (password: Demo@1234):");
  for (const [role, creds] of Object.entries(data.credentials ?? {})) {
    console.log(`  ${role.padEnd(14)} ${creds.email}`);
  }
  console.log(`\nRecords: ${JSON.stringify(data.counts)}`);
}

seed();
