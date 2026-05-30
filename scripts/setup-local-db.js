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
  `CREATE TABLE IF NOT EXISTS organization_members (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK (role IN ('ADMIN','DOCTOR','NURSE','RECEPTIONIST','ATTENDANT','HELPER')),
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
];

async function main() {
  const client = createClient({ url: "file:local.db" });
  const now = Date.now();

  console.log("Creating tables...");
  for (const sql of SQL) {
    await client.execute(sql);
  }

  console.log("Seeding data...");
  const hash = await bcrypt.hash("Admin@123", 10);

  await client.execute({
    sql: `INSERT OR IGNORE INTO organizations (id,name,slug,phone,email,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)`,
    args: ["org_parkkal","Parkkal Dental Clinic","parkkal","+91 9876543210","admin@parkkal.com",now,now],
  });

  await client.execute({
    sql: `INSERT OR IGNORE INTO users (id,name,email,password_hash,is_active,created_at) VALUES (?,?,?,?,1,?)`,
    args: ["usr_admin_001","Admin User","admin@parkkal.com",hash,now],
  });

  await client.execute({
    sql: `INSERT OR IGNORE INTO organization_members (id,organization_id,user_id,role,salary_type,salary_amount,joined_at,is_active,created_at) VALUES (?,?,?,?,?,?,?,1,?)`,
    args: ["om_admin_001","org_parkkal","usr_admin_001","ADMIN","FIXED",0,new Date().toISOString().split("T")[0],now],
  });

  console.log("✅ Database ready at ./local.db");
  console.log("👤 Login: admin@parkkal.com / Admin@123");
  console.log("🏥 Org:   Parkkal Dental Clinic");
  client.close();
}

main().catch(e => { console.error("Setup failed:", e.message); process.exit(1); });
