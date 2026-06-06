-- SQLite cannot ALTER a CHECK constraint on an existing column.
-- Recreate visit_items with the updated category enum that includes TREATMENT.
-- All existing rows and the new linked_treatment_id column are preserved.
PRAGMA foreign_keys = OFF;

CREATE TABLE visit_items_new (
  id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL REFERENCES visits(id),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'OTHER' CHECK(category IN ('MEDICINE','PROCEDURE','XRAY','CONSULTATION','TREATMENT','OTHER')),
  tooth_number TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  linked_treatment_id TEXT REFERENCES treatments(id),
  created_at INTEGER NOT NULL
);

INSERT INTO visit_items_new SELECT id, visit_id, item_name, category, tooth_number, quantity, unit_price, amount, notes, linked_treatment_id, created_at FROM visit_items;

DROP TABLE visit_items;

ALTER TABLE visit_items_new RENAME TO visit_items;

PRAGMA foreign_keys = ON;
