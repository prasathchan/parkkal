CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  visit_code TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  doctor_id TEXT NOT NULL REFERENCES users(id),
  visit_date TEXT NOT NULL,
  chief_complaint TEXT,
  doctor_notes TEXT,
  diagnosis TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','COMPLETED','CANCELLED')),
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS visit_items (
  id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL REFERENCES visits(id),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'OTHER' CHECK(category IN ('MEDICINE','PROCEDURE','XRAY','CONSULTATION','OTHER')),
  tooth_number TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL REFERENCES visits(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'CASH' CHECK(payment_method IN ('CASH','CARD','UPI','BANK_TRANSFER')),
  reference_number TEXT,
  notes TEXT,
  paid_at INTEGER NOT NULL,
  recorded_by TEXT NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL REFERENCES visits(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'OTHER' CHECK(file_type IN ('XRAY','PRESCRIPTION','DOCTOR_NOTE','LAB_REPORT','OTHER')),
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
