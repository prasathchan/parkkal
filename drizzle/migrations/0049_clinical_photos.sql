-- Clinical photos: before/after/progress images for visits and treatment plans.
-- Separate from `attachments` (documents) — images only, with role and type metadata.
CREATE TABLE IF NOT EXISTS clinical_photos (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  visit_id        TEXT NOT NULL REFERENCES visits(id),
  patient_id      TEXT NOT NULL REFERENCES patients(id),
  treatment_id    TEXT REFERENCES treatments(id),
  photo_role      TEXT NOT NULL DEFAULT 'UNTAGGED'
                  CHECK(photo_role IN ('BEFORE','AFTER','PROGRESS','UNTAGGED')),
  photo_type      TEXT NOT NULL DEFAULT 'INTRA_ORAL'
                  CHECK(photo_type IN ('INTRA_ORAL','EXTRA_ORAL','FULL_FACE','PANORAMIC','OTHER')),
  file_name       TEXT NOT NULL,
  original_name   TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  file_size       INTEGER NOT NULL,
  file_url        TEXT NOT NULL,
  notes           TEXT,
  uploaded_by     TEXT NOT NULL REFERENCES users(id),
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clinical_photos_visit
  ON clinical_photos(visit_id);

CREATE INDEX IF NOT EXISTS idx_clinical_photos_treatment
  ON clinical_photos(treatment_id)
  WHERE treatment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_photos_patient_role
  ON clinical_photos(patient_id, photo_role);
