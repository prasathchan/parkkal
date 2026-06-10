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
  slug: text("slug").notNull().unique(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  logoUrl: text("logo_url"),
  themeConfig: text("theme_config"),
  gstin: text("gstin"),                          // 15-char GST Identification Number
  gstRegistered: integer("gst_registered").notNull().default(0),
  gstStateCode: text("gst_state_code"),          // 2-digit state code e.g. "33" for Tamil Nadu
  isActive: integer("is_active").notNull().default(1),
  scheduledDeleteAt: integer("scheduled_delete_at"),
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
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at"),
});

export const orgRoles = sqliteTable("org_roles", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#3B82F6"),
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
  type: text("type", { enum: ["EMAIL", "PHONE", "STAFF_INVITE", "PHONE_OTP"] }).notNull(),
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

