-- Multi-tenant migration

-- New table: organizations
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Add new columns to users (SQLite: must add one at a time)
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN date_of_birth TEXT;
ALTER TABLE users ADD COLUMN gender TEXT;
ALTER TABLE users ADD COLUMN address TEXT;
ALTER TABLE users ADD COLUMN pan_number TEXT;
ALTER TABLE users ADD COLUMN aadhaar_number TEXT;
ALTER TABLE users ADD COLUMN profile_image_url TEXT;
ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN updated_at INTEGER;

-- New table: organization_members
CREATE TABLE IF NOT EXISTS organization_members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('ADMIN','DOCTOR','NURSE','RECEPTIONIST','ATTENDANT','HELPER')),
  salary_type TEXT NOT NULL DEFAULT 'FIXED' CHECK (salary_type IN ('FIXED','PER_APPOINTMENT')),
  salary_amount REAL NOT NULL DEFAULT 0,
  joined_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(organization_id, user_id)
);

-- Add new columns to patients
ALTER TABLE patients ADD COLUMN pan_number TEXT;
ALTER TABLE patients ADD COLUMN aadhaar_number TEXT;
ALTER TABLE patients ADD COLUMN emergency_contact_added INTEGER NOT NULL DEFAULT 0;

-- New table: organization_patients
CREATE TABLE IF NOT EXISTS organization_patients (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  patient_code TEXT NOT NULL,
  registered_at INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(organization_id, patient_id),
  UNIQUE(organization_id, patient_code)
);

-- New table: emergency_contacts
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('USER','PATIENT')),
  entity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  created_at INTEGER NOT NULL
);

-- Add organizationId to visits
ALTER TABLE visits ADD COLUMN organization_id TEXT REFERENCES organizations(id);

-- Add organizationId to appointments
ALTER TABLE appointments ADD COLUMN organization_id TEXT REFERENCES organizations(id);

-- Add organizationId to treatments
ALTER TABLE treatments ADD COLUMN organization_id TEXT REFERENCES organizations(id);

-- Add organizationId to invoices
ALTER TABLE invoices ADD COLUMN organization_id TEXT REFERENCES organizations(id);

-- New table: salary_records
CREATE TABLE IF NOT EXISTS salary_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  month TEXT NOT NULL,
  salary_amount REAL NOT NULL,
  salary_type TEXT NOT NULL CHECK (salary_type IN ('FIXED','PER_APPOINTMENT')),
  appointment_count INTEGER NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  paid_at INTEGER,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PARTIAL','PAID')),
  notes TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(organization_id, user_id, month)
);

-- Seed: Insert default organization
INSERT OR IGNORE INTO organizations (id, name, slug, phone, email, is_active, created_at, updated_at)
VALUES ('org_parkkal', 'Parkkal Dental Clinic', 'parkkal', '', 'admin@parkkal.com', 1, unixepoch() * 1000, unixepoch() * 1000);

-- Seed: Link admin user to org as ADMIN
INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role, salary_type, salary_amount, joined_at, is_active, created_at)
VALUES ('om_admin_001', 'org_parkkal', 'usr_admin_001', 'ADMIN', 'FIXED', 0, date('now'), 1, unixepoch() * 1000);

-- Update existing visits to belong to org
UPDATE visits SET organization_id = 'org_parkkal' WHERE organization_id IS NULL;

-- Update existing appointments to belong to org
UPDATE appointments SET organization_id = 'org_parkkal' WHERE organization_id IS NULL;

-- Update existing treatments to belong to org
UPDATE treatments SET organization_id = 'org_parkkal' WHERE organization_id IS NULL;

-- Update existing invoices to belong to org
UPDATE invoices SET organization_id = 'org_parkkal' WHERE organization_id IS NULL;

-- Link existing patients to org
INSERT OR IGNORE INTO organization_patients (id, organization_id, patient_id, patient_code, registered_at, is_active)
SELECT 
  'op_' || id,
  'org_parkkal',
  id,
  patient_code,
  created_at,
  1
FROM patients;
