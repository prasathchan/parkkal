/**
 * api/visits.ts
 *
 * All API calls related to visits (appointments/walk-ins).
 *
 * HOW TO USE:
 *   import { visitsApi } from "@/api/visits";
 *
 *   // Get visits list
 *   const { visits } = await visitsApi.list({ patientId: "..." });
 *
 *   // Get full visit detail
 *   const { visit } = await visitsApi.get(visitId);
 *
 *   // Add a bill item
 *   await visitsApi.addItem(visitId, { itemName: "Scaling", category: "PROCEDURE", ... });
 */

import { apiFetch, ApiError } from "./_client";
import type {
  Visit,
  VisitItem,
  Payment,
  Prescription,
  Attachment,
} from "@/types";
import type { VisitStatus, ItemCategory, PaymentMethod } from "@/constants/visit";

// ─── List visits ──────────────────────────────────────────────────────────────

export interface ListVisitsParams {
  patientId?: string;
  doctorId?: string;
  status?: VisitStatus;
  date?: string;
  search?: string;
  billingStatus?: "UNPAID";
  limit?: number;
  offset?: number;
}

export interface VisitListResponse {
  visits: Visit[];
  total: number;
  hasMore: boolean;
}

export function listVisits(params: ListVisitsParams = {}): Promise<VisitListResponse> {
  const q = new URLSearchParams();
  if (params.patientId) q.set("patientId", params.patientId);
  if (params.doctorId) q.set("doctorId", params.doctorId);
  if (params.status) q.set("status", params.status);
  if (params.date) q.set("date", params.date);
  if (params.search) q.set("search", params.search);
  if (params.billingStatus) q.set("billingStatus", params.billingStatus);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  return apiFetch<VisitListResponse>(`/api/visits?${q}`);
}

// ─── Get / update / delete a visit ───────────────────────────────────────────

export interface VisitDetailResponse {
  visit: Visit;
  items: VisitItem[];
  payments: Payment[];
  attachments: Attachment[];
  prescriptions: Prescription[];
}

export function getVisit(id: string): Promise<VisitDetailResponse> {
  return apiFetch<VisitDetailResponse>(`/api/visits/${id}`);
}

export interface CreateVisitPayload {
  patientId: string;
  doctorId: string;
  visitDate: string;
  chiefComplaint?: string;
  doctorNotes?: string;
  appointmentId?: string | null;
  visitType?: "APPOINTMENT" | "WALKIN";
}

export function createVisit(
  data: CreateVisitPayload,
): Promise<{ visit: Visit }> {
  return apiFetch<{ visit: Visit }>("/api/visits", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface UpdateVisitPayload {
  status?: VisitStatus;
  chiefComplaint?: string | null;
  doctorNotes?: string | null;
  diagnosis?: string | null;
  recallDate?: string | null;
  recallNotes?: string | null;
}

export function updateVisit(
  id: string,
  data: UpdateVisitPayload,
): Promise<{ visit: Visit }> {
  return apiFetch<{ visit: Visit }>(`/api/visits/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteVisit(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/visits/${id}`, { method: "DELETE" });
}

// ─── Bill items ───────────────────────────────────────────────────────────────

export function listItems(visitId: string): Promise<{ items: VisitItem[] }> {
  return apiFetch<{ items: VisitItem[] }>(`/api/visits/${visitId}/items`);
}

export interface AddItemPayload {
  itemName: string;
  category: ItemCategory | string;
  toothNumber?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  linkedTreatmentId?: string;
}

export function addItem(
  visitId: string,
  data: AddItemPayload,
): Promise<{ item: VisitItem }> {
  return apiFetch<{ item: VisitItem }>(`/api/visits/${visitId}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface UpdateItemPayload {
  itemName?: string;
  category?: ItemCategory;
  toothNumber?: string | null;
  quantity?: number;
  unitPrice?: number;
  notes?: string | null;
}

export function updateItem(
  visitId: string,
  itemId: string,
  data: UpdateItemPayload,
): Promise<{ item: VisitItem }> {
  return apiFetch<{ item: VisitItem }>(`/api/visits/${visitId}/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteItem(visitId: string, itemId: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/visits/${visitId}/items/${itemId}`, {
    method: "DELETE",
  });
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export function listPayments(visitId: string): Promise<{ payments: Payment[] }> {
  return apiFetch<{ payments: Payment[] }>(`/api/visits/${visitId}/payments`);
}

export interface AddPaymentPayload {
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
  treatmentId?: string | null;
}

export function addPayment(
  visitId: string,
  data: AddPaymentPayload,
): Promise<{ payment: Payment }> {
  return apiFetch<{ payment: Payment }>(`/api/visits/${visitId}/payments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Prescriptions ────────────────────────────────────────────────────────────

export function listPrescriptions(
  visitId: string,
): Promise<{ prescriptions: Prescription[] }> {
  return apiFetch<{ prescriptions: Prescription[] }>(
    `/api/visits/${visitId}/prescriptions`,
  );
}

export interface AddPrescriptionPayload {
  medicineName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export function addPrescription(
  visitId: string,
  data: AddPrescriptionPayload,
): Promise<{ prescription: Prescription }> {
  return apiFetch<{ prescription: Prescription }>(
    `/api/visits/${visitId}/prescriptions`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function deletePrescription(
  visitId: string,
  prescriptionId: string,
): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(
    `/api/visits/${visitId}/prescriptions/${prescriptionId}`,
    { method: "DELETE" },
  );
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export function listAttachments(
  visitId: string,
): Promise<{ attachments: Attachment[] }> {
  return apiFetch<{ attachments: Attachment[] }>(
    `/api/visits/${visitId}/attachments`,
  );
}

export async function addAttachment(
  visitId: string,
  formData: FormData,
): Promise<{ attachment: Attachment }> {
  // FormData upload — do NOT set Content-Type (browser sets multipart boundary)
  const res = await fetch(`/api/visits/${visitId}/attachments`, { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new ApiError(res.status, body.error || `Upload failed (${res.status})`);
  }
  return res.json() as Promise<{ attachment: Attachment }>;
}

export function deleteAttachment(
  visitId: string,
  attachmentId: string,
): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(
    `/api/visits/${visitId}/attachments/${attachmentId}`,
    { method: "DELETE" },
  );
}

// ─── Print ────────────────────────────────────────────────────────────────────

export function getPrintData(visitId: string): Promise<unknown> {
  return apiFetch<unknown>(`/api/visits/${visitId}/print`);
}

// ─── Grouped export ───────────────────────────────────────────────────────────

export const visitsApi = {
  list:      listVisits,
  get:       getVisit,
  create:    createVisit,
  update:    updateVisit,
  delete:    deleteVisit,
  print:     getPrintData,
  items: {
    list: listItems,
    add: addItem,
    update: updateItem,
    delete: deleteItem,
  },
  payments: {
    list: listPayments,
    add: addPayment,
  },
  prescriptions: {
    list: listPrescriptions,
    add: addPrescription,
    delete: deletePrescription,
  },
  attachments: {
    list: listAttachments,
    add: addAttachment,
    delete: deleteAttachment,
  },
};
