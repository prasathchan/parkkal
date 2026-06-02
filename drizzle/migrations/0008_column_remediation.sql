-- Add remaining missing columns on treatments table
ALTER TABLE treatments ADD COLUMN visit_id TEXT REFERENCES visits(id);
ALTER TABLE treatments ADD COLUMN status TEXT NOT NULL DEFAULT 'PLANNED';
