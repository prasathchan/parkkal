/**
 * api/invoices.ts
 *
 * All API calls related to invoices.
 *
 * HOW TO USE:
 *   import { invoicesApi } from "@/api";
 *
 *   const { invoices } = await invoicesApi.list();
 *   await invoicesApi.recordPayment(invoiceId, { amount: 500, paymentMethod: "CASH" });
 */

import { apiFetch } from "./_client";
import type { Invoice, InvoiceListResponse, RecordInvoicePaymentPayload } from "@/types";

// ─── List ─────────────────────────────────────────────────────────────────────

export interface ListInvoicesParams {
  patientId?: string;
}

export function listInvoices(
  params: ListInvoicesParams = {},
): Promise<InvoiceListResponse> {
  const q = new URLSearchParams();
  if (params.patientId) q.set("patientId", params.patientId);
  return apiFetch<InvoiceListResponse>(`/api/invoices?${q}`);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateInvoicePayload {
  patientId: string;
  treatmentIds?: string[];
  notes?: string;
}

export function createInvoice(
  data: CreateInvoicePayload,
): Promise<{ invoice: Invoice }> {
  return apiFetch<{ invoice: Invoice }>("/api/invoices", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Record payment ───────────────────────────────────────────────────────────

export function recordInvoicePayment(
  invoiceId: string,
  data: RecordInvoicePaymentPayload,
): Promise<{ invoice: Invoice }> {
  return apiFetch<{ invoice: Invoice }>(`/api/invoices/${invoiceId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Grouped export ───────────────────────────────────────────────────────────

export const invoicesApi = {
  list:          listInvoices,
  create:        createInvoice,
  recordPayment: recordInvoicePayment,
};
