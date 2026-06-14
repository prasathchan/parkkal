"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { orgApi, ApiError } from "@/api";

export default function AcceptDpaPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    if (!checked) return;
    setLoading(true);
    setError("");
    try {
      await orgApi.acceptDpa();
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-pk-surface-raised flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-pk-border shadow-sm max-w-lg w-full p-8">
        <div className="mb-6">
          <div className="w-12 h-12 rounded-xl bg-pk-teal-50 border border-pk-teal-100 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-pk-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-pk-text mb-1">Data Processing Agreement</h1>
          <p className="text-sm text-pk-text-muted">
            Before using Parkkal, your clinic must accept our Data Processing Agreement (DPA) as required by the
            Digital Personal Data Protection Act 2023.
          </p>
        </div>

        <div className="bg-pk-surface-raised rounded-xl border border-pk-border p-4 mb-6 text-sm text-pk-text-secondary space-y-2 max-h-48 overflow-y-auto">
          <p className="font-semibold text-pk-text">Summary of Key Terms</p>
          <p>Parkkal acts as a <strong>Data Processor</strong> on behalf of your clinic (the Data Fiduciary) for all patient personal data stored in the system.</p>
          <p>Your clinic is responsible for ensuring patients have given informed consent before their data is collected.</p>
          <p>Patient data is stored securely, encrypted at rest, and never shared with third parties except where required by law.</p>
          <p>You may request data erasure for any patient at any time through the patient profile page.</p>
          <p>Records are retained for the period specified in your organisation settings (default: 7 years, as required by the DPDP Act 2023).</p>
          <p>
            <a href="/legal/dpa/v1" target="_blank" rel="noreferrer" className="text-pk-teal-600 hover:underline">
              Read the full Data Processing Agreement →
            </a>
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-6">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-pk-border-strong text-pk-teal-600 focus:ring-pk-teal-500"
          />
          <span className="text-sm text-pk-text-secondary">
            I confirm that I am authorised to accept this agreement on behalf of my clinic, and I agree to the{" "}
            <a href="/legal/dpa/v1" target="_blank" rel="noreferrer" className="text-pk-teal-600 hover:underline">
              Data Processing Agreement
            </a>{" "}
            (version 1).
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-600 mb-4">{error}</p>
        )}

        <button
          onClick={handleAccept}
          disabled={!checked || loading}
          className="w-full bg-pk-teal-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-pk-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Accepting…" : "Accept & Continue to Dashboard"}
        </button>
      </div>
    </div>
  );
}
