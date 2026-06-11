/**
 * setup-local-db.js
 *
 * Applies every migration in drizzle/migrations/ to local.db in order,
 * then seeds three test organisations with staff accounts.
 *
 * Usage:  node scripts/setup-local-db.js
 *
 * Safe to re-run — migrations use IF NOT EXISTS / OR IGNORE, and ALTER TABLE
 * errors are caught (column already exists = no-op).
 *
 * WHY we look up user IDs after INSERT OR IGNORE:
 *   Migration 0001_initial.sql seeds usr_admin_001 with admin@parkkal.com.
 *   Migration 0003_multitenant.sql seeds the org_parkkal + om_admin_001 member.
 *   If we blindly INSERT with our own preferred IDs and the email already exists,
 *   OR IGNORE skips the insert — our ID is never created. Any FK reference to
 *   that ID then fails. Fix: after each user INSERT OR IGNORE, resolve the actual
 *   ID via email (the canonical unique key). Same pattern for org members.
 */

const { createClient } = require("@libsql/client");
const path = require("path");
const fs   = require("fs");
const bcrypt = require(path.join(__dirname, "../node_modules/bcryptjs"));

const MIGRATIONS_DIR = path.join(__dirname, "../drizzle/migrations");

// ── Split a .sql file into individual statements ────────────────────────────
function splitStatements(sql) {
  return sql
    .split(";")
    .map((s) => s.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);
}

// ── Apply all migration files in numeric order ──────────────────────────────
async function applyMigrations(client) {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql   = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const stmts = splitStatements(sql);
    for (const stmt of stmts) {
      try {
        await client.execute(stmt);
      } catch {
        // Swallow "already exists" and idempotent errors (ALTER TABLE, etc.)
      }
    }
    console.log(`  ✓ ${file}`);
  }
}

// ── Insert a user and return the actual ID from the DB ──────────────────────
// Email is unique — if a row with that email already exists (seeded by a
// migration), INSERT OR IGNORE skips our insert. We then return the existing ID
// rather than our preferred one. All FK references must use the returned ID.
async function upsertUser(client, preferredId, name, email, hash, phone, now) {
  await client.execute({
    sql: `INSERT OR IGNORE INTO users (id,name,email,password_hash,phone,is_active,is_verified,created_at)
          VALUES (?,?,?,?,?,1,1,?)`,
    args: [preferredId, name, email, hash, phone, now],
  });
  // Always update the password so test credentials work even when the row came
  // from a migration with a different hash (e.g. 0005_admin_password.sql).
  await client.execute({
    sql: `UPDATE users SET password_hash = ?, name = ?, is_active = 1, is_verified = 1
          WHERE email = ?`,
    args: [hash, name, email],
  });
  const result = await client.execute({
    sql: `SELECT id FROM users WHERE email = ?`,
    args: [email],
  });
  return result.rows[0].id;
}

// ── Seed org roles, return a slug → id map ──────────────────────────────────
const SYSTEM_ROLES = [
  {
    name: "Administrator",
    slug: "admin",
    color: "#EF4444",
    isSystem: 1,
    permissions: JSON.stringify([
      "patients.view","patients.create","patients.edit","patients.delete",
      "visits.view","visits.create","visits.edit",
      "billing.view","billing.manage",
      "staff.view","staff.manage",
      "salary.view","salary.manage",
      "roles.manage","settings.manage","reports.view",
    ]),
  },
  {
    name: "Doctor",
    slug: "doctor",
    color: "#8B5CF6",
    isSystem: 1,
    permissions: JSON.stringify([
      "patients.view","patients.edit",
      "visits.view","visits.create","visits.edit",
      "billing.view","reports.view",
    ]),
  },
  {
    name: "Nurse",
    slug: "nurse",
    color: "#EC4899",
    isSystem: 1,
    permissions: JSON.stringify([
      "patients.view",
      "visits.view","visits.create","visits.edit",
    ]),
  },
  {
    name: "Receptionist",
    slug: "receptionist",
    color: "#3B82F6",
    isSystem: 1,
    permissions: JSON.stringify([
      "patients.view","patients.create","patients.edit",
      "visits.view","visits.create","billing.view",
    ]),
  },
  {
    name: "Attendant",
    slug: "attendant",
    color: "#F59E0B",
    isSystem: 1,
    permissions: JSON.stringify(["patients.view","visits.view"]),
  },
  {
    name: "Helper",
    slug: "helper",
    color: "#6B7280",
    isSystem: 1,
    permissions: JSON.stringify(["patients.view"]),
  },
];

async function seedOrgRoles(client, orgId, now) {
  const roles = {};
  for (const r of SYSTEM_ROLES) {
    const id = `role_${orgId}_${r.slug}`;
    await client.execute({
      sql: `INSERT OR IGNORE INTO org_roles
              (id,organization_id,name,slug,color,is_system,permissions,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [id, orgId, r.name, r.slug, r.color, r.isSystem, r.permissions, now, now],
    });
    // Resolve from DB — insert may have been skipped (unique slug already exists)
    const row = await client.execute({
      sql: `SELECT id FROM org_roles WHERE organization_id = ? AND slug = ?`,
      args: [orgId, r.slug],
    });
    roles[r.slug] = row.rows[0]?.id ?? id;
  }
  return roles;
}

// ── Insert an org member, tolerating pre-existing (org, user) pairs ─────────
async function seedMember(client, id, orgId, userId, role, orgRoleId, today, now) {
  await client.execute({
    sql: `INSERT OR IGNORE INTO organization_members
            (id,organization_id,user_id,role,org_role_id,salary_type,salary_amount,
             joined_at,is_active,portal_access,created_at)
          VALUES (?,?,?,?,?,?,?,?,1,1,?)`,
    args: [id, orgId, userId, role, orgRoleId, "FIXED", 0, today, now],
  });
  // If the (org, user) pair already existed under a different member ID (migration
  // seed), update it with our role/portal_access so test logins work.
  await client.execute({
    sql: `UPDATE organization_members
          SET org_role_id = ?, role = ?, portal_access = 1, is_active = 1
          WHERE organization_id = ? AND user_id = ?`,
    args: [orgRoleId, role, orgId, userId],
  });
}

async function main() {
  const client = createClient({ url: "file:local.db" });
  const now    = Date.now();
  const today  = new Date().toISOString().split("T")[0];

  // ── 1. Apply migrations ───────────────────────────────────────────────────
  console.log("Applying migrations...");
  await applyMigrations(client);

  // ── 2. Seed organisations ─────────────────────────────────────────────────
  console.log("Seeding organizations...");
  for (const [id, name, slug, phone, email] of [
    ["org_parkkal",  "Parkkal Dental Clinic", "parkkal",  "+91 9876543210", "admin@parkkal.com"],
    ["org_xmed",     "XMed Hospital",          "xmed",     "+91 9876543211", "admin@xmed.com"],
    ["org_drsmile",  "DrSmile Dental",         "drsmile",  "+91 9876543212", "admin@drsmile.com"],
  ]) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO organizations
              (id,name,slug,phone,email,is_active,created_at,updated_at)
            VALUES (?,?,?,?,?,1,?,?)`,
      args: [id, name, slug, phone, email, now, now],
    });
  }

  // ── 3. Seed users (resolve actual DB id after INSERT OR IGNORE) ───────────
  console.log("Seeding users...");
  const adminHash  = await bcrypt.hash("Admin@123",  10);
  const doctorHash = await bcrypt.hash("Doctor@123", 10);
  const recepHash  = await bcrypt.hash("Recep@123",  10);
  const nurseHash  = await bcrypt.hash("Nurse@123",  10);

  // upsertUser returns the actual row ID (may differ from preferredId if the
  // email was already seeded by a migration with a different id).
  const adminParkkal  = await upsertUser(client, "usr_admin_parkkal",  "Admin User",       "admin@parkkal.com",      adminHash,  "+91 9876543210", now);
  const doctorParkkal = await upsertUser(client, "usr_doctor_parkkal", "Dr. Rajesh Kumar", "doctor@parkkal.com",     doctorHash, null,             now);
  const recepParkkal  = await upsertUser(client, "usr_recep_parkkal",  "Priya Sharma",     "reception@parkkal.com",  recepHash,  null,             now);
  const adminXmed     = await upsertUser(client, "usr_admin_xmed",     "Admin XMed",       "admin@xmed.com",         adminHash,  "+91 9876543211", now);
  const adminDrsmile  = await upsertUser(client, "usr_admin_drsmile",  "Admin DrSmile",    "admin@drsmile.com",      adminHash,  "+91 9876543212", now);
  const nurseDrsmile  = await upsertUser(client, "usr_nurse_drsmile",  "Anita Nurse",      "nurse@drsmile.com",      nurseHash,  null,             now);

  // ── 4. Seed org roles ─────────────────────────────────────────────────────
  console.log("Seeding org roles...");
  const parkkalRoles = await seedOrgRoles(client, "org_parkkal",  now);
  const xmedRoles    = await seedOrgRoles(client, "org_xmed",     now);
  const drsmileRoles = await seedOrgRoles(client, "org_drsmile",  now);

  // ── 5. Seed org members ───────────────────────────────────────────────────
  console.log("Seeding org members...");
  await seedMember(client, "om_admin_parkkal",  "org_parkkal",  adminParkkal,  "ADMIN",        parkkalRoles.admin,        today, now);
  await seedMember(client, "om_doctor_parkkal", "org_parkkal",  doctorParkkal, "DOCTOR",       parkkalRoles.doctor,       today, now);
  await seedMember(client, "om_recep_parkkal",  "org_parkkal",  recepParkkal,  "RECEPTIONIST", parkkalRoles.receptionist,  today, now);
  await seedMember(client, "om_admin_xmed",     "org_xmed",     adminXmed,     "ADMIN",        xmedRoles.admin,           today, now);
  // doctorParkkal is a cross-org member (same user, two orgs) — valid in the schema
  await seedMember(client, "om_doctor_xmed",    "org_xmed",     doctorParkkal, "DOCTOR",       xmedRoles.doctor,          today, now);
  await seedMember(client, "om_admin_drsmile",  "org_drsmile",  adminDrsmile,  "ADMIN",        drsmileRoles.admin,        today, now);
  await seedMember(client, "om_nurse_drsmile",  "org_drsmile",  nurseDrsmile,  "NURSE",        drsmileRoles.nurse,        today, now);

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║           TEST LOGIN CREDENTIALS                      ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║ PARKKAL DENTAL CLINIC                                 ║");
  console.log("║   admin@parkkal.com     / Admin@123   (Admin)         ║");
  console.log("║   doctor@parkkal.com    / Doctor@123  (Doctor)        ║");
  console.log("║   reception@parkkal.com / Recep@123   (Receptionist)  ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║ XMED HOSPITAL                                         ║");
  console.log("║   admin@xmed.com        / Admin@123   (Admin)         ║");
  console.log("║   doctor@parkkal.com    / Doctor@123  (Doctor-shared) ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║ DRSMILE DENTAL                                        ║");
  console.log("║   admin@drsmile.com     / Admin@123   (Admin)         ║");
  console.log("║   nurse@drsmile.com     / Nurse@123   (Nurse)         ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  client.close();
}

main().catch((e) => { console.error("Setup failed:", e.message); process.exit(1); });
