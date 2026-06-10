/**
 * api/emergency-contacts.ts
 *
 * Emergency contact CRUD. Used on the staff detail page.
 */

import { apiFetch } from "./_client";

export interface EmergencyContact {
  id: string;
  entityType: "PATIENT" | "USER";
  entityId: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string | null;
}

export interface AddEmergencyContactPayload {
  entityType: "PATIENT" | "USER";
  entityId: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export function listEmergencyContacts(
  entityType: "PATIENT" | "USER",
  entityId: string,
): Promise<{ contacts: EmergencyContact[] }> {
  return apiFetch<{ contacts: EmergencyContact[] }>(
    `/api/emergency-contacts?entityType=${entityType}&entityId=${entityId}`,
  );
}

export function addEmergencyContact(
  data: AddEmergencyContactPayload,
): Promise<{ contact: EmergencyContact }> {
  return apiFetch<{ contact: EmergencyContact }>("/api/emergency-contacts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export const emergencyContactsApi = {
  list: listEmergencyContacts,
  add:  addEmergencyContact,
};
