"use client";

/**
 * Settings → Calendar Integration
 *
 * Lets each staff member connect their personal Google or Outlook calendar.
 * Once connected, every appointment assigned to them is automatically pushed
 * to their personal calendar. Updates and cancellations sync too.
 *
 * Setup needed (one-time, by clinic admin):
 *   Google:  GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REDIRECT_URI
 *   Outlook: MICROSOFT_CLIENT_ID + MICROSOFT_CLIENT_SECRET + MICROSOFT_REDIRECT_URI
 */

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { ApiError } from "@/api";

interface CalendarStatus {
  google:  boolean;
  outlook: boolean;
}

function CalendarSettingsInner() {
  const searchParams = useSearchParams();
  const [status,    setStatus]    = useState<CalendarStatus | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const successMsg =
    searchParams.get("connected") === "google"  ? "Google Calendar connected successfully!" :
    searchParams.get("connected") === "outlook" ? "Outlook Calendar connected successfully!" : null;

  const errorMsg =
    searchParams.get("error") === "google_denied"  ? "Google authorization was cancelled." :
    searchParams.get("error") === "outlook_denied" ? "Outlook authorization was cancelled." :
    searchParams.get("error") === "google_failed"  ? "Failed to connect Google Calendar. Please try again." :
    searchParams.get("error") === "outlook_failed" ? "Failed to connect Outlook Calendar. Please try again." : null;

  useEffect(() => {
    fetch("/api/calendar/status")
      .then((r) => r.json())
      .then((d) => setStatus(d as CalendarStatus))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function disconnect(provider: "GOOGLE" | "OUTLOOK") {
    if (!confirm(`Disconnect ${provider === "GOOGLE" ? "Google" : "Outlook"} Calendar? Your appointments will no longer sync.`)) return;
    setDisconnecting(provider);
    try {
      const res = await fetch("/api/calendar/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new ApiError(res.status, "Failed to disconnect");
      setStatus((s) => s ? { ...s, [provider.toLowerCase()]: false } : s);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Failed to disconnect");
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Calendar Integration"
        breadcrumb={[
          { label: "Dashboard" },
          { label: "Settings", href: "/dashboard/settings" },
          { label: "Calendar" },
        ]}
      />

      <main className="flex-1 p-6 max-w-2xl space-y-6">

        {/* Success / error banners */}
        {successMsg && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Explanation */}
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-4 text-sm text-blue-700 space-y-1">
          <p className="font-semibold">How it works</p>
          <p>When you connect your calendar, every appointment assigned to you is automatically added to your personal calendar. If an appointment is rescheduled or cancelled, your calendar updates instantly.</p>
          <p className="text-blue-500 text-xs mt-1">Your calendar credentials are stored encrypted and only used to push appointment events. We never read your existing calendar events.</p>
        </div>

        {/* Google Calendar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Google colour logo */}
              <div className="h-10 w-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 24 24" className="h-6 w-6">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Google Calendar</p>
                <p className="text-xs text-gray-500">Sync appointments to your Google account</p>
              </div>
            </div>

            {loading ? (
              <div className="h-8 w-24 rounded-lg bg-gray-100 animate-pulse" />
            ) : status?.google ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Connected
                </div>
                <button
                  onClick={() => disconnect("GOOGLE")}
                  disabled={disconnecting === "GOOGLE"}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  {disconnecting === "GOOGLE" ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            ) : (
              <a
                href="/api/calendar/google"
                className="inline-flex items-center gap-2 rounded-lg bg-white border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect Google
              </a>
            )}
          </div>
        </div>

        {/* Outlook Calendar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#0078D4] flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="white">
                  <path d="M7 6h4.5C13.43 6 15 7.57 15 9.5S13.43 13 11.5 13H9v4H7V6zm2 5h2.5c.83 0 1.5-.67 1.5-1.5S12.33 8 11.5 8H9v3zM16 8h1v10h-1z"/>
                  <path d="M17 8l3 2v6l-3 2V8z"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Outlook Calendar</p>
                <p className="text-xs text-gray-500">Sync appointments to your Microsoft account</p>
              </div>
            </div>

            {loading ? (
              <div className="h-8 w-24 rounded-lg bg-gray-100 animate-pulse" />
            ) : status?.outlook ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Connected
                </div>
                <button
                  onClick={() => disconnect("OUTLOOK")}
                  disabled={disconnecting === "OUTLOOK"}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  {disconnecting === "OUTLOOK" ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            ) : (
              <a
                href="/api/calendar/outlook"
                className="inline-flex items-center gap-2 rounded-lg bg-[#0078D4] px-3 py-2 text-sm font-medium text-white hover:bg-[#006CBE] shadow-sm transition"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="white">
                  <path d="M7 6h4.5C13.43 6 15 7.57 15 9.5S13.43 13 11.5 13H9v4H7V6zm2 5h2.5c.83 0 1.5-.67 1.5-1.5S12.33 8 11.5 8H9v3z"/>
                </svg>
                Connect Outlook
              </a>
            )}
          </div>
        </div>

        {/* Setup guide for admins */}
        <details className="group rounded-xl border border-gray-200 bg-white">
          <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <span>🔧 Admin setup guide (one-time)</span>
            <svg className="h-4 w-4 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-5 pb-5 text-sm text-gray-600 space-y-4 border-t border-gray-100 pt-4">
            <div>
              <p className="font-semibold text-gray-800 mb-1">Google Calendar</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-gray-500">
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.cloud.google.com</a></li>
                <li>Create a project → APIs &amp; Services → Enable &quot;Google Calendar API&quot;</li>
                <li>OAuth 2.0 Credentials → Web Application</li>
                <li>Add redirect URI: <code className="bg-gray-100 px-1 rounded">{"{your-domain}"}/api/calendar/google/callback</code></li>
                <li>Copy Client ID + Secret → add to environment variables</li>
              </ol>
              <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-500">
                GOOGLE_CLIENT_ID=...<br/>
                GOOGLE_CLIENT_SECRET=...<br/>
                GOOGLE_REDIRECT_URI=https://yourdomain.com/api/calendar/google/callback
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-800 mb-1">Outlook / Microsoft</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-gray-500">
                <li>Go to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">portal.azure.com</a> → App registrations → New</li>
                <li>Accounts in any org directory + personal Microsoft accounts</li>
                <li>Add redirect URI: <code className="bg-gray-100 px-1 rounded">{"{your-domain}"}/api/calendar/outlook/callback</code></li>
                <li>Certificates &amp; secrets → New client secret</li>
                <li>API permissions → Microsoft Graph → Calendars.ReadWrite (delegated)</li>
              </ol>
              <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-500">
                MICROSOFT_CLIENT_ID=...<br/>
                MICROSOFT_CLIENT_SECRET=...<br/>
                MICROSOFT_REDIRECT_URI=https://yourdomain.com/api/calendar/outlook/callback
              </div>
            </div>
          </div>
        </details>

      </main>
    </div>
  );
}

export default function CalendarSettingsPage() {
  return (
    <Suspense>
      <CalendarSettingsInner />
    </Suspense>
  );
}
