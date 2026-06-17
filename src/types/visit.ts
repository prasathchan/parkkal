/**
 * types/visit.ts
 *
 * TypeScript shapes for visits, bill items, payments, prescriptions,
 * and attachments. A "visit" is one appointment/walk-in session.
 */

import type { VisitStatus, ItemCategory, PaymentMethod } from "@/constants/visit";

// ─── Visit ────────────────────────────────────────────────────────────────────

export interface Visit {
  id: string;
  visitCode: string;           // e.g. "VIS-20250101-0042"
  patientId: string;
  doctorId: string;
  visitDate: string;           // "YYYY-MM-DD"
  chiefComplaint?: string | null;
  doctorNotes?: string | null;
  diagnosis?: string | null;
  status: VisitStatus;
  totalAmount: number;         // Sum of all bill item amounts (updated automatically)
  paidAmount: number;          // Sum of all recorded payments
  visitType: "APPOINTMENT" | "WALKIN";
  appointmentId?: string | null;
  createdAt: number;
  updatedAt: number;
  // Joined fields (present when fetched from the list endpoint)
  patientName?: string | null;
  patientCode?: string | null;
  doctorName?: string | null;
}

// ─── Bill item ────────────────────────────────────────────────────────────────

export interface VisitItem {
  id: string;
  visitId: string;
  itemName: string;
  category: ItemCategory;
  toothNumber?: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;              // quantity × unitPrice (stored for speed)
  notes?: string | null;
  /** Set when category is TREATMENT — links this bill row to a treatment plan. */
  linkedTreatmentId?: string | null;
  createdAt: number;
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export interface Payment {
  id: string;
  visitId: string;
  patientId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
  paidAt: number;
  recordedBy: string;
  recordedByName?: string | null;
  treatmentDescription?: string | null; // Joined from linked treatment, if any
}

// ─── Prescription ─────────────────────────────────────────────────────────────

export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  visitId: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  medicines: Medicine[];
  instructions?: string | null;
  createdAt: number;
}

// ─── Attachment ───────────────────────────────────────────────────────────────

export interface Attachment {
  id: string;
  visitId: string;
  patientId: string;
  fileName: string;
  originalName: string;
  fileType: "XRAY" | "PRESCRIPTION" | "DOCTOR_NOTE" | "LAB_REPORT" | "OTHER";
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  uploadedBy: string;
  uploadedByName?: string | null;
  createdAt: number;
}

// ─── Clinical photo (before/after) ───────────────────────────────────────────

export type PhotoRole = "BEFORE" | "AFTER" | "PROGRESS" | "UNTAGGED";
export type PhotoType = "INTRA_ORAL" | "EXTRA_ORAL" | "FULL_FACE" | "PANORAMIC" | "OTHER";

export interface ClinicalPhoto {
  id: string;
  organizationId: string;
  visitId: string;
  patientId: string;
  treatmentId?: string | null;
  photoRole: PhotoRole;
  photoType: PhotoType;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  notes?: string | null;
  uploadedBy: string;
  createdAt: number;
}
