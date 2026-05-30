CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL UNIQUE,
  `password_hash` text NOT NULL,
  `role` text NOT NULL DEFAULT 'RECEPTIONIST' CHECK (`role` IN ('ADMIN','DOCTOR','RECEPTIONIST')),
  `created_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `patients` (
  `id` text PRIMARY KEY NOT NULL,
  `patient_code` text NOT NULL UNIQUE,
  `name` text NOT NULL,
  `phone` text NOT NULL,
  `email` text,
  `date_of_birth` text,
  `gender` text,
  `address` text,
  `medical_history` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `appointments` (
  `id` text PRIMARY KEY NOT NULL,
  `patient_id` text NOT NULL REFERENCES `patients`(`id`),
  `doctor_id` text NOT NULL REFERENCES `users`(`id`),
  `appointment_date` text NOT NULL,
  `appointment_time` text NOT NULL,
  `status` text NOT NULL DEFAULT 'SCHEDULED' CHECK (`status` IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
  `type` text NOT NULL DEFAULT 'CONSULTATION' CHECK (`type` IN ('CONSULTATION','CHECKUP','TREATMENT','FOLLOWUP')),
  `notes` text,
  `created_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `treatments` (
  `id` text PRIMARY KEY NOT NULL,
  `patient_id` text NOT NULL REFERENCES `patients`(`id`),
  `appointment_id` text REFERENCES `appointments`(`id`),
  `doctor_id` text NOT NULL REFERENCES `users`(`id`),
  `description` text NOT NULL,
  `tooth_numbers` text,
  `procedure` text,
  `cost` real NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `invoices` (
  `id` text PRIMARY KEY NOT NULL,
  `patient_id` text NOT NULL REFERENCES `patients`(`id`),
  `total_amount` real NOT NULL,
  `paid_amount` real NOT NULL DEFAULT 0,
  `status` text NOT NULL DEFAULT 'PENDING' CHECK (`status` IN ('PENDING','PARTIAL','PAID')),
  `notes` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `invoice_treatments` (
  `invoice_id` text NOT NULL REFERENCES `invoices`(`id`),
  `treatment_id` text NOT NULL REFERENCES `treatments`(`id`),
  PRIMARY KEY (`invoice_id`, `treatment_id`)
);

-- Seed admin user (password: Admin@123)
INSERT OR IGNORE INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `created_at`)
VALUES (
  'usr_admin_001',
  'Admin User',
  'admin@parkkal.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'ADMIN',
  unixepoch() * 1000
);
