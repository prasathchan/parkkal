-- 0057_staff_location_assignments.sql
-- Tracks which staff members work at which branches.

CREATE TABLE IF NOT EXISTS staff_location_assignments (
  id              TEXT PRIMARY KEY NOT NULL,
  user_id         TEXT NOT NULL REFERENCES users(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  location_id     TEXT NOT NULL REFERENCES locations(id),
  is_primary      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  UNIQUE(user_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_sla_org_location ON staff_location_assignments(organization_id, location_id);
CREATE INDEX IF NOT EXISTS idx_sla_user ON staff_location_assignments(user_id);
