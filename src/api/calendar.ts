/**
 * api/calendar.ts
 *
 * API calls related to calendar integration (Google, Outlook).
 */

import { apiFetch } from "./_client";

export interface CalendarStatus {
  google: boolean;
  outlook: boolean;
}

export function getCalendarStatus(): Promise<CalendarStatus> {
  return apiFetch<CalendarStatus>("/api/calendar/status");
}

export function disconnectCalendar(provider: "GOOGLE" | "OUTLOOK"): Promise<{ success: true }> {
  return apiFetch<{ success: true }>("/api/calendar/disconnect", {
    method: "POST",
    body: JSON.stringify({ provider }),
  });
}

export const calendarApi = {
  getStatus: getCalendarStatus,
  disconnect: disconnectCalendar,
};
