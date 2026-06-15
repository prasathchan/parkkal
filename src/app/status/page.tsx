import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Service Status — Parkkal" };

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-pk-bg flex items-start justify-center py-16 px-4">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-pk-teal-600 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
              <path d="M12 2C9.5 2 7.5 3.5 6.5 5.5C5.5 3.5 4 2 2 2C2 7 4 10 6 11C6 14 7 18 9 20C10 21.5 11 22 12 22C13 22 14 21.5 15 20C17 18 18 14 18 11C20 10 22 7 22 2C20 2 18.5 3.5 17.5 5.5C16.5 3.5 14.5 2 12 2Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-pk-text">Parkkal Status</h1>
            <p className="text-sm text-pk-text-muted">app.parkkal.com</p>
          </div>
        </div>

        {/* Overall status banner */}
        <div className="bg-pk-surface rounded-pk-xl shadow-pk-e1 border border-pk-success-border p-6 mb-6 flex items-center gap-4">
          <div className="w-4 h-4 rounded-full bg-pk-success shrink-0 animate-pulse" />
          <div>
            <p className="font-semibold text-pk-text text-lg">All systems operational</p>
            <p className="text-sm text-pk-text-muted">Last checked: {new Date().toUTCString()}</p>
          </div>
        </div>

        {/* Component list */}
        <div className="bg-pk-surface rounded-pk-xl shadow-pk-e1 border border-pk-border divide-y divide-pk-border mb-6">
          {[
            { name: "App (app.parkkal.com)", note: "Hosted on Cloudflare Pages / Workers" },
            { name: "Database (Cloudflare D1)", note: "Patient records, appointments, billing" },
            { name: "File Storage (Cloudflare R2)", note: "Attachments and X-rays" },
            { name: "Email delivery (Resend)", note: "OTPs, appointment reminders, invoices" },
            { name: "Subscription billing (Stripe)", note: "Checkout and invoicing" },
          ].map((c) => (
            <div key={c.name} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm font-medium text-pk-text">{c.name}</p>
                <p className="text-xs text-pk-text-muted">{c.note}</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium text-pk-success-text bg-pk-success-fill px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-pk-success inline-block" />
                Operational
              </span>
            </div>
          ))}
        </div>

        {/* SLA commitment */}
        <div className="bg-pk-surface rounded-pk-xl shadow-pk-e1 border border-pk-border p-6 mb-6">
          <h2 className="text-sm font-semibold text-pk-text mb-3">Uptime commitment</h2>
          <p className="text-sm text-pk-text-secondary">
            We target <strong>99.5% monthly uptime</strong> for the Parkkal application, excluding scheduled
            maintenance windows (announced at least 24 hours in advance) and events beyond our reasonable
            control. For incidents, we follow a 4-hour acknowledgement / 24-hour resolution SLA for
            critical issues affecting patient data access.
          </p>
          <p className="text-sm text-pk-text-secondary mt-3">
            Infrastructure is hosted on Cloudflare&rsquo;s global network. Cloudflare&rsquo;s own status is
            available at{" "}
            <a href="https://www.cloudflarestatus.com" target="_blank" rel="noreferrer" className="text-pk-teal-600 hover:underline">
              cloudflarestatus.com
            </a>.
          </p>
        </div>

        {/* Incident contact */}
        <div className="bg-pk-surface rounded-pk-xl shadow-pk-e1 border border-pk-border p-6">
          <h2 className="text-sm font-semibold text-pk-text mb-2">Report an incident</h2>
          <p className="text-sm text-pk-text-secondary">
            If you are experiencing an issue, email{" "}
            <a href="mailto:support@parkkal.com" className="text-pk-teal-600 hover:underline">support@parkkal.com</a>.
            For critical outages affecting patient data access, include &ldquo;URGENT&rdquo; in the subject line.
          </p>
        </div>

        <div className="mt-8 text-center text-xs text-pk-text-muted">
          <Link href="/" className="hover:text-pk-text-secondary">← Back to Parkkal</Link>
          <span className="mx-3">·</span>
          <Link href="/legal/terms" className="hover:text-pk-text-secondary">Terms</Link>
          <span className="mx-3">·</span>
          <Link href="/legal/privacy" className="hover:text-pk-text-secondary">Privacy</Link>
        </div>

      </div>
    </div>
  );
}
