/**
 * api/patients.ts
 *
 * All API calls related to patients.
 *
 * HOW TO USE:
 *   import { patientsApi } from "@/api/patients";
 *
 *   // Get a paginated list
 *   const { patients, total } = await patientsApi.list({ search: "Ravi", limit: 25 });
 *
 *   // Get a single patient
 *   const { patient } = await patientsApi.get("patient-id-here");
 *
 *   // Update a patient
 *   await patientsApi.update("patient-id-here", { name: "Ravi Kumar" });
 */

import { apiFetch } from "./_client";
import type { Patient, PatientBalance, PatientListResponse, EmergencyContact } from "@/types";

// ─── List patients ────────────────────────────────────────────────────────────

export interface ListPatientsParams {
  search?: string;
  limit?: number;
  offset?: number;
}

export function listPatients(params: ListPatientsParams = {}): Promise<PatientListResponse> {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  return apiFetch<PatientListResponse>(`/api/patients?${q}`);
}

// ─── Get one patient ──────────────────────────────────────────────────────────

export function getPatient(id: string): Promise<{ patient: Patient }> {
  return apiFetch<{ patient: Patient }>(`/api/patients/${id}`);
}

// ─── Create patient ───────────────────────────────────────────────────────────

export interface CreatePatientPayload {
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  address?: string;
  bloodGroup?: string;
  medicalHistory?: string;
}

export function createPatient(data: CreatePatientPayload): Promise<{ patient: Patient }> {
  return apiFetch<{ patient: Patient }>("/api/patients", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Update patient ───────────────────────────────────────────────────────────

export type UpdatePatientPayload = Partial<CreatePatientPayload> & {
  panNumber?: string | null;
  aadhaarNumber?: string | null;
};

export function updatePatient(
  id: string,
  data: UpdatePatientPayload,
): Promise<{ patient: Patient }> {
  return apiFetch<{ patient: Patient }>(`/api/patients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Delete patient ───────────────────────────────────────────────────────────

export function deletePatient(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/patients/${id}`, { method: "DELETE" });
}

export function erasePatient(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/patients/${id}?confirm=erase`, { method: "DELETE" });
}

// ─── Patient balance ──────────────────────────────────────────────────────────

export function getPatientBalance(id: string): Promise<PatientBalance> {
  return apiFetch<PatientBalance>(`/api/patients/${id}/balance`);
}

// ─── Emergency contacts ───────────────────────────────────────────────────────

export function listEmergencyContacts(
  patientId: string,
): Promise<{ contacts: EmergencyContact[] }> {
  return apiFetch<{ contacts: EmergencyContact[] }>(
    `/api/patients/${patientId}/emergency-contacts`,
  );
}

// ─── Tooth chart ──────────────────────────────────────────────────────────────

export function getToothChart(patientId: string): Promise<{ toothData: Record<string, unknown> }> {
  return apiFetch<{ toothData: Record<string, unknown> }>(`/api/patients/${patientId}/tooth-chart`);
}

export type ToothChartSaveSource = "manual" | "treatment_start" | "treatment_complete";

export function saveToothChart(
  patientId: string,
  toothData: Record<string, unknown>,
  visitId?: string,
  source?: ToothChartSaveSource,
  treatmentId?: string,
): Promise<{ success: true; changedTeeth: string[] }> {
  return apiFetch<{ success: true; changedTeeth: string[] }>(`/api/patients/${patientId}/tooth-chart`, {
    method: "PUT",
    body: JSON.stringify({ toothData, visitId, source: source ?? "manual", treatmentId: treatmentId ?? null }),
  });
}

export interface ToothConditionEntry {
  id: string;
  toothNumber: string;
  previousCondition: string | null;
  newCondition: string;
  visitId: string | null;
  visitCode: string | null;
  visitDate: string | null;
  treatmentId: string | null;
  treatmentDescription: string | null;
  treatmentProcedure: string | null;
  source: string;
  recordedBy: string;
  recordedByName: string | null;
  recordedAt: number;
}

export function getToothConditionHistory(
  patientId: string,
  params?: { toothNumber?: string; visitId?: string; limit?: number },
): Promise<{ history: ToothConditionEntry[] }> {
  const q = new URLSearchParams();
  if (params?.toothNumber) q.set("toothNumber", params.toothNumber);
  if (params?.visitId)     q.set("visitId", params.visitId);
  if (params?.limit)       q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q}` : "";
  return apiFetch<{ history: ToothConditionEntry[] }>(`/api/patients/${patientId}/tooth-condition-history${qs}`);
}

export interface ToothChartHistoryEntry {
  id: string;
  visitId: string | null;
  visitCode: string | null;
  toothData: Record<string, unknown>;
  changedTeeth: string[];
  recordedBy: string;
  recordedByName: string;
  recordedAt: number;
}

export function getToothChartHistory(
  patientId: string,
  visitId?: string,
): Promise<{ history: ToothChartHistoryEntry[] }> {
  const qs = visitId ? `?visitId=${encodeURIComponent(visitId)}` : "";
  return apiFetch<{ history: ToothChartHistoryEntry[] }>(`/api/patients/${patientId}/tooth-chart/history${qs}`);
}

// ─── Prescriptions ────────────────────────────────────────────────────────────

export interface PatientPrescription {
  id: string;
  visitId: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  medicines: Array<{ name: string; dosage: string; frequency: string; duration: string; notes?: string }>;
  instructions?: string | null;
  createdAt: number;
  visitDate: string | null;
}

export function listPatientPrescriptions(patientId: string): Promise<{ prescriptions: PatientPrescription[] }> {
  return apiFetch<{ prescriptions: PatientPrescription[] }>(`/api/patients/${patientId}/prescriptions`);
}

// ─── Grouped export ───────────────────────────────────────────────────────────

/** Use this object for a clean import: `import { patientsApi } from "@/api/patients"` */
export const patientsApi = {
  list: listPatients,
  get: getPatient,
  create: createPatient,
  update: updatePatient,
  delete: deletePatient,
  erase:  erasePatient,
  balance: getPatientBalance,
  emergencyContacts: listEmergencyContacts,
  getToothChart,
  saveToothChart,
  getToothChartHistory,
  getToothConditionHistory,
  listPrescriptions: listPatientPrescriptions,
};
