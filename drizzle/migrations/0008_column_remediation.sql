-- Add missing columns to existing tables (continued schema drift remediation)

-- visits: add organization_id
ALTER TABLE visits ADD COLUMN organization_id TEXT REFERENCES organizations(id);

-- treatments: add organization_id
ALTER TABLE treatments ADD COLUMN organization_id TEXT REFERENCES organizations(id);

-- treatments: add visit_id
ALTER TABLE treatments ADD COLUMN visit_id TEXT REFERENCES visits(id);

-- treatments: add status
ALTER TABLE treatments ADD COLUMN status TEXT NOT NULL DEFAULT 'PLANNED';

-- appointments: add organization_id
ALTER TABLE appointments ADD COLUMN organization_id TEXT REFERENCES organizations(id);

-- invoices: add organization_id
ALTER TABLE invoices ADD COLUMN organization_id TEXT REFERENCES organizations(id);

-- invoices: add notes
ALTER TABLE invoices ADD COLUMN notes TEXT;
