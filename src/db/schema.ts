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
