-- Add linked_treatment_id to visit_items so treatment paidAmount can be
-- reversed correctly when a TREATMENT item is deleted.
-- SQLite cannot ALTER COLUMN enum constraints, so the category check is
-- enforced at the application layer (Zod schema); the column stays TEXT.
ALTER TABLE visit_items ADD COLUMN linked_treatment_id TEXT REFERENCES treatments(id);
