/**
 * types/index.ts
 *
 * Barrel export — import all domain types from one place:
 *   import type { Patient, Visit, Treatment } from "@/types";
 *
 * ─── WHERE TO FIND EACH TYPE ─────────────────────────────────────────────────
 *   Patient, PatientBalance, EmergencyContact  →  types/patient.ts
 *   Visit, VisitItem, Payment, Prescription    →  types/visit.ts
 *   Treatment                                  →  types/treatment.ts
 *   StaffMember, OrgRole, SalaryRecord         →  types/staff.ts
 */

export type * from "./patient";
export type * from "./visit";
export type * from "./treatment";
export type * from "./staff";
