import { apiFetch } from "./_client";
import type { Location, CreateLocationPayload, UpdateLocationPayload, StaffLocationAssignment } from "@/types";

export const locationsApi = {
  list: () =>
    apiFetch<{ locations: Location[] }>("/api/locations"),

  get: (id: string) =>
    apiFetch<{ location: Location }>(`/api/locations/${id}`),

  create: (payload: CreateLocationPayload) =>
    apiFetch<{ location: Location }>("/api/locations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: UpdateLocationPayload) =>
    apiFetch<{ location: Location }>(`/api/locations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  delete: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/api/locations/${id}`, { method: "DELETE" }),

  staff: {
    list: (locationId: string) =>
      apiFetch<{ assignments: StaffLocationAssignment[] }>(`/api/locations/${locationId}/staff`),

    assign: (locationId: string, userId: string, isPrimary = 0) =>
      apiFetch<{ assigned: boolean }>(`/api/locations/${locationId}/staff`, {
        method: "POST",
        body: JSON.stringify({ userId, isPrimary }),
      }),

    remove: (locationId: string, userId: string) =>
      apiFetch<{ removed: boolean }>(`/api/locations/${locationId}/staff`, {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      }),
  },
};
