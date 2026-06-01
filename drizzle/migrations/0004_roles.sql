-- Migration: Add org_roles table and org_role_id to organization_members

CREATE TABLE IF NOT EXISTS org_roles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  is_system INTEGER NOT NULL DEFAULT 0,
  permissions TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE(organization_id, slug)
);

ALTER TABLE organization_members ADD COLUMN org_role_id TEXT REFERENCES org_roles(id);
