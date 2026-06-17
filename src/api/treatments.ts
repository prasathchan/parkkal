/**
 * api/treatments.ts
 *
 * All API calls related to treatment plans.
 *
 * HOW TO USE:
 *   import { treatmentsApi } from "@/api/treatments";
 *
 *   // List all treatment plans for a patient
 *   const { treatments } = await treatmentsApi.listForPatient(patientId);
 *
 *   // Link a treatment to the current visit
 *   await treatmentsApi.linkToVisit(visitId, { treatmentId });
 */

import { apiFetch, ApiError } from "./_client";
import type { Treatment, ClinicalPhoto } from "@/types";
import type { TreatmentStatus } from "@/constants/treatment";

// ─── Response shapes ─────────────────────────────────────────────────────────

/** One visit row returned by GET /api/treatments/[id]/visits */
export interface TreatmentVisitRow {
  visitId: string;
  linkNotes: string | null;
  visitCode: string;
  visitDate: string;
  visitStatus: string;
  visitTotalAmount: number;
  visitPaidAmount: number;
  doctorName: string | null;
  /** Amount charged specifically to THIS treatment in this visit */
  treatmentBilledAmount: number;
}

/** Financial summary returned alongside visits */
export interface TreatmentFinancialSummary {
  treatmentCost: number;
  totalPaid: number;
  outstanding: number;
  /** 0–100 integer for progress-bar rendering */
  paidPercent: number;
  visitCount: number;
}

/** Full response of GET /api/treatments/[id]/visits */
export interface TreatmentVisitsResponse {
  /** The treatment plan itself, including joined patient and doctor names. */
  treatment: Treatment;
  visits: TreatmentVisitRow[];
  summary: TreatmentFinancialSummary;
}

// ─── Treatment plans ──────────────────────────────────────────────────────────

export interface ListTreatmentsParams {
  patientId?: string;
  status?: TreatmentStatus;
  date?: string;
  limit?: number;
  offset?: number;
}

export function listTreatments(
  params: ListTreatmentsParams = {},
): Promise<{ treatments: Treatment[]; total: number; hasMore: boolean }> {
  const q = new URLSearchParams();
  if (params.patientId) q.set("patientId", params.patientId);
  if (params.status) q.set("status", params.status);
  if (params.date) q.set("date", params.date);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  return apiFetch<{ treatments: Treatment[]; total: number; hasMore: boolean }>(`/api/treatments?${q}`);
}

export function getTreatment(id: string): Promise<{ treatment: Treatment }> {
  return apiFetch<{ treatment: Treatment }>(`/api/treatments/${id}`);
}

export interface UpdateTreatmentPayload {
  status?: TreatmentStatus;
  description?: string;
  procedure?: string | null;
  toothNumbers?: string | null;
  cost?: number;
}

export function updateTreatment(
  id: string,
  data: UpdateTreatmentPayload,
): Promise<{ treatment: Treatment }> {
  return apiFetch<{ treatment: Treatment }>(`/api/treatments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteTreatment(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/treatments/${id}`, {
    method: "DELETE",
  });
}

export interface CreateTreatmentPayload {
  patientId: string;
  doctorId: string;
  description: string;
  procedure?: string;
  toothNumbers?: string;
  cost: number;
}

export function createTreatment(
  data: CreateTreatmentPayload,
): Promise<{ treatment: Treatment }> {
  return apiFetch<{ treatment: Treatment }>("/api/treatments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Treatments on a visit ────────────────────────────────────────────────────

export function listTreatmentsForVisit(
  visitId: string,
): Promise<{ treatments: Treatment[] }> {
  return apiFetch<{ treatments: Treatment[] }>(
    `/api/visits/${visitId}/treatments`,
  );
}

/**
 * Link an existing treatment plan to a visit.
 * Use this when the patient is paying for/continuing a treatment in this visit.
 */
export function linkTreatmentToVisit(
  visitId: string,
  data: { treatmentId: string } | { description: string; cost: number; notes?: string; toothNumbers?: string; procedure?: string },
): Promise<{ success: true; treatmentId: string }> {
  return apiFetch<{ success: true; treatmentId: string }>(
    `/api/visits/${visitId}/treatments`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function unlinkTreatmentFromVisit(
  visitId: string,
  treatmentId: string,
): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(
    `/api/visits/${visitId}/treatments?treatmentId=${treatmentId}`,
    { method: "DELETE" },
  );
}

/**
 * GET /api/treatments/[id]/visits
 * Returns the treatment detail, its full visit history, and financial summary.
 */
export function getTreatmentVisits(id: string): Promise<TreatmentVisitsResponse> {
  return apiFetch<TreatmentVisitsResponse>(`/api/treatments/${id}/visits`);
}

// ─── Consent ─────────────────────────────────────────────────────────────────

export async function uploadConsent(
  treatmentId: string,
  file: File,
): Promise<{ success: true }> {
  // FormData upload — do NOT set Content-Type (browser sets multipart boundary)
  const fd = new FormData();
  fd.append("document", file);
  const res = await fetch(`/api/treatments/${treatmentId}/consent/upload`, { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new ApiError(res.status, body.error || `Consent upload failed (${res.status})`);
  }
  return res.json() as Promise<{ success: true }>;
}

export function overrideConsent(
  treatmentId: string,
  reason: string,
): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/treatments/${treatmentId}/consent`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

// ─── Clinical photos for a treatment ─────────────────────────────────────────

export function listTreatmentPhotos(treatmentId: string): Promise<{ photos: ClinicalPhoto[] }> {
  return apiFetch<{ photos: ClinicalPhoto[] }>(`/api/treatments/${treatmentId}/photos`);
}

// ─── Grouped export ───────────────────────────────────────────────────────────

export const treatmentsApi = {
  list: listTreatments,
  get: getTreatment,
  create: createTreatment,
  update: updateTreatment,
  delete: deleteTreatment,
  getVisits: getTreatmentVisits,
  forVisit: {
    list: listTreatmentsForVisit,
    link: linkTreatmentToVisit,
    unlink: unlinkTreatmentFromVisit,
  },
  consent: {
    upload: uploadConsent,
    override: overrideConsent,
  },
  photos: {
    list: listTreatmentPhotos,
  },
};
