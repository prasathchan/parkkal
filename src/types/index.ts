/**
 * types/index.ts
 *
 * Barrel export — import all domain types from one place:
 *   import type { Patient, Visit, Treatment, Appointment } from "@/types";
 *
 * ─── WHERE TO FIND EACH TYPE ─────────────────────────────────────────────────
 *   Patient, PatientBalance, EmergencyContact    →  types/patient.ts
 *   Visit, VisitItem, Payment, Prescription      →  types/visit.ts
 *   Treatment                                    →  types/treatment.ts
 *   StaffMember, OrgRole, SalaryRecord           →  types/staff.ts
 *   Appointment, AppointmentListResponse         →  types/appointment.ts
 *   Invoice, InvoiceListResponse                 →  types/invoice.ts
 *   RecallVisit, RecallListResponse              →  types/recall.ts
 *   ReportData, ReportSummary, TopProcedure      →  types/report.ts
 *   OrgProfile                                   →  types/org.ts
 *   SessionUser, UserSummary                     →  types/auth.ts
 */

export type * from "./patient";
export type * from "./visit";
export type * from "./treatment";
export type * from "./staff";
export type * from "./appointment";
export type * from "./invoice";
export type * from "./recall";
export type * from "./report";
export type * from "./org";
export type * from "./auth";
export type * from "./backup";
export type * from "./location";
