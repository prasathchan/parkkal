import { sqliteTable, text, real, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["ADMIN", "DOCTOR", "RECEPTIONIST"] }).notNull().default("RECEPTIONIST"),
  createdAt: integer("created_at").notNull(),
});

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
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  doctorId: text("doctor_id").notNull().references(() => users.id),
  appointmentDate: text("appointment_date").notNull(),
  appointmentTime: text("appointment_time").notNull(),
  status: text("status", {
    enum: ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  }).notNull().default("SCHEDULED"),
  type: text("type", {
    enum: ["CONSULTATION", "CHECKUP", "TREATMENT", "FOLLOWUP"],
  }).notNull().default("CONSULTATION"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
});

export const treatments = sqliteTable("treatments", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  appointmentId: text("appointment_id").references(() => appointments.id),
  doctorId: text("doctor_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  toothNumbers: text("tooth_numbers"),
  procedure: text("procedure"),
  cost: real("cost").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  totalAmount: real("total_amount").notNull(),
  paidAmount: real("paid_amount").notNull().default(0),
  status: text("status", {
    enum: ["PENDING", "PARTIAL", "PAID"],
  }).notNull().default("PENDING"),
  notes: text("notes"),
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

export const visits = sqliteTable("visits", {
  id: text("id").primaryKey(),
  visitCode: text("visit_code").notNull().unique(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  doctorId: text("doctor_id").notNull().references(() => users.id),
  visitDate: text("visit_date").notNull(),
  chiefComplaint: text("chief_complaint"),
  doctorNotes: text("doctor_notes"),
  diagnosis: text("diagnosis"),
  status: text("status", { enum: ["OPEN", "COMPLETED", "CANCELLED"] }).notNull().default("OPEN"),
  totalAmount: real("total_amount").notNull().default(0),
  paidAmount: real("paid_amount").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const visitItems = sqliteTable("visit_items", {
  id: text("id").primaryKey(),
  visitId: text("visit_id").notNull().references(() => visits.id),
  itemName: text("item_name").notNull(),
  category: text("category", { enum: ["MEDICINE", "PROCEDURE", "XRAY", "CONSULTATION", "OTHER"] }).notNull().default("OTHER"),
  toothNumber: text("tooth_number"),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull().default(0),
  amount: real("amount").notNull().default(0),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  visitId: text("visit_id").notNull().references(() => visits.id),
  patientId: text("patient_id").notNull().references(() => patients.id),
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
