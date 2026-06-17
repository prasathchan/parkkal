-- Add planned_sessions to treatments table
-- Allows "Session X of Y" display on treatment detail and visit tab.
ALTER TABLE treatments ADD COLUMN planned_sessions INTEGER DEFAULT NULL;
