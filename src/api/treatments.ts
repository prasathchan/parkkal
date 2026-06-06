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

import { apiFetch } from "./_client";
import type { Treatment } from "@/types";
import type { TreatmentStatus } from "@/constants/treatment";

// ─── Treatment plans ──────────────────────────────────────────────────────────

export interface ListTreatmentsParams {
  patientId?: string;
  status?: TreatmentStatus;
}

export function listTreatments(
  params: ListTreatmentsParams = {},
): Promise<{ treatments: Treatment[] }> {
  const q = new URLSearchParams();
  if (params.patientId) q.set("patientId", params.patientId);
  if (params.status) q.set("status", params.status);
  return apiFetch<{ treatments: Treatment[] }>(`/api/treatments?${q}`);
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
  data: { treatmentId: string } | { description: string; cost: number; notes?: string },
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

// ─── Grouped export ───────────────────────────────────────────────────────────

export const treatmentsApi = {
  list: listTreatments,
  get: getTreatment,
  update: updateTreatment,
  delete: deleteTreatment,
  forVisit: {
    list: listTreatmentsForVisit,
    link: linkTreatmentToVisit,
    unlink: unlinkTreatmentFromVisit,
  },
};
