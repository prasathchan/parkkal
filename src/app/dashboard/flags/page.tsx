"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { useRouter } from "next/navigation";

interface FlagData {
  featureKey: string;
  name: string;
  description: string | null;
  globalEnabled: boolean;
  orgEnabled: boolean | null;
  effectiveEnabled: boolean;
  rolloutPercent: number;
}

const PHASE_BADGES: Record<string, string | null> = {
  ff_appointment_source: null,
  ff_dental_chart: "Phase 2",
  ff_patient_portal: "Phase 2",
  ff_pdf_export: "Phase 2",
  ff_whatsapp_notify: "Phase 2",
  ff_inventory: "Phase 2",
  ff_analytics: "Phase 2",
  ff_lab_integration: "Phase 3",
};

interface ToggleModalProps {
  flag: FlagData;
  newEnabled: boolean;
  orgName: string;
  onConfirm: (scope: "org" | "global") => void;
  onCancel: () => void;
}

function ToggleModal({ flag, newEnabled, orgName, onConfirm, onCancel }: ToggleModalProps) {
  const action = newEnabled ? "Enable" : "Disable";
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          {action} &ldquo;{flag.name}&rdquo;?
        </h3>
        <p className="text-sm text-slate-600 mb-6">
          {newEnabled
            ? `This will make the feature available to all staff at this organization.`
            : `This will hide the feature from all staff at this organization.`}
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onConfirm("org")}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            {action} for {orgName} only
          </button>
          <button
            onClick={() => onConfirm("global")}
            className="w-full px-4 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition"
          >
            {action} globally (all orgs)
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FlagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("Your Organization");
  const [pendingToggle, setPendingToggle] = useState<{ flag: FlagData; newEnabled: boolean } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const router = useRouter();

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/flags");
      if (res.status === 403) {
        router.push("/dashboard");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setFlags(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchFlags();
    // Try to get org name from cookies via a session endpoint
    fetch("/api/auth/session").then(r => r.json()).then(d => {
      if (d?.orgName) setOrgName(d.orgName);
    }).catch(() => {});
  }, [fetchFlags]);

  async function handleToggleConfirm(scope: "org" | "global") {
    if (!pendingToggle) return;
    const { flag, newEnabled } = pendingToggle;
    setPendingToggle(null);
    setSaving(flag.featureKey);

    try {
      const res = await fetch(`/api/admin/flags/${flag.featureKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: newEnabled, scope }),
      });
      if (res.ok) {
        await fetchFlags();
      }
    } finally {
      setSaving(null);
    }
  }

  function getStatusText(flag: FlagData) {
    if (flag.orgEnabled !== null) {
      return flag.orgEnabled
        ? "Enabled (Org override)"
        : "Disabled (Org override)";
    }
    return flag.globalEnabled
      ? "Enabled (Global default)"
      : "Disabled (Global default)";
  }

  const orgOverrides = flags.filter(f => f.orgEnabled !== null);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Feature Flags"
        breadcrumb={[{ label: "Home" }, { label: "Dashboard", href: "/dashboard" }, { label: "Feature Flags" }]}
      />

      <main className="flex-1 p-6 space-y-8">
        {/* Org Overrides Section */}
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2">Your Organization Overrides</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700 mb-4">
            These settings only affect <strong>{orgName}</strong>. Global defaults apply where no override is set.
          </div>
          {orgOverrides.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No org-specific overrides set yet.</p>
          ) : (
            <div className="space-y-3">
              {orgOverrides.map(flag => (
                <FlagCard
                  key={flag.featureKey}
                  flag={flag}
                  saving={saving === flag.featureKey}
                  onToggle={() => setPendingToggle({ flag, newEnabled: !flag.effectiveEnabled })}
                  getStatusText={getStatusText}
                />
              ))}
            </div>
          )}
        </section>

        {/* All Features Section */}
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-4">All Features</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {flags.map(flag => (
                <FlagCard
                  key={flag.featureKey}
                  flag={flag}
                  saving={saving === flag.featureKey}
                  onToggle={() => setPendingToggle({ flag, newEnabled: !flag.effectiveEnabled })}
                  getStatusText={getStatusText}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {pendingToggle && (
        <ToggleModal
          flag={pendingToggle.flag}
          newEnabled={pendingToggle.newEnabled}
          orgName={orgName}
          onConfirm={handleToggleConfirm}
          onCancel={() => setPendingToggle(null)}
        />
      )}
    </div>
  );
}

interface FlagCardProps {
  flag: FlagData;
  saving: boolean;
  onToggle: () => void;
  getStatusText: (flag: FlagData) => string;
}

function FlagCard({ flag, saving, onToggle, getStatusText }: FlagCardProps) {
  const phase = PHASE_BADGES[flag.featureKey];
  const enabled = flag.effectiveEnabled;

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-start justify-between gap-4 shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-900 text-sm">{flag.name}</span>
          {phase && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {phase}
            </span>
          )}
        </div>
        {flag.description && (
          <p className="text-xs text-slate-500 mt-0.5">{flag.description}</p>
        )}
        <p className={`text-xs mt-1 font-medium ${enabled ? "text-green-600" : "text-slate-400"}`}>
          {enabled ? "✅" : "🔒"} {getStatusText(flag)}
        </p>
      </div>
      <div className="flex-shrink-0 flex items-center gap-3">
        <button
          onClick={onToggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            enabled ? "bg-blue-600" : "bg-slate-200"
          } ${saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          role="switch"
          aria-checked={enabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className={`text-xs font-medium ${enabled ? "text-blue-600" : "text-slate-400"}`}>
          {enabled ? "ON" : "OFF"}
        </span>
      </div>
    </div>
  );
}
