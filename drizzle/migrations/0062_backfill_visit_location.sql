-- Migration 0062: Backfill location_id on visits and appointments created after 0059
--
-- 0059 set location_id for all rows that existed at migration time. Any visits or
-- appointments created after that (while the new-visit form was not sending locationId)
-- may still be NULL. This migration fills those gaps.
--
-- Safety rule: only backfill orgs that have exactly ONE active location.
-- Multi-branch orgs are skipped — we cannot know which branch an old untagged
-- row belongs to, so we leave them NULL rather than guess wrong.
-- For those orgs, staff will need to tag records manually once the fix is live.

UPDATE visits
SET location_id = (
  SELECT l.id FROM locations l
  WHERE l.organization_id = visits.organization_id
    AND l.is_default = 1
  LIMIT 1
)
WHERE location_id IS NULL
  AND (
    SELECT COUNT(*) FROM locations l
    WHERE l.organization_id = visits.organization_id
      AND l.is_active = 1
  ) = 1;

UPDATE appointments
SET location_id = (
  SELECT l.id FROM locations l
  WHERE l.organization_id = appointments.organization_id
    AND l.is_default = 1
  LIMIT 1
)
WHERE location_id IS NULL
  AND (
    SELECT COUNT(*) FROM locations l
    WHERE l.organization_id = appointments.organization_id
      AND l.is_active = 1
  ) = 1;
