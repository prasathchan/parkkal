-- Add theme_config column to organizations (was in schema but missing from migrations)
ALTER TABLE organizations ADD COLUMN theme_config TEXT;
