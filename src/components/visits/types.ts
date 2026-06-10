/**
 * components/visits/types.ts
 *
 * Shared types and constants for the visit detail page and its sub-components.
 *
 * NOTE: This file intentionally keeps STATUS_COLORS separate from VISIT_STATUS_BADGE
 * in @/constants/ui — they use different color shades for the detail page design.
 */

import { ITEM_CATEGORY, PAYMENT_METHOD } from "@/constants";
export { formatBytes } from "@/lib/utils";

// ─── Data shapes ──────────────────────────────────────────────────────────────
// These mirror the API response shapes for the visit detail page.

export interface Visit {
  id: string;
  visitCode: string;
  visitDate: string;
  chiefComplaint?: string | null;
  doctorNotes?: string | null;
  diagnosis?: string | null;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  totalAmount: number;
  paidAmount: number;
  appointmentId?: string | null;
  visitType?: string | null;
  recallDate?: string | null;
  recallNotes?: string | null;
  patientName?: string | null;
  patientCode?: string | null;
  patientId: string;
  doctorName?: string | null;
  doctorId: string;
}

export interface VisitItem {
  id: string;
  itemName: string;
  category: string;
  toothNumber?: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  notes?: string | null;
}

export interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string | null;
  notes?: string | null;
  paidAt: number;
  recordedBy: string;
  treatmentId?: string | null;
  treatmentDescription?: string | null;
}

export interface Attachment {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  createdAt: number;
}

export interface HistoryVisit {
  id: string;
  visitCode: string;
  visitDate: string;
  doctorName?: string | null;
  totalAmount: number;
  status: string;
}

export interface Treatment {
  id: string;
  description: string;
  toothNumbers?: string | null;
  procedure?: string | null;
  cost: number;
  billedAmount?: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  createdAt: number;
  visitId?: string | null;
  consentStatus: string;
  consentDocumentUrl?: string | null;
  consentDocumentName?: string | null;
  consentUploadedAt?: number | null;
  consentNotes?: string | null;
}

// ─── Form state ───────────────────────────────────────────────────────────────

/** State shape for the "add bill item" form in VisitItemsTab */
export interface NewItemState {
  itemName: string;
  category: string;
  toothNumber: string;
  quantity: string;   // string so the <input> can be empty while typing
  unitPrice: string;  // string so the <input> can be empty while typing
  notes: string;
  linkedTreatmentId: string;
}

/** Initial state for a blank "add item" form */
export const DEFAULT_NEW_ITEM: NewItemState = {
  itemName: "",
  category: "PROCEDURE",
  toothNumber: "",
  quantity: "1",
  unitPrice: "0",
  notes: "",
  linkedTreatmentId: "",
};

// ─── UI constants ─────────────────────────────────────────────────────────────

/**
 * Badge colors for visit status — used in the visit detail page header and history list.
 * NOTE: These use slightly different shades than VISIT_STATUS_BADGE in @/constants/ui
 * (e.g. text-blue-800 vs text-blue-700). Do NOT merge them.
 */
export const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

/**
 * Bill item category options — sourced from the canonical @/constants constant.
 * Used in the category <select> dropdown in VisitItemsTab.
 */
export const CATEGORIES = Object.values(ITEM_CATEGORY);

/**
 * Payment method options — sourced from the canonical @/constants constant.
 * Used in the payment method <select> dropdown.
 */
export const PAYMENT_METHODS = Object.values(PAYMENT_METHOD);
