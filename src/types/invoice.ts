/**
 * types/invoice.ts
 *
 * TypeScript shapes for invoices.
 */

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "PARTIALLY_PAID" | "CANCELLED";

export interface InvoiceTreatment {
  treatmentId: string;
  description: string;
  cost: number;
}

export interface Invoice {
  id: string;
  organizationId: string;
  patientId: string;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
  // Joined fields
  patientName?: string | null;
  patientCode?: string | null;
  treatments?: InvoiceTreatment[];
}

// ─── Record payment payload ───────────────────────────────────────────────────

export interface RecordInvoicePaymentPayload {
  amount: number;
  paymentMethod: "CASH" | "CARD" | "UPI" | "BANK_TRANSFER";
  referenceNumber?: string;
  notes?: string;
}

// ─── List response ────────────────────────────────────────────────────────────

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  hasMore: boolean;
}
