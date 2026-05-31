const { createClient } = require("@libsql/client");
const path = require("path");
const bcrypt = require(path.join(__dirname, "../node_modules/bcryptjs"));

const SQL = [
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
    address TEXT, phone TEXT, email TEXT, logo_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, phone TEXT, date_of_birth TEXT, gender TEXT,
    address TEXT, pan_number TEXT, aadhaar_number TEXT, profile_image_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS org_roles (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL, slug TEXT NOT NULL, description TEXT,
    color TEXT NOT NULL DEFAULT '#3B82F6', is_system INTEGER NOT NULL DEFAULT 0,
    permissions TEXT NOT NULL DEFAULT '[]', created_at INTEGER, updated_at INTEGER,
    UNIQUE(organization_id, slug)
  )`,
  `CREATE TABLE IF NOT EXISTS organization_members (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK (role IN ('ADMIN','DOCTOR','NURSE','RECEPTIONIST','ATTENDANT','HELPER')),
    org_role_id TEXT REFERENCES org_roles(id),
    salary_type TEXT NOT NULL DEFAULT 'FIXED' CHECK (salary_type IN ('FIXED','PER_APPOINTMENT')),
    salary_amount REAL NOT NULL DEFAULT 0, joined_at TEXT, is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL, UNIQUE(organization_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS emergency_contacts (
    id TEXT PRIMARY KEY, entity_type TEXT NOT NULL CHECK (entity_type IN ('USER','PATIENT')),
    entity_id TEXT NOT NULL, name TEXT NOT NULL, relationship TEXT NOT NULL,
    phone TEXT NOT NULL, email TEXT, address TEXT, created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY, patient_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    phone TEXT NOT NULL, email TEXT, date_of_birth TEXT, gender TEXT, address TEXT,
    medical_history TEXT, pan_number TEXT, aadhaar_number TEXT,
    emergency_contact_added INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS organization_patients (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
    patient_id TEXT NOT NULL REFERENCES patients(id), patient_code TEXT NOT NULL,
    registered_at INTEGER NOT NULL, is_active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(organization_id, patient_id), UNIQUE(organization_id, patient_code)
  )`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id),
    patient_id TEXT NOT NULL REFERENCES patients(id), doctor_id TEXT NOT NULL REFERENCES users(id),
    appointment_date TEXT NOT NULL, appointment_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
    type TEXT NOT NULL DEFAULT 'CONSULTATION' CHECK (type IN ('CONSULTATION','CHECKUP','TREATMENT','FOLLOWUP')),
    notes TEXT, created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS treatments (
    id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id),
    patient_id TEXT NOT NULL REFERENCES patients(id), appointment_id TEXT REFERENCES appointments(id),
    doctor_id TEXT NOT NULL REFERENCES users(id), description TEXT NOT NULL,
    tooth_numbers TEXT, procedure TEXT, cost REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id),
    patient_id TEXT NOT NULL REFERENCES patients(id), total_amount REAL NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PARTIAL','PAID')),
    notes TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS invoice_treatments (
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    treatment_id TEXT NOT NULL REFERENCES treatments(id),
    PRIMARY KEY (invoice_id, treatment_id)
  )`,
  `CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id),
    visit_code TEXT NOT NULL UNIQUE, patient_id TEXT NOT NULL REFERENCES patients(id),
    doctor_id TEXT NOT NULL REFERENCES users(id), visit_date TEXT NOT NULL,
    chief_complaint TEXT, doctor_notes TEXT, diagnosis TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','COMPLETED','CANCELLED')),
    total_amount REAL NOT NULL DEFAULT 0, paid_amount REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS visit_items (
    id TEXT PRIMARY KEY, visit_id TEXT NOT NULL REFERENCES visits(id),
    item_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'OTHER' CHECK (category IN ('MEDICINE','PROCEDURE','XRAY','CONSULTATION','OTHER')),
    tooth_number TEXT, quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0, notes TEXT, created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY, visit_id TEXT NOT NULL REFERENCES visits(id),
    patient_id TEXT NOT NULL REFERENCES patients(id), amount REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH','CARD','UPI','BANK_TRANSFER')),
    reference_number TEXT, notes TEXT, paid_at INTEGER NOT NULL,
    recorded_by TEXT NOT NULL REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY, visit_id TEXT NOT NULL REFERENCES visits(id),
    patient_id TEXT NOT NULL REFERENCES patients(id), file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'OTHER' CHECK (file_type IN ('XRAY','PRESCRIPTION','DOCTOR_NOTE','LAB_REPORT','OTHER')),
    mime_type TEXT NOT NULL, file_size INTEGER NOT NULL, file_url TEXT NOT NULL,
    uploaded_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS salary_records (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id), month TEXT NOT NULL,
    salary_amount REAL NOT NULL,
    salary_type TEXT NOT NULL CHECK (salary_type IN ('FIXED','PER_APPOINTMENT')),
    appointment_count INTEGER NOT NULL DEFAULT 0, paid_amount REAL NOT NULL DEFAULT 0,
    paid_at INTEGER, status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PARTIAL','PAID')),
    notes TEXT, created_at INTEGER NOT NULL, UNIQUE(organization_id, user_id, month)
  )`,
  `CREATE TABLE IF NOT EXISTS feature_flags (
    id TEXT PRIMARY KEY,
    feature_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    org_id TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 0,
    rollout_percent INTEGER NOT NULL DEFAULT 100,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(feature_key, org_id)
  )`,
];

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
  const now = Date.now();
  const today = new Date().toISOString().split("T")[0];

  console.log("Creating tables...");
  for (const sql of SQL) {
    await client.execute(sql);
  }

  // Migrations for existing DBs
  const migrations = [
    `ALTER TABLE organizations ADD COLUMN theme_config TEXT`,
    `ALTER TABLE visits ADD COLUMN appointment_id TEXT REFERENCES appointments(id)`,
    `ALTER TABLE visits ADD COLUMN visit_type TEXT NOT NULL DEFAULT 'WALKIN'`,
    `CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id),
  visit_id TEXT NOT NULL REFERENCES visits(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  doctor_id TEXT NOT NULL REFERENCES users(id),
  medicines TEXT NOT NULL DEFAULT '[]',
  instructions TEXT,
  created_at INTEGER NOT NULL
)`,
  ];
  for (const sql of migrations) {
    try { await client.execute(sql); } catch { /* column already exists */ }
  }

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
  const adminHash = await bcrypt.hash("Admin@123", 10);
  const doctorHash = await bcrypt.hash("Doctor@123", 10);
  const recepHash = await bcrypt.hash("Recep@123", 10);
  const nurseHash = await bcrypt.hash("Nurse@123", 10);

  const users = [
    ["usr_admin_parkkal","Admin User","admin@parkkal.com",adminHash],
    ["usr_doctor_parkkal","Dr. Rajesh Kumar","doctor@parkkal.com",doctorHash],
    ["usr_recep_parkkal","Priya Sharma","reception@parkkal.com",recepHash],
    ["usr_admin_xmed","Admin XMed","admin@xmed.com",adminHash],
    ["usr_admin_drsmile","Admin DrSmile","admin@drsmile.com",adminHash],
    ["usr_nurse_drsmile","Anita Nurse","nurse@drsmile.com",nurseHash],
  ];

  for (const [id,name,email,hash] of users) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO users (id,name,email,password_hash,is_active,created_at) VALUES (?,?,?,?,1,?)`,
      args: [id,name,email,hash,now],
    });
  }

  console.log("Seeding org roles...");
  const parkkalRoles = await seedOrgRoles(client, "org_parkkal", now);
  const xmedRoles = await seedOrgRoles(client, "org_xmed", now);
  const drsmileRoles = await seedOrgRoles(client, "org_drsmile", now);

  console.log("Seeding org members...");
  const members = [
    // Parkkal
    ["om_admin_parkkal","org_parkkal","usr_admin_parkkal","ADMIN",parkkalRoles.admin],
    ["om_doctor_parkkal","org_parkkal","usr_doctor_parkkal","DOCTOR",parkkalRoles.doctor],
    ["om_recep_parkkal","org_parkkal","usr_recep_parkkal","RECEPTIONIST",parkkalRoles.receptionist],
    // XMed
    ["om_admin_xmed","org_xmed","usr_admin_xmed","ADMIN",xmedRoles.admin],
    ["om_doctor_xmed","org_xmed","usr_doctor_parkkal","DOCTOR",xmedRoles.doctor], // shared doctor
    // DrSmile
    ["om_admin_drsmile","org_drsmile","usr_admin_drsmile","ADMIN",drsmileRoles.admin],
    ["om_nurse_drsmile","org_drsmile","usr_nurse_drsmile","NURSE",drsmileRoles.nurse],
  ];

  for (const [id,orgId,userId,role,orgRoleId] of members) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO organization_members (id,organization_id,user_id,role,org_role_id,salary_type,salary_amount,joined_at,is_active,created_at) VALUES (?,?,?,?,?,?,?,?,1,?)`,
      args: [id,orgId,userId,role,orgRoleId,"FIXED",0,today,now],
    });
  }

  console.log("Seeding feature flags...");
  const defaultFlags = [
    ["ff_dental_chart",       "Dental Chart (Odontogram)",       "Interactive tooth chart on visits",           0],
    ["ff_patient_portal",     "Patient Portal",                  "Patient self-service login and history",      0],
    ["ff_pdf_export",         "PDF Export",                      "Download receipts and prescriptions as PDF",  0],
    ["ff_whatsapp_notify",    "WhatsApp Notifications",          "Send appointment and payment notifications",  0],
    ["ff_inventory",          "Inventory Management",            "Track dental supplies and stock levels",      0],
    ["ff_analytics",          "Financial Analytics",             "Advanced revenue reports and charts",         0],
    ["ff_lab_integration",    "Lab Integration",                 "Track crown/denture lab work orders",         0],
    ["ff_appointment_source", "Appointment vs Walk-in Tracking", "Show appointment/walk-in split on dashboard", 1],
  ];
  for (const [key, name, desc, enabled] of defaultFlags) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO feature_flags (id, feature_key, name, description, org_id, is_enabled, rollout_percent, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, 100, ?, ?)`,
      args: [`ff_global_${key}`, key, name, desc, enabled, now, now],
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

main().catch(e => { console.error("Setup failed:", e.message); process.exit(1); });
