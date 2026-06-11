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
 */

const { createClient } = require("@libsql/client");
const path = require("path");
const fs   = require("fs");
const bcrypt = require(path.join(__dirname, "../node_modules/bcryptjs"));

const MIGRATIONS_DIR = path.join(__dirname, "../drizzle/migrations");

// ── Split a .sql file into individual statements ────────────────────────────
// Handles multi-line statements and strips -- comments.
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
    .sort(); // lexicographic order = 0001, 0002, … 0042

  for (const file of files) {
    const sql  = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const stmts = splitStatements(sql);
    for (const stmt of stmts) {
      try {
        await client.execute(stmt);
      } catch {
        // Swallow "already exists" errors (ALTER TABLE, duplicate index, etc.)
      }
    }
    console.log(`  ✓ ${file}`);
  }
}

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
      "roles.manage","settings.manage","reports.view"
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
      "billing.view","reports.view"
    ]),
  },
  {
    name: "Nurse",
    slug: "nurse",
    color: "#EC4899",
    isSystem: 1,
    permissions: JSON.stringify([
      "patients.view",
      "visits.view","visits.create","visits.edit"
    ]),
  },
  {
    name: "Receptionist",
    slug: "receptionist",
    color: "#3B82F6",
    isSystem: 1,
    permissions: JSON.stringify([
      "patients.view","patients.create","patients.edit",
      "visits.view","visits.create","billing.view"
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
      sql: `INSERT OR IGNORE INTO org_roles (id,organization_id,name,slug,color,is_system,permissions,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [id, orgId, r.name, r.slug, r.color, r.isSystem, r.permissions, now, now],
    });
    roles[r.slug] = id;
  }
  return roles;
}

async function main() {
  const client = createClient({ url: "file:local.db" });
  const now   = Date.now();
  const today = new Date().toISOString().split("T")[0];

  console.log("Applying migrations...");
  await applyMigrations(client);

  console.log("Seeding organizations...");

  // Org 1: Parkkal Dental Clinic
  await client.execute({
    sql: `INSERT OR IGNORE INTO organizations (id,name,slug,phone,email,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)`,
    args: ["org_parkkal","Parkkal Dental Clinic","parkkal","+91 9876543210","admin@parkkal.com",now,now],
  });

  // Org 2: XMed Hospital
  await client.execute({
    sql: `INSERT OR IGNORE INTO organizations (id,name,slug,phone,email,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)`,
    args: ["org_xmed","XMed Hospital","xmed","+91 9876543211","admin@xmed.com",now,now],
  });

  // Org 3: DrSmile Dental
  await client.execute({
    sql: `INSERT OR IGNORE INTO organizations (id,name,slug,phone,email,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)`,
    args: ["org_drsmile","DrSmile Dental","drsmile","+91 9876543212","admin@drsmile.com",now,now],
  });

  console.log("Seeding users...");
  const adminHash  = await bcrypt.hash("Admin@123",  10);
  const doctorHash = await bcrypt.hash("Doctor@123", 10);
  const recepHash  = await bcrypt.hash("Recep@123",  10);
  const nurseHash  = await bcrypt.hash("Nurse@123",  10);

  const users = [
    ["usr_admin_parkkal",  "Admin User",       "admin@parkkal.com",      adminHash,  "+91 9876543210"],
    ["usr_doctor_parkkal", "Dr. Rajesh Kumar", "doctor@parkkal.com",     doctorHash, null],
    ["usr_recep_parkkal",  "Priya Sharma",     "reception@parkkal.com",  recepHash,  null],
    ["usr_admin_xmed",     "Admin XMed",       "admin@xmed.com",         adminHash,  "+91 9876543211"],
    ["usr_admin_drsmile",  "Admin DrSmile",    "admin@drsmile.com",      adminHash,  "+91 9876543212"],
    ["usr_nurse_drsmile",  "Anita Nurse",      "nurse@drsmile.com",      nurseHash,  null],
  ];

  for (const [id, name, email, hash, phone] of users) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO users (id,name,email,password_hash,phone,is_active,is_verified,created_at) VALUES (?,?,?,?,?,1,1,?)`,
      args: [id, name, email, hash, phone, now],
    });
  }

  console.log("Seeding org roles...");
  const parkkalRoles  = await seedOrgRoles(client, "org_parkkal",  now);
  const xmedRoles     = await seedOrgRoles(client, "org_xmed",     now);
  const drsmileRoles  = await seedOrgRoles(client, "org_drsmile",  now);

  console.log("Seeding org members...");
  const members = [
    // Parkkal
    ["om_admin_parkkal",  "org_parkkal",  "usr_admin_parkkal",  "ADMIN",        parkkalRoles.admin],
    ["om_doctor_parkkal", "org_parkkal",  "usr_doctor_parkkal", "DOCTOR",       parkkalRoles.doctor],
    ["om_recep_parkkal",  "org_parkkal",  "usr_recep_parkkal",  "RECEPTIONIST", parkkalRoles.receptionist],
    // XMed
    ["om_admin_xmed",     "org_xmed",     "usr_admin_xmed",     "ADMIN",        xmedRoles.admin],
    ["om_doctor_xmed",    "org_xmed",     "usr_doctor_parkkal", "DOCTOR",       xmedRoles.doctor],
    // DrSmile
    ["om_admin_drsmile",  "org_drsmile",  "usr_admin_drsmile",  "ADMIN",        drsmileRoles.admin],
    ["om_nurse_drsmile",  "org_drsmile",  "usr_nurse_drsmile",  "NURSE",        drsmileRoles.nurse],
  ];

  for (const [id, orgId, userId, role, orgRoleId] of members) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO organization_members (id,organization_id,user_id,role,org_role_id,salary_type,salary_amount,joined_at,is_active,portal_access,created_at) VALUES (?,?,?,?,?,?,?,?,1,1,?)`,
      args: [id, orgId, userId, role, orgRoleId, "FIXED", 0, today, now],
    });
  }

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
