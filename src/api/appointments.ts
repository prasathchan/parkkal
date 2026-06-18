/**
 * api/appointments.ts
 *
 * All API calls related to appointments.
 *
 * HOW TO USE:
 *   import { appointmentsApi } from "@/api";
 *
 *   const { appointments } = await appointmentsApi.list({ date: "2025-01-15" });
 *   await appointmentsApi.updateStatus(id, "COMPLETED");
 */

import { apiFetch } from "./_client";
import type {
  Appointment,
  AppointmentListResponse,
  AppointmentReminder,
  CreateAppointmentPayload,
} from "@/types";

// ─── List ─────────────────────────────────────────────────────────────────────

export interface ListAppointmentsParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  patientId?: string;
  doctorId?: string;
  locationId?: string;
  limit?: number;
  offset?: number;
}

export function listAppointments(
  params: ListAppointmentsParams = {},
): Promise<AppointmentListResponse> {
  const q = new URLSearchParams();
  if (params.date)       q.set("date",       params.date);
  if (params.startDate)  q.set("startDate",  params.startDate);
  if (params.endDate)    q.set("endDate",    params.endDate);
  if (params.status)     q.set("status",     params.status);
  if (params.patientId)  q.set("patientId",  params.patientId);
  if (params.doctorId)   q.set("doctorId",   params.doctorId);
  if (params.locationId) q.set("locationId", params.locationId);
  if (params.limit  != null) q.set("limit",  String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  return apiFetch<AppointmentListResponse>(`/api/appointments?${q}`);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function createAppointment(
  data: CreateAppointmentPayload,
): Promise<{ appointment: Appointment }> {
  return apiFetch<{ appointment: Appointment }>("/api/appointments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Update status ────────────────────────────────────────────────────────────

export function updateAppointmentStatus(
  id: string,
  status: string,
): Promise<{ appointment: Appointment }> {
  return apiFetch<{ appointment: Appointment }>(`/api/appointments/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ─── Get single appointment ───────────────────────────────────────────────────

export function getAppointment(id: string): Promise<{ appointment: Appointment }> {
  return apiFetch<{ appointment: Appointment }>(`/api/appointments/${id}`);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function deleteAppointment(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/appointments/${id}`, {
    method: "DELETE",
  });
}

// ─── Reschedule / update full appointment ─────────────────────────────────────

export interface UpdateAppointmentPayload {
  status?:          string;
  type?:            string;
  appointmentDate?: string;
  appointmentTime?: string;
  notes?:           string;
}

export function updateAppointment(
  id: string,
  data: UpdateAppointmentPayload,
): Promise<{ appointment: Appointment }> {
  return apiFetch<{ appointment: Appointment }>(`/api/appointments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Reminders ────────────────────────────────────────────────────────────────

/**
 * List scheduled reminders for a specific appointment.
 * Used in the appointment detail view to show reminder status.
 */
export function listReminders(
  appointmentId: string,
): Promise<{ reminders: AppointmentReminder[] }> {
  return apiFetch<{ reminders: AppointmentReminder[] }>(
    `/api/appointments/${appointmentId}/reminders`,
  );
}

export function bulkUpdateStatus(
  ids: string[],
  status: "COMPLETED" | "NO_SHOW",
): Promise<{ updated: number }> {
  return apiFetch("/api/appointments/bulk-status", {
    method: "POST",
    body: JSON.stringify({ ids, status }),
  });
}

// ─── Grouped export ───────────────────────────────────────────────────────────

export const appointmentsApi = {
  list:         listAppointments,
  get:          getAppointment,
  create:       createAppointment,
  update:       updateAppointment,
  updateStatus: updateAppointmentStatus,
  bulkUpdateStatus,
  delete:       deleteAppointment,
  reminders: {
    list: listReminders,
  },
};
