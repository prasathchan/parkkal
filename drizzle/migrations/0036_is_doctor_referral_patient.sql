-- Add is_doctor flag to organization_members (opt-in for admins to appear in doctor dropdown)
ALTER TABLE organization_members ADD COLUMN is_doctor INTEGER NOT NULL DEFAULT 0;

-- Add referred_by_patient_id to patients (patient-to-patient referral)
ALTER TABLE patients ADD COLUMN referred_by_patient_id TEXT REFERENCES patients(id);
