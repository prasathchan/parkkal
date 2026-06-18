"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { orgApi, ApiError } from "@/api";

const REGION_LABELS: Record<string, { label: string; flag: string; desc: string }> = {
  global: {
    label: "Global (Cloudflare Network)",
    flag: "🌐",
    desc: "Data is distributed across Cloudflare's global edge network. Requests are served from the nearest point of presence worldwide.",
  },
  india: {
    label: "India (Asia-South)",
    flag: "🇮🇳",
    desc: "Primary data storage in Cloudflare's Asia-South region, co-located with Indian infrastructure. Recommended for Indian healthcare compliance.",
  },
  eu: {
    label: "European Union",
    flag: "🇪🇺",
    desc: "Primary data storage within EU jurisdiction. Required for GDPR compliance when treating EU-resident patients.",
  },
};

interface InfraCard {
  name: string;
  type: string;
  purpose: string;
  region: string;
}

const INFRA: InfraCard[] = [
  { name: "Cloudflare D1",      type: "Database",       purpose: "Patient records, visits, appointments, billing",  region: "Follows selected data region" },
  { name: "Cloudflare R2",      type: "Object Storage", purpose: "Consent documents, X-rays, clinical photos",       region: "Follows selected data region" },
  { name: "Cloudflare Workers", type: "Compute",        purpose: "API layer — processes all requests",               region: "Edge — nearest PoP" },
  { name: "Resend",             type: "Email",          purpose: "Transactional email (OTPs, invoices)",             region: "US (no PHI in transit)" },
];

export default function DataResidencyPage() {
  const [region, setRegion]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    orgApi.getProfile()
      .then((d) => {
        const r = (d.organization as unknown as Record<string, unknown>)?.dataRegion as string | undefined;
        setRegion(r || "global");
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const regionInfo = region ? (REGION_LABELS[region] ?? REGION_LABELS.global) : null;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Data Residency"
        breadcrumb={[
          { label: "Dashboard" },
          { label: "Settings", href: "/dashboard/settings" },
          { label: "Data Residency" },
        ]}
      />

      <main id="main-content" className="flex-1 p-6 max-w-3xl space-y-6">
        {error && (
          <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* Active region */}
        <div className="bg-pk-surface rounded-pk-lg border border-pk-border shadow-pk-e1 p-6">
          <h2 className="text-base font-semibold text-pk-text mb-4">Active Data Region</h2>
          {loading ? (
            <div className="h-16 bg-pk-surface-raised animate-pulse rounded-pk-sm" />
          ) : regionInfo ? (
            <div className="flex items-start gap-4 p-4 rounded-pk-sm bg-pk-teal-50 border border-pk-teal-200">
              <span className="text-3xl">{regionInfo.flag}</span>
              <div>
                <p className="font-semibold text-pk-text">{regionInfo.label}</p>
                <p className="text-sm text-pk-text-secondary mt-1">{regionInfo.desc}</p>
              </div>
            </div>
          ) : null}
          <p className="text-xs text-pk-text-muted mt-3">
            To change the data region, go to{" "}
            <a href="/dashboard/settings?tab=security" className="text-pk-teal-600 underline">
              Settings → Security
            </a>
            . Changes take effect for new data; migrating existing data requires a support request.
          </p>
        </div>

        {/* Infrastructure breakdown */}
        <div className="bg-pk-surface rounded-pk-lg border border-pk-border shadow-pk-e1 p-6">
          <h2 className="text-base font-semibold text-pk-text mb-4">Infrastructure</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pk-border">
                  <th className="text-left py-2 pr-4 text-pk-text-secondary font-medium">Service</th>
                  <th className="text-left py-2 pr-4 text-pk-text-secondary font-medium">Type</th>
                  <th className="text-left py-2 pr-4 text-pk-text-secondary font-medium">Stores / Processes</th>
                  <th className="text-left py-2 text-pk-text-secondary font-medium">Region</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pk-border">
                {INFRA.map((row) => (
                  <tr key={row.name}>
                    <td className="py-2.5 pr-4 font-medium text-pk-text">{row.name}</td>
                    <td className="py-2.5 pr-4 text-pk-text-secondary">{row.type}</td>
                    <td className="py-2.5 pr-4 text-pk-text-secondary">{row.purpose}</td>
                    <td className="py-2.5 text-pk-text-muted text-xs">{row.region}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Encryption & compliance */}
        <div className="bg-pk-surface rounded-pk-lg border border-pk-border shadow-pk-e1 p-6">
          <h2 className="text-base font-semibold text-pk-text mb-4">Encryption & Compliance</h2>
          <ul className="space-y-3 text-sm text-pk-text-secondary">
            {[
              { icon: "🔒", text: "All data encrypted at rest using AES-256" },
              { icon: "🔐", text: "PII fields (Aadhaar, PAN) encrypted with AES-256-GCM before storage" },
              { icon: "🌐", text: "All traffic encrypted in transit via TLS 1.3" },
              { icon: "📋", text: "Audit log captures all admin actions with actor and timestamp" },
              { icon: "🗑️", text: "Data retention follows the policy set in Settings (default 7 years)" },
            ].map(({ icon, text }) => (
              <li key={text} className="flex items-start gap-2.5">
                <span>{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* DPA / support */}
        <div className="bg-pk-surface rounded-pk-lg border border-pk-border shadow-pk-e1 p-6">
          <h2 className="text-base font-semibold text-pk-text mb-2">Data Processing & Support</h2>
          <p className="text-sm text-pk-text-secondary">
            For Data Processing Agreements (DPA), region migration requests, or compliance queries,
            contact your Parkkal CSM or email{" "}
            <a href="mailto:privacy@parkkal.com" className="text-pk-teal-600 underline">
              privacy@parkkal.com
            </a>
            .
          </p>
          <p className="text-sm text-pk-text-muted mt-2">
            App-level error logs are available to admins at{" "}
            <a href="/dashboard/settings/app-logs" className="text-pk-teal-600 underline">App Logs</a>
            {" "}and compliance audit trail at{" "}
            <a href="/dashboard/settings/audit-log" className="text-pk-teal-600 underline">Audit Log</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
