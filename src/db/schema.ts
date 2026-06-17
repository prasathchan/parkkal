/**
 * db/schema.ts
 *
 * The DATABASE BLUEPRINT — every table, every column, every relationship.
 *
 * ─── QUICK MAP ───────────────────────────────────────────────────────────────
 *
 *  organizations       → The dental clinic itself (one per deployment)
 *  users               → Every person with a login (staff + clinic owner)
 *  organizationMembers → Links users to their clinic + stores role/salary
 *  orgRoles            → Custom roles with permission lists (e.g. "Head Nurse")
 *  patients            → Patient records (name, phone, DOB, medical history)
 *  organizationPatients → Links patients to their clinic (many-to-many)
 *  appointments             → Scheduled appointments
 *  appointmentReminders     → Scheduled SMS/WhatsApp/Email reminders for appointments
 *  visits              → Actual clinic visits (walk-in or from appointment)
 *  visitItems          → Bill line items on a visit (medicines, procedures, etc.)
 *  payments            → Cash/UPI/Card payments recorded on a visit
 *  prescriptions       → Medicines prescribed during a visit
 *  attachments         → X-rays, lab reports, etc. uploaded to a visit
 *  treatments          → Multi-session treatment plans (e.g. root canal, braces)
 *  visitTreatments     → Links a treatment plan to a specific visit
 *  invoices            → Formal invoices generated for a patient
 *  salaryRecords       → Monthly salary calculations for staff
 *  verificationTokens  → OTP codes for email/phone verification
 *  emergencyContacts   → Emergency contact persons for patients and staff
 *  consentAuditLog     → Audit trail of who gave consent for treatments
 *
 * ─── KEY RELATIONSHIPS ───────────────────────────────────────────────────────
 *
 *  visit → visitItems     (a visit has many bill items)
 *  visit → payments       (a visit has many payments)
 *  visit → prescriptions  (a visit has many prescriptions)
 *  visit → visitTreatments → treatments  (a visit links to treatment plans)
 *  visitItem.linkedTreatmentId → treatment  (payment towards a treatment plan)
 *
 * ─── HOW TO ADD A NEW TABLE ──────────────────────────────────────────────────
 *
 *  1. Define it here with sqliteTable()
 *  2. Create a migration file in drizzle/migrations/NNNN_description.sql
 *  3. Run: npx wrangler d1 execute parkkal-db --local --file=drizzle/migrations/NNNN_...sql
 *  4. Update src/types/ with the matching TypeScript interface
 *
 * ─── D1 LIMITATIONS TO KNOW ─────────────────────────────────────────────────
 *
 *  - No ALTER COLUMN — to change a column type, recreate the table
 *  - No multi-statement transactions in the batch API — use sequential awaits
 *  - CHECK constraints ARE enforced — adding an enum value needs table recreation
 */
import { sqliteTable, text, real, integer, primaryKey, unique, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  slug: text("slug").notNull().unique(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  logoUrl: text("logo_url"),
  themeConfig: text("theme_config"),
  gstin: text("gstin"),                          // 15-char GST Identification Number
  gstRegistered: integer("gst_registered").notNull().default(0),
  gstStateCode: text("gst_state_code"),          // 2-digit state code e.g. "33" for Tamil Nadu
  cgstRate: real("cgst_rate").notNull().default(9),
  sgstRate: real("sgst_rate").notNull().default(9),
  isActive: integer("is_active").notNull().default(1),
  scheduledDeleteAt: integer("scheduled_delete_at"),
  onboardingDismissedAt: integer("onboarding_dismissed_at"),
  dpaVersion: text("dpa_version"),
  dpaAcceptedAt: integer("dpa_accepted_at"),
  dpaAcceptedBy: text("dpa_accepted_by"),
  dataRetentionYears: integer("data_retention_years").notNull().default(7),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender"),
  address: text("address"),
  panNumber: text("pan_number"),
  aadhaarNumber: text("aadhaar_number"),
  profileImageUrl: text("profile_image_url"),
  isActive: integer("is_active").notNull().default(1),
  isVerified: integer("is_verified").notNull().default(0),
  isSuperAdmin: integer("is_super_admin").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at"),
});

export const orgRoles = sqliteTable("org_roles", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#0B6E6E"),
  isSystem: integer("is_system").notNull().default(0),
  permissions: text("permissions").notNull().default("[]"),
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
}, (t) => ({
  uniqOrgSlug: unique().on(t.organizationId, t.slug),
}));

export const organizationMembers = sqliteTable("organization_members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role", { enum: ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "ATTENDANT", "HELPER"] }).notNull(),
  orgRoleId: text("org_role_id").references(() => orgRoles.id),
  salaryType: text("salary_type", { enum: ["FIXED", "PER_APPOINTMENT"] }).notNull().default("FIXED"),
  salaryAmount: real("salary_amount").notNull().default(0),
  joinedAt: text("joined_at"),
  isActive: integer("is_active").notNull().default(1),
  portalAccess: integer("portal_access").notNull().default(0),
  isDoctor: integer("is_doctor").notNull().default(0),
  createdAt: integer("created_at").notNull(),
}, (t) => ({
  uniqOrgUser: unique().on(t.organizationId, t.userId),
}));

export const patients = sqliteTable("patients", {
  id: text("id").primaryKey(),
  patientCode: text("patient_code").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender"),
  address: text("address"),
  medicalHistory: text("medical_history"),
  bloodGroup: text("blood_group"),
  panNumber: text("pan_number"),
  aadhaarNumber: text("aadhaar_number"),
  emergencyContactAdded: integer("emergency_contact_added").notNull().default(0),
  referralSource: text("referral_source"),
  referredByPatientId: text("referred_by_patient_id").references((): AnySQLiteColumn => patients.id),
  dataConsentAt: integer("data_consent_at"),
  dataConsentIp: text("data_consent_ip"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const organizationPatients = sqliteTable("organization_patients", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  patientId: text("patient_id").notNull().references(() => patients.id),
  patientCode: text("patient_code").notNull(),
  registeredAt: integer("registered_at").notNull(),
  isActive: integer("is_active").notNull().default(1),
}, (t) => ({
  uniqOrgPatient: unique().on(t.organizationId, t.patientId),
  uniqOrgCode: unique().on(t.organizationId, t.patientCode),
}));

export const emergencyContacts = sqliteTable("emergency_contacts", {
  id: text("id").primaryKey(),
  entityType: text("entity_type", { enum: ["USER", "PATIENT"] }).notNull(),
  entityId: text("entity_id").notNull(),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address"),
  createdAt: integer("created_at").notNull(),
});

export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  patientId: text("patient_id").notNull().references(() => patients.id),
  doctorId: text("doctor_id").notNull().references(() => users.id),
  appointmentDate: text("appointment_date").notNull(),
  appointmentTime: text("appointment_time").notNull(),
  status: text("status", {
    enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  }).notNull().default("SCHEDULED"),
  type: text("type", {
    enum: ["CONSULTATION", "CHECKUP", "TREATMENT", "FOLLOWUP"],
  }).notNull().default("CONSULTATION"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
});

// ─── Appointment reminders ────────────────────────────────────────────────────
// One row per scheduled notification. The cron job reads PENDING rows whose
// scheduled_at has passed and delivers them via SMS, WhatsApp, or Email.
export const appointmentReminders = sqliteTable("appointment_reminders", {
  id:             text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  appointmentId:  text("appointment_id").notNull().references(() => appointments.id),
  patientId:      text("patient_id").notNull().references(() => patients.id),
  /** Delivery channel */
  channel:        text("channel", { enum: ["SMS", "WHATSAPP", "EMAIL"] }).notNull(),
  /** Unix ms — when the cron job should deliver this reminder */
  scheduledAt:    integer("scheduled_at").notNull(),
  sentAt:         integer("sent_at"),
  status:         text("status", { enum: ["PENDING", "SENT", "FAILED", "CANCELLED"] }).notNull().default("PENDING"),
  errorMessage:   text("error_message"),
  /** Pre-rendered message text — snapshotted at schedule time */
  message:        text("message").notNull(),
  /** Which timing slot: 24H before, 2H before, or 1H before */
  reminderType:   text("reminder_type", { enum: ["24H", "2H", "1H"] }).notNull(),
  createdAt:      integer("created_at").notNull(),
});

export const treatments = sqliteTable("treatments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  patientId: text("patient_id").notNull().references(() => patients.id),
  appointmentId: text("appointment_id").references(() => appointments.id),
  doctorId: text("doctor_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  toothNumbers: text("tooth_numbers"),
  procedure: text("procedure"),
  cost: real("cost").notNull().default(0),
  status: text("status", { enum: ["PLANNED", "IN_PROGRESS", "COMPLETED"] }).notNull().default("PLANNED"),
  consentStatus: text("consent_status", { enum: ["PENDING", "UPLOADED", "VERIFIED", "REJECTED", "EMERGENCY_OVERRIDE"] }).notNull().default("PENDING"),
  consentDocumentUrl: text("consent_document_url"),
  consentDocumentName: text("consent_document_name"),
  consentUploadedAt: integer("consent_uploaded_at"),
  consentVerifiedAt: integer("consent_verified_at"),
  consentNotes: text("consent_notes"),
  emergencyOverride: integer("emergency_override").notNull().default(0),
  emergencyReason: text("emergency_reason"),
  plannedSessions: integer("planned_sessions"),
  createdAt: integer("created_at").notNull(),
});

export const prescriptions = sqliteTable("prescriptions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  visitId: text("visit_id").notNull().references(() => visits.id),
  patientId: text("patient_id").notNull().references(() => patients.id),
  doctorId: text("doctor_id").notNull().references(() => users.id),
  medicines: text("medicines").notNull(), // JSON array of { name, dosage, frequency, duration, notes }
  instructions: text("instructions"),
  createdAt: integer("created_at").notNull(),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  patientId: text("patient_id").notNull().references(() => patients.id),
  totalAmount: real("total_amount").notNull(),
  paidAmount: real("paid_amount").notNull().default(0),
  status: text("status", {
    enum: ["PENDING", "PARTIAL", "PAID"],
  }).notNull().default("PENDING"),
  notes: text("notes"),
  // GST fields (India)
  gstEnabled: integer("gst_enabled").notNull().default(0),
  isInterState: integer("is_inter_state").notNull().default(0),
  taxableAmount: real("taxable_amount"),
  cgstRate: real("cgst_rate").notNull().default(9),
  sgstRate: real("sgst_rate").notNull().default(9),
  igstRate: real("igst_rate").notNull().default(18),
  cgstAmount: real("cgst_amount"),
  sgstAmount: real("sgst_amount"),
  igstAmount: real("igst_amount"),
  sacCode: text("sac_code").notNull().default("999312"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const invoiceTreatments = sqliteTable(
  "invoice_treatments",
  {
    invoiceId: text("invoice_id").notNull().references(() => invoices.id),
    treatmentId: text("treatment_id").notNull().references(() => treatments.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.invoiceId, t.treatmentId] }),
  })
);

export const salaryRecords = sqliteTable("salary_records", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  userId: text("user_id").notNull().references(() => users.id),
  month: text("month").notNull(),
  salaryAmount: real("salary_amount").notNull(),
  salaryType: text("salary_type", { enum: ["FIXED", "PER_APPOINTMENT"] }).notNull(),
  appointmentCount: integer("appointment_count").notNull().default(0),
  paidAmount: real("paid_amount").notNull().default(0),
  paidAt: integer("paid_at"),
  status: text("status", { enum: ["PENDING", "PARTIAL", "PAID"] }).notNull().default("PENDING"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
}, (t) => ({
  uniqOrgUserMonth: unique().on(t.organizationId, t.userId, t.month),
}));

export const visits = sqliteTable("visits", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  visitCode: text("visit_code").notNull().unique(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  doctorId: text("doctor_id").notNull().references(() => users.id),
  visitDate: text("visit_date").notNull(),
  chiefComplaint: text("chief_complaint"),
  doctorNotes: text("doctor_notes"),
  diagnosis: text("diagnosis"),
  appointmentId: text("appointment_id").references(() => appointments.id),
  visitType: text("visit_type", { enum: ["APPOINTMENT", "WALKIN"] }).notNull().default("WALKIN"),
  status: text("status", { enum: ["OPEN", "COMPLETED", "CANCELLED"] }).notNull().default("OPEN"),
  totalAmount: real("total_amount").notNull().default(0),
  paidAmount: real("paid_amount").notNull().default(0),
  recallDate: text("recall_date"),              // YYYY-MM-DD — when the patient should return
  recallNotes: text("recall_notes"),            // e.g. "6-month checkup", "review root canal"
  recallAppointmentId: text("recall_appointment_id").references(() => appointments.id), // set when recall is booked
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// Junction table — a treatment plan can be worked on across many visits
// and a visit can address many treatment plans.
export const visitTreatments = sqliteTable(
  "visit_treatments",
  {
    visitId: text("visit_id").notNull().references(() => visits.id),
    treatmentId: text("treatment_id").notNull().references(() => treatments.id),
    notes: text("notes"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.visitId, t.treatmentId] }),
  })
);

export const treatmentTemplates = sqliteTable("treatment_templates", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  procedure: text("procedure"),
  defaultCost: real("default_cost").notNull().default(0),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull(),
});

export const visitItems = sqliteTable("visit_items", {
  id: text("id").primaryKey(),
  visitId: text("visit_id").notNull().references(() => visits.id),
  itemName: text("item_name").notNull(),
  category: text("category", { enum: ["MEDICINE", "PROCEDURE", "XRAY", "CONSULTATION", "TREATMENT", "OTHER"] }).notNull().default("OTHER"),
  toothNumber: text("tooth_number"),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull().default(0),
  amount: real("amount").notNull().default(0),
  notes: text("notes"),
  linkedTreatmentId: text("linked_treatment_id").references(() => treatments.id),
  createdAt: integer("created_at").notNull(),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  visitId: text("visit_id").notNull().references(() => visits.id),
  patientId: text("patient_id").notNull().references(() => patients.id),
  // null = general visit payment; set = attributed to a specific treatment plan
  treatmentId: text("treatment_id").references(() => treatments.id),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method", { enum: ["CASH", "CARD", "UPI", "BANK_TRANSFER"] }).notNull().default("CASH"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  paidAt: integer("paid_at").notNull(),
  recordedBy: text("recorded_by").notNull().references(() => users.id),
});

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  visitId: text("visit_id").notNull().references(() => visits.id),
  patientId: text("patient_id").notNull().references(() => patients.id),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileType: text("file_type", { enum: ["XRAY", "PRESCRIPTION", "DOCTOR_NOTE", "LAB_REPORT", "OTHER"] }).notNull().default("OTHER"),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileUrl: text("file_url").notNull(),
  uploadedBy: text("uploaded_by").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull(),
});

export const verificationTokens = sqliteTable("verification_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type", { enum: ["EMAIL", "PHONE", "STAFF_INVITE", "PHONE_OTP", "PASSWORD_RESET"] }).notNull(),
  code: text("code").notNull(),
  expiresAt: integer("expires_at").notNull(),
  used: integer("used").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const adminAuditLog = sqliteTable("admin_audit_log", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  actorId: text("actor_id").notNull(),
  actorRole: text("actor_role").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  metadata: text("metadata"), // JSON string
  createdAt: integer("created_at").notNull(),
});

/**
 * revoked_tokens — explicit JWT revocation list.
 * A token whose jti matches a row here is rejected even if the signature is valid.
 * Rows expire naturally (safe to delete once expires_at < now()).
 */
export const revokedTokens = sqliteTable("revoked_tokens", {
  jti:       text("jti").primaryKey(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at").notNull(),
});

/**
 * appLogs — self-hosted error & security event capture.
 * Written by withRoute() for 'error', 'security', and 'warn' level events.
 * Readable by ADMIN users via GET /api/admin/app-logs.
 */
export const appLogs = sqliteTable("app_logs", {
  id:             text("id").primaryKey(),
  level:          text("level").notNull(),          // 'error' | 'security' | 'warn'
  route:          text("route").notNull(),
  message:        text("message").notNull(),
  organizationId: text("organization_id"),          // nullable — pre-auth errors have no session
  userId:         text("user_id"),
  userRole:       text("user_role"),
  errorName:      text("error_name"),
  errorStack:     text("error_stack"),
  data:           text("data"),                     // JSON string
  createdAt:      integer("created_at").notNull(),
});

// ─── Calendar integrations ────────────────────────────────────────────────────
// OAuth tokens for staff who have connected their Google or Outlook calendar.
// Tokens are stored encrypted. See lib/calendar-sync.ts for push logic.
export const calendarIntegrations = sqliteTable("calendar_integrations", {
  id:             text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  userId:         text("user_id").notNull().references(() => users.id),
  provider:       text("provider", { enum: ["GOOGLE", "OUTLOOK"] }).notNull(),
  accessToken:    text("access_token").notNull(),   // encrypted
  refreshToken:   text("refresh_token").notNull(),  // encrypted
  expiresAt:      integer("expires_at").notNull(),  // Unix ms
  calendarId:     text("calendar_id"),              // null = primary calendar
  eventIdMap:     text("event_id_map").notNull().default("{}"), // JSON: { appointmentId → externalEventId }
  isActive:       integer("is_active").notNull().default(1),
  createdAt:      integer("created_at").notNull(),
  updatedAt:      integer("updated_at").notNull(),
});

// ─── Tooth Chart ─────────────────────────────────────────────────────────────
// One row per patient per organisation. tooth_data is a JSON object keyed by
// FDI tooth number (e.g. "11") with condition + notes per tooth.
export const toothChart = sqliteTable("tooth_chart", {
  id:             text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  patientId:      text("patient_id").notNull().references(() => patients.id),
  toothData:      text("tooth_data").notNull().default("{}"), // JSON: Record<string, { condition, notes? }>
  updatedAt:      integer("updated_at").notNull(),
  updatedBy:      text("updated_by").notNull().references(() => users.id),
}, (t) => ({
  uniqOrgPatient: unique().on(t.organizationId, t.patientId),
}));

// ─── Tooth Chart History ──────────────────────────────────────────────────────
// Full snapshot written every time the cumulative chart is saved.
// visit_id is nullable — direct edits from the patient page are still tracked.
// source distinguishes manual doctor edits from treatment-driven saves.
export const toothChartHistory = sqliteTable("tooth_chart_history", {
  id:             text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  patientId:      text("patient_id").notNull().references(() => patients.id),
  visitId:        text("visit_id").references(() => visits.id),
  toothData:      text("tooth_data").notNull(),              // JSON full snapshot
  changedTeeth:   text("changed_teeth").notNull().default("[]"), // JSON string[]
  source:         text("source").notNull().default("manual"), // "manual" | "treatment_start" | "treatment_complete"
  recordedBy:     text("recorded_by").notNull().references(() => users.id),
  recordedAt:     integer("recorded_at").notNull(),
});

// ─── Tooth Condition History ──────────────────────────────────────────────────
// Per-tooth condition change log. One row per tooth per change event.
// Complements tooth_chart_history (which stores full snapshots) — this table is
// queryable per tooth and links changes to the treatment that caused them.
// source values:
//   "manual"             — doctor edited the chart directly
//   "treatment_start"    — chart updated when treatment moved to IN_PROGRESS
//   "treatment_complete" — chart updated when treatment was marked COMPLETED
export const toothConditionHistory = sqliteTable("tooth_condition_history", {
  id:                text("id").primaryKey(),
  organizationId:    text("organization_id").notNull().references(() => organizations.id),
  patientId:         text("patient_id").notNull().references(() => patients.id),
  toothNumber:       text("tooth_number").notNull(),
  previousCondition: text("previous_condition"),              // null = first recorded condition
  newCondition:      text("new_condition").notNull(),
  visitId:           text("visit_id").references(() => visits.id),
  treatmentId:       text("treatment_id").references(() => treatments.id),
  source:            text("source").notNull().default("manual"),
  recordedBy:        text("recorded_by").notNull().references(() => users.id),
  recordedAt:        integer("recorded_at").notNull(),
});

// ─── Patient code sequences ───────────────────────────────────────────────────
// Atomic counters for patient code generation. Replaces SELECT COUNT(*) which
// produces duplicate codes under concurrent inserts.
// scope='global'         → PKL-XXXXXX (cross-org code)
// scope='org:{slug}'     → {ORG}-XXXX (per-org display code)
export const patientCodeSequences = sqliteTable("patient_code_sequences", {
  scope:     text("scope").primaryKey(),
  lastSeq:   integer("last_seq").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

export const consentAuditLog = sqliteTable("consent_audit_log", {
  id: text("id").primaryKey(),
  treatmentId: text("treatment_id").notNull().references(() => treatments.id),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  actorId: text("actor_id").notNull().references(() => users.id),
  actorRole: text("actor_role").notNull(),
  action: text("action").notNull(), // e.g. "EMERGENCY_OVERRIDE"
  reason: text("reason"),
  createdAt: integer("created_at").notNull(),
});

export const orgBackups = sqliteTable("org_backups", {
  id:             text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  type:           text("type", { enum: ["auto", "manual"] }).notNull(),
  status:         text("status", { enum: ["pending", "completed", "failed"] }).notNull().default("pending"),
  r2Key:          text("r2_key"),          // backups/{orgId}/{timestamp}_{type}.json.gz
  sizeBytes:      integer("size_bytes"),
  rowCounts:      text("row_counts"),      // JSON: { patients: 42, visits: 130, ... }
  errorMessage:   text("error_message"),
  createdBy:      text("created_by").references(() => users.id), // null = auto
  createdAt:      integer("created_at").notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIZZLE RELATIONS
//
// Declaring relations unlocks Drizzle's relational query API:
//   db.query.visits.findMany({ with: { items: true, payments: true } })
//
// These don't create foreign keys — they're metadata for the query builder only.
// The actual FK constraints are defined inline on each column above.
// ─────────────────────────────────────────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members:      many(organizationMembers),
  roles:        many(orgRoles),
  patients:     many(organizationPatients),
  appointments: many(appointments),
  visits:       many(visits),
  treatments:   many(treatments),
  invoices:     many(invoices),
  salaryRecords: many(salaryRecords),
  drugs:        many(orgDrugs),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships:   many(organizationMembers),
  verifications: many(verificationTokens),
}));

export const orgRolesRelations = relations(orgRoles, ({ one, many }) => ({
  organization: one(organizations, { fields: [orgRoles.organizationId], references: [organizations.id] }),
  members:      many(organizationMembers),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] }),
  user:         one(users,         { fields: [organizationMembers.userId],         references: [users.id] }),
  orgRole:      one(orgRoles,      { fields: [organizationMembers.orgRoleId],      references: [orgRoles.id] }),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  organizations: many(organizationPatients),
  appointments:  many(appointments),
  visits:        many(visits),
  treatments:    many(treatments),
  invoices:      many(invoices),
  emergencyContacts: many(emergencyContacts),
}));

export const organizationPatientsRelations = relations(organizationPatients, ({ one }) => ({
  organization: one(organizations, { fields: [organizationPatients.organizationId], references: [organizations.id] }),
  patient:      one(patients,      { fields: [organizationPatients.patientId],      references: [patients.id] }),
}));

export const emergencyContactsRelations = relations(emergencyContacts, ({ one }) => ({
  patient: one(patients, { fields: [emergencyContacts.entityId], references: [patients.id] }),
}));

export const appointmentRemindersRelations = relations(appointmentReminders, ({ one }) => ({
  organization: one(organizations, { fields: [appointmentReminders.organizationId], references: [organizations.id] }),
  appointment:  one(appointments,  { fields: [appointmentReminders.appointmentId],  references: [appointments.id] }),
  patient:      one(patients,      { fields: [appointmentReminders.patientId],       references: [patients.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  organization: one(organizations, { fields: [appointments.organizationId], references: [organizations.id] }),
  patient:      one(patients,      { fields: [appointments.patientId],      references: [patients.id] }),
  doctor:       one(users,         { fields: [appointments.doctorId],        references: [users.id] }),
  reminders:    many(appointmentReminders),
  visits:       many(visits),
}));

export const visitsRelations = relations(visits, ({ one, many }) => ({
  organization: one(organizations, { fields: [visits.organizationId], references: [organizations.id] }),
  patient:      one(patients,      { fields: [visits.patientId],      references: [patients.id] }),
  doctor:       one(users,         { fields: [visits.doctorId],        references: [users.id] }),
  appointment:  one(appointments,  { fields: [visits.appointmentId],   references: [appointments.id] }),
  items:        many(visitItems),
  payments:     many(payments),
  prescriptions: many(prescriptions),
  attachments:  many(attachments),
  treatments:   many(visitTreatments),
}));

export const visitTreatmentsRelations = relations(visitTreatments, ({ one }) => ({
  visit:     one(visits,     { fields: [visitTreatments.visitId],     references: [visits.id] }),
  treatment: one(treatments, { fields: [visitTreatments.treatmentId], references: [treatments.id] }),
}));

export const visitItemsRelations = relations(visitItems, ({ one }) => ({
  visit:     one(visits,     { fields: [visitItems.visitId],            references: [visits.id] }),
  treatment: one(treatments, { fields: [visitItems.linkedTreatmentId],  references: [treatments.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  visit:   one(visits,   { fields: [payments.visitId],   references: [visits.id] }),
  patient: one(patients, { fields: [payments.patientId], references: [patients.id] }),
}));

export const prescriptionsRelations = relations(prescriptions, ({ one }) => ({
  visit: one(visits, { fields: [prescriptions.visitId], references: [visits.id] }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  visit:   one(visits,   { fields: [attachments.visitId],   references: [visits.id] }),
  patient: one(patients, { fields: [attachments.patientId], references: [patients.id] }),
}));

// ─── Clinical photos (before/after) ───────────────────────────────────────────
// Distinct from `attachments` (which holds PDFs, X-rays, lab reports).
// These are image-only clinical photos tagged with a role (BEFORE/AFTER/PROGRESS)
// and optionally linked to a treatment plan for before/after comparison views.

export const clinicalPhotos = sqliteTable("clinical_photos", {
  id:             text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  visitId:        text("visit_id").notNull().references(() => visits.id),
  patientId:      text("patient_id").notNull().references(() => patients.id),
  treatmentId:    text("treatment_id").references(() => treatments.id),
  photoRole:      text("photo_role", { enum: ["BEFORE", "AFTER", "PROGRESS", "UNTAGGED"] }).notNull().default("UNTAGGED"),
  photoType:      text("photo_type", { enum: ["INTRA_ORAL", "EXTRA_ORAL", "FULL_FACE", "PANORAMIC", "OTHER"] }).notNull().default("INTRA_ORAL"),
  fileName:       text("file_name").notNull(),
  originalName:   text("original_name").notNull(),
  mimeType:       text("mime_type").notNull(),
  fileSize:       integer("file_size").notNull(),
  fileUrl:        text("file_url").notNull(),
  notes:          text("notes"),
  uploadedBy:     text("uploaded_by").notNull().references(() => users.id),
  createdAt:      integer("created_at").notNull(),
});

export const clinicalPhotosRelations = relations(clinicalPhotos, ({ one }) => ({
  organization: one(organizations, { fields: [clinicalPhotos.organizationId], references: [organizations.id] }),
  visit:        one(visits,        { fields: [clinicalPhotos.visitId],        references: [visits.id] }),
  patient:      one(patients,      { fields: [clinicalPhotos.patientId],      references: [patients.id] }),
  treatment:    one(treatments,    { fields: [clinicalPhotos.treatmentId],    references: [treatments.id] }),
  uploader:     one(users,         { fields: [clinicalPhotos.uploadedBy],     references: [users.id] }),
}));

export const treatmentsRelations = relations(treatments, ({ one, many }) => ({
  organization: one(organizations, { fields: [treatments.organizationId], references: [organizations.id] }),
  patient:      one(patients,      { fields: [treatments.patientId],      references: [patients.id] }),
  doctor:       one(users,         { fields: [treatments.doctorId],        references: [users.id] }),
  visits:       many(visitTreatments),
  items:        many(visitItems),
  invoiceLines: many(invoiceTreatments),
  consentLog:   many(consentAuditLog),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  organization: one(organizations, { fields: [invoices.organizationId], references: [organizations.id] }),
  patient:      one(patients,      { fields: [invoices.patientId],      references: [patients.id] }),
  treatments:   many(invoiceTreatments),
}));

export const invoiceTreatmentsRelations = relations(invoiceTreatments, ({ one }) => ({
  invoice:   one(invoices,   { fields: [invoiceTreatments.invoiceId],   references: [invoices.id] }),
  treatment: one(treatments, { fields: [invoiceTreatments.treatmentId], references: [treatments.id] }),
}));

export const salaryRecordsRelations = relations(salaryRecords, ({ one }) => ({
  organization: one(organizations, { fields: [salaryRecords.organizationId], references: [organizations.id] }),
  user:         one(users,         { fields: [salaryRecords.userId],          references: [users.id] }),
}));

export const verificationTokensRelations = relations(verificationTokens, ({ one }) => ({
  user: one(users, { fields: [verificationTokens.userId], references: [users.id] }),
}));

export const consentAuditLogRelations = relations(consentAuditLog, ({ one }) => ({
  treatment:    one(treatments,    { fields: [consentAuditLog.treatmentId],    references: [treatments.id] }),
  organization: one(organizations, { fields: [consentAuditLog.organizationId], references: [organizations.id] }),
  actor:        one(users,         { fields: [consentAuditLog.actorId],         references: [users.id] }),
}));

export const toothConditionHistoryRelations = relations(toothConditionHistory, ({ one }) => ({
  organization: one(organizations, { fields: [toothConditionHistory.organizationId], references: [organizations.id] }),
  patient:      one(patients,      { fields: [toothConditionHistory.patientId],      references: [patients.id] }),
  visit:        one(visits,        { fields: [toothConditionHistory.visitId],         references: [visits.id] }),
  treatment:    one(treatments,    { fields: [toothConditionHistory.treatmentId],     references: [treatments.id] }),
  recorder:     one(users,         { fields: [toothConditionHistory.recordedBy],      references: [users.id] }),
}));


// ── Subscription billing ───────────────────────────────────────────────────────

export const subscriptionPlans = sqliteTable("subscription_plans", {
  id:           text("id").primaryKey(),
  name:         text("name").notNull(),
  slug:         text("slug").notNull().unique(),
  description:  text("description"),
  priceMonthly: real("price_monthly").notNull().default(0),
  maxDoctors:   integer("max_doctors"),
  maxStaff:     integer("max_staff"),
  features:     text("features").notNull().default("[]"),
  isActive:     integer("is_active").notNull().default(1),
  sortOrder:    integer("sort_order").notNull().default(0),
  createdAt:    integer("created_at").notNull(),
  updatedAt:    integer("updated_at").notNull(),
});

export const coupons = sqliteTable("coupons", {
  id:            text("id").primaryKey(),
  code:          text("code").notNull().unique(),
  description:   text("description"),
  discountType:  text("discount_type", { enum: ["percent", "amount"] }).notNull(),
  discountValue: real("discount_value").notNull(),
  maxUses:       integer("max_uses"),
  usedCount:     integer("used_count").notNull().default(0),
  validFrom:     integer("valid_from"),
  validUntil:    integer("valid_until"),
  planSlug:      text("plan_slug"),
  isActive:      integer("is_active").notNull().default(1),
  createdAt:     integer("created_at").notNull(),
  updatedAt:     integer("updated_at").notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id:                   text("id").primaryKey(),
  organizationId:       text("organization_id").notNull().references(() => organizations.id),
  planId:               text("plan_id").notNull().references(() => subscriptionPlans.id),
  status:               text("status", { enum: ["trialing", "active", "past_due", "cancelled", "expired"] }).notNull().default("trialing"),
  trialEndAt:           integer("trial_end_at"),
  currentPeriodStart:   integer("current_period_start"),
  currentPeriodEnd:     integer("current_period_end"),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId:     text("stripe_customer_id"),
  couponId:             text("coupon_id").references(() => coupons.id),
  discountApplied:      real("discount_applied").notNull().default(0),
  cancelledAt:          integer("cancelled_at"),
  notes:                text("notes"),
  createdAt:            integer("created_at").notNull(),
  updatedAt:            integer("updated_at").notNull(),
});

export const couponRedemptions = sqliteTable("coupon_redemptions", {
  id:             text("id").primaryKey(),
  couponId:       text("coupon_id").notNull().references(() => coupons.id),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  subscriptionId: text("subscription_id").notNull().references(() => subscriptions.id),
  redeemedAt:     integer("redeemed_at").notNull(),
});

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const couponsRelations = relations(coupons, ({ many }) => ({
  redemptions: many(couponRedemptions),
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  organization: one(organizations, { fields: [subscriptions.organizationId], references: [organizations.id] }),
  plan:         one(subscriptionPlans, { fields: [subscriptions.planId], references: [subscriptionPlans.id] }),
  coupon:       one(coupons, { fields: [subscriptions.couponId], references: [coupons.id] }),
  redemptions:  many(couponRedemptions),
}));

export const couponRedemptionsRelations = relations(couponRedemptions, ({ one }) => ({
  coupon:       one(coupons,       { fields: [couponRedemptions.couponId],       references: [coupons.id] }),
  organization: one(organizations, { fields: [couponRedemptions.organizationId], references: [organizations.id] }),
  subscription: one(subscriptions, { fields: [couponRedemptions.subscriptionId], references: [subscriptions.id] }),
}));

// ─── Clinic drug formulary ────────────────────────────────────────────────────
// Per-org curated list that surfaces first in prescription autocomplete.
export const orgDrugs = sqliteTable("org_drugs", {
  id:               text("id").primaryKey(),
  organizationId:   text("organization_id").notNull().references(() => organizations.id),
  name:             text("name").notNull(),
  defaultDosage:    text("default_dosage"),
  defaultFrequency: text("default_frequency"),
  defaultDuration:  text("default_duration"),
  createdAt:        integer("created_at").notNull(),
});

export const orgDrugsRelations = relations(orgDrugs, ({ one }) => ({
  organization: one(organizations, { fields: [orgDrugs.organizationId], references: [organizations.id] }),
}));

// ─── Staff professional profiles ─────────────────────────────────────────────
// One row per user. Stores professional credentials, qualifications, and
// credential document references. Separate from `users` to keep the main
// user table lean and because this data is admin-managed, not login-critical.
export const staffProfiles = sqliteTable("staff_profiles", {
  userId:              text("user_id").primaryKey().references(() => users.id),
  bio:                 text("bio"),                         // free-text about/bio
  specialization:      text("specialization"),              // e.g. "Orthodontist"
  yearsExperience:     integer("years_experience"),
  languages:           text("languages").notNull().default("[]"),   // JSON string[]
  // qualifications: JSON array of { id, degree, institution, year, notes }
  qualifications:      text("qualifications").notNull().default("[]"),
  idaNumber:           text("ida_number"),                  // IDA membership no.
  dciNumber:           text("dci_number"),                  // Dental Council of India
  stateCouncilNumber:  text("state_council_number"),        // State Dental Council
  licenseExpiry:       text("license_expiry"),              // YYYY-MM-DD
  previousEmployer:    text("previous_employer"),
  // documents: JSON array of { id, docType, originalName, fileName, fileUrl, uploadedAt }
  documents:           text("documents").notNull().default("[]"),
  createdAt:           integer("created_at").notNull(),
  updatedAt:           integer("updated_at").notNull(),
});

export const staffProfilesRelations = relations(staffProfiles, ({ one }) => ({
  user: one(users, { fields: [staffProfiles.userId], references: [users.id] }),
}));

// ─── Onboarding email sequence ───────────────────────────────────────────────
// One row per scheduled email. Inserted at signup; processed by the daily cron.
export const onboardingEmails = sqliteTable("onboarding_emails", {
  id:             text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  userId:         text("user_id").notNull().references(() => users.id),
  step:           integer("step").notNull(), // 0=welcome, 1=day1, 2=day3, 3=day7
  scheduledAt:    integer("scheduled_at").notNull(),
  sentAt:         integer("sent_at"),
  status:         text("status", { enum: ["pending", "sent", "failed"] }).notNull().default("pending"),
  createdAt:      integer("created_at").notNull(),
});
