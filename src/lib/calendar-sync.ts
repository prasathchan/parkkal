/**
 * lib/calendar-sync.ts
 *
 * Pushes appointment events to a staff member's personal Google or Outlook
 * calendar when appointments are created, updated, or cancelled.
 *
 * ─── HOW IT WORKS ────────────────────────────────────────────────────────────
 *
 *   1. Staff connects their calendar in Settings → OAuth tokens stored in
 *      calendar_integrations table (encrypted)
 *   2. This module is called from appointment API routes after create/update/cancel
 *   3. If the doctor has an active integration, we push the event to their calendar
 *   4. The external event ID is stored in event_id_map so we can update/delete it later
 *
 * ─── SETUP REQUIRED ──────────────────────────────────────────────────────────
 *
 *   Google:
 *     GOOGLE_CLIENT_ID     → Google Cloud Console → OAuth 2.0 credentials
 *     GOOGLE_CLIENT_SECRET → same
 *     GOOGLE_REDIRECT_URI  → e.g. https://yourapp.com/api/calendar/google/callback
 *
 *   Outlook (Microsoft):
 *     MICROSOFT_CLIENT_ID     → Azure Portal → App registrations
 *     MICROSOFT_CLIENT_SECRET → same
 *     MICROSOFT_REDIRECT_URI  → e.g. https://yourapp.com/api/calendar/outlook/callback
 *
 * ─── TOKEN REFRESH ───────────────────────────────────────────────────────────
 *   Access tokens expire. This module auto-refreshes using the refresh token
 *   before making API calls. Updated tokens are written back to the DB.
 */

import { eq, and } from "drizzle-orm";
import { calendarIntegrations } from "@/db/schema";
import { encryptField, decryptField } from "@/lib/encryption";
import { generateId } from "@/lib/utils";
import type { DbInstance } from "@/lib/db";
type DrizzleDB = DbInstance;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarProvider = "GOOGLE" | "OUTLOOK";

interface CalendarEvent {
  appointmentId: string;
  title:         string;      // e.g. "Consultation — Raj Kumar"
  date:          string;      // "YYYY-MM-DD"
  time:          string;      // "HH:MM"
  durationMins:  number;      // default 30
  notes?:        string;
  location?:     string;      // clinic address if available
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(date: string, time: string): string {
  return `${date}T${time}:00`;
}

function addMinutes(iso: string, mins: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString().slice(0, 16) + ":00";
}

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
}

async function refreshOutlookToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }> {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.MICROSOFT_CLIENT_ID ?? "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
      scope:         "Calendars.ReadWrite offline_access",
    }),
  });
  if (!res.ok) throw new Error(`Outlook token refresh failed: ${res.status}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
}

// ─── Get a valid (possibly refreshed) access token ───────────────────────────

async function getValidToken(
  db: DrizzleDB,
  integration: { id: string; provider: string; accessToken: string; refreshToken: string; expiresAt: number },
): Promise<string> {
  const decryptedAccess  = await decryptField(integration.accessToken) ?? "";
  const decryptedRefresh = await decryptField(integration.refreshToken) ?? "";

  // Still valid (with 60s buffer)
  if (integration.expiresAt > Date.now() + 60_000) return decryptedAccess;

  // Refresh
  const refreshed =
    integration.provider === "GOOGLE"
      ? await refreshGoogleToken(decryptedRefresh)
      : await refreshOutlookToken(decryptedRefresh);

  const encryptedAccess = await encryptField(refreshed.accessToken);
  await db
    .update(calendarIntegrations)
    .set({ accessToken: encryptedAccess ?? "", expiresAt: refreshed.expiresAt, updatedAt: Date.now() })
    .where(eq(calendarIntegrations.id, integration.id));

  return refreshed.accessToken;
}

// ─── Google Calendar API ──────────────────────────────────────────────────────

async function pushToGoogle(
  accessToken: string,
  calendarId: string,
  event: CalendarEvent,
  existingEventId?: string,
): Promise<string> {
  const start = toISO(event.date, event.time);
  const end   = addMinutes(start, event.durationMins);

  const body = {
    summary:     event.title,
    description: event.notes ?? "",
    location:    event.location ?? "",
    start: { dateTime: start, timeZone: "Asia/Kolkata" },
    end:   { dateTime: end,   timeZone: "Asia/Kolkata" },
  };

  const calId  = encodeURIComponent(calendarId);
  const url    = existingEventId
    ? `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${existingEventId}`
    : `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`;
  const method = existingEventId ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google Calendar API error ${res.status}`);
  const data = await res.json() as { id: string };
  return data.id;
}

async function cancelGoogleEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const calId = encodeURIComponent(calendarId);
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ─── Outlook Calendar API ─────────────────────────────────────────────────────

async function pushToOutlook(
  accessToken: string,
  event: CalendarEvent,
  existingEventId?: string,
): Promise<string> {
  const start = toISO(event.date, event.time);
  const end   = addMinutes(start, event.durationMins);

  const body = {
    subject:  event.title,
    body:     { contentType: "text", content: event.notes ?? "" },
    location: { displayName: event.location ?? "" },
    start:    { dateTime: start, timeZone: "Asia/Calcutta" },
    end:      { dateTime: end,   timeZone: "Asia/Calcutta" },
  };

  const url    = existingEventId
    ? `https://graph.microsoft.com/v1.0/me/events/${existingEventId}`
    : "https://graph.microsoft.com/v1.0/me/events";
  const method = existingEventId ? "PATCH" : "POST";

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Outlook Calendar API error ${res.status}`);
  const data = await res.json() as { id: string };
  return data.id;
}

async function cancelOutlookEvent(accessToken: string, eventId: string): Promise<void> {
  await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ─── Main exported functions ──────────────────────────────────────────────────

/**
 * Push a new or updated appointment to the doctor's personal calendar.
 * Silently skips if the doctor has no connected calendar.
 * Safe to fire-and-forget from the appointments API route.
 */
export async function syncAppointmentToCalendar(
  db: DrizzleDB,
  doctorId: string,
  event: CalendarEvent,
): Promise<void> {
  const [integration] = await db
    .select()
    .from(calendarIntegrations)
    .where(and(eq(calendarIntegrations.userId, doctorId), eq(calendarIntegrations.isActive, 1)));

  if (!integration) return; // doctor hasn't connected a calendar

  try {
    const token      = await getValidToken(db, integration);
    const eventMap   = JSON.parse(integration.eventIdMap ?? "{}") as Record<string, string>;
    const existingId = eventMap[event.appointmentId];

    let newEventId: string;
    if (integration.provider === "GOOGLE") {
      newEventId = await pushToGoogle(token, integration.calendarId ?? "primary", event, existingId);
    } else {
      newEventId = await pushToOutlook(token, event, existingId);
    }

    // Save the external event ID so we can update/delete it later
    eventMap[event.appointmentId] = newEventId;
    await db
      .update(calendarIntegrations)
      .set({ eventIdMap: JSON.stringify(eventMap), updatedAt: Date.now() })
      .where(eq(calendarIntegrations.id, integration.id));

  } catch (err) {
    // Log but don't throw — calendar sync failure must never block clinic operations
    console.error("[CALENDAR-SYNC] Failed to sync appointment", {
      appointmentId: event.appointmentId,
      provider: integration.provider,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Delete an appointment from the doctor's personal calendar (on cancellation).
 * Silently skips if no integration exists or no event was ever pushed.
 */
export async function removeAppointmentFromCalendar(
  db: DrizzleDB,
  doctorId: string,
  appointmentId: string,
): Promise<void> {
  const [integration] = await db
    .select()
    .from(calendarIntegrations)
    .where(and(eq(calendarIntegrations.userId, doctorId), eq(calendarIntegrations.isActive, 1)));

  if (!integration) return;

  try {
    const token    = await getValidToken(db, integration);
    const eventMap = JSON.parse(integration.eventIdMap ?? "{}") as Record<string, string>;
    const eventId  = eventMap[appointmentId];
    if (!eventId) return;

    if (integration.provider === "GOOGLE") {
      await cancelGoogleEvent(token, integration.calendarId ?? "primary", eventId);
    } else {
      await cancelOutlookEvent(token, eventId);
    }

    delete eventMap[appointmentId];
    await db
      .update(calendarIntegrations)
      .set({ eventIdMap: JSON.stringify(eventMap), updatedAt: Date.now() })
      .where(eq(calendarIntegrations.id, integration.id));

  } catch (err) {
    console.error("[CALENDAR-SYNC] Failed to remove appointment", {
      appointmentId,
      provider: integration.provider,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── OAuth URL builders (called from API routes) ──────────────────────────────

export function getGoogleAuthUrl(state: string): string {
  const q = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI ?? "",
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/calendar.events",
    access_type:   "offline",
    prompt:        "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export function getOutlookAuthUrl(state: string): string {
  const q = new URLSearchParams({
    client_id:     process.env.MICROSOFT_CLIENT_ID ?? "",
    redirect_uri:  process.env.MICROSOFT_REDIRECT_URI ?? "",
    response_type: "code",
    scope:         "Calendars.ReadWrite offline_access",
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${q}`;
}

export async function exchangeGoogleCode(
  code: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI ?? "",
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google code exchange failed: ${res.status}`);
  const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    Date.now() + data.expires_in * 1000,
  };
}

export async function exchangeOutlookCode(
  code: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.MICROSOFT_CLIENT_ID ?? "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      redirect_uri:  process.env.MICROSOFT_REDIRECT_URI ?? "",
      grant_type:    "authorization_code",
      scope:         "Calendars.ReadWrite offline_access",
    }),
  });
  if (!res.ok) throw new Error(`Outlook code exchange failed: ${res.status}`);
  const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    Date.now() + data.expires_in * 1000,
  };
}

export { generateId };
