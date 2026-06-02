-- Update admin password to new secure hash
UPDATE users SET password_hash = '$2a$10$yKyx8VFyx8P98yvgze2uDOOgj7S0wufIUYSDdw6Kg2Jsq13JET0jC' WHERE id = 'usr_admin_001';
