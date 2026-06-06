-- Fix permission string mismatch introduced during initial role seeding.
--
-- default-roles.ts previously used non-canonical strings ("billing.manage",
-- "settings.manage") that don't match the PERMISSIONS constants checked by
-- API routes ("billing.create", "billing.edit", "org.settings").
-- Any staff member with orgRoleId set was getting 403 on billing operations.
--
-- This migration repairs existing org_roles rows in-place via JSON string
-- replacement. The replacements are idempotent — running twice is safe.

UPDATE org_roles
SET permissions = REPLACE(permissions, '"billing.manage"', '"billing.create","billing.edit"')
WHERE permissions LIKE '%"billing.manage"%';

UPDATE org_roles
SET permissions = REPLACE(permissions, '"settings.manage"', '"org.settings"')
WHERE permissions LIKE '%"settings.manage"%';
