/**
 * types/patient.ts
 *
 * TypeScript shapes for everything related to patients.
 * These match exactly what the API returns — if the API changes, update here.
 */

// ─── Core patient record ──────────────────────────────────────────────────────

export interface Patient {
  id: string;
  patientCode: string;        // e.g. "PKL-000042"
  name: string;
  phone: string;
  email?: string | null;
  dateOfBirth?: string | null; // "YYYY-MM-DD"
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  address?: string | null;
  bloodGroup?: string | null;
  medicalHistory?: string | null;
  /** Encrypted at rest. Only visible to ADMIN role. */
  panNumber?: string | null;
  /** Encrypted at rest. Only visible to ADMIN role. */
  aadhaarNumber?: string | null;
  createdAt: number;          // Unix ms timestamp
  updatedAt: number;
}

// ─── Patient balance summary ──────────────────────────────────────────────────

/** Aggregated financial summary for a patient across all their visits. */
export interface PatientBalance {
  totalBilled: number;        // Sum of all visit totalAmounts
  totalPaid: number;          // Sum of all visit paidAmounts
  totalDue: number;           // totalBilled - totalPaid
  visitCount: number;
  pendingVisits: number;      // Visits where paidAmount < totalAmount
  lastVisit: string | null;   // Date string of most recent visit
}

// ─── Emergency contact ────────────────────────────────────────────────────────

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string | null;
}

// ─── API list response ────────────────────────────────────────────────────────

export interface PatientListResponse {
  patients: Patient[];
  total: number;
  limit: number;
  offset: number;
}
