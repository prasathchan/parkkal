"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { orgApi, ApiError, type OrgDrug } from "@/api";

const EMPTY_FORM = { name: "", defaultDosage: "", defaultFrequency: "", defaultDuration: "" };
const FREQ_PRESETS = ["1-0-1", "1-1-1", "0-0-1", "1-0-0", "BD", "TDS", "OD", "SOS"];

export default function DrugFormularyPage() {
  const [drugs, setDrugs] = useState<OrgDrug[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    try {
      const { drugs: list } = await orgApi.drugs.list();
      setDrugs(list);
    } catch {
      // silent — empty list is fine
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Drug name is required"); return; }
    setSubmitting(true);
    setError("");
    try {
      await orgApi.drugs.add({
        name: form.name.trim(),
        defaultDosage:    form.defaultDosage.trim() || undefined,
        defaultFrequency: form.defaultFrequency.trim() || undefined,
        defaultDuration:  form.defaultDuration.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add drug");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this drug from your formulary?")) return;
    setDeletingId(id);
    try {
      await orgApi.drugs.delete(id);
      setDrugs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // noop
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Header
        title="Drug Formulary"
        breadcrumb={[{ label: "Dashboard" }, { label: "Settings", href: "/dashboard/settings" }, { label: "Drug Formulary" }]}
      />

      <main id="main-content" className="flex-1 p-6 max-w-2xl space-y-6">
        {/* Explanation */}
        <div className="rounded-xl border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>Your clinic&apos;s drug list</h2>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Drugs you add here appear <strong>first</strong> in the prescription autocomplete, labelled &ldquo;Your Drugs&rdquo;.
            The built-in list of common dental drugs is always available as a fallback.
          </p>
        </div>

        {/* Add button / form */}
        {!showForm ? (
          <button
            onClick={() => { setShowForm(true); setError(""); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition"
            style={{ background: "var(--primary)" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Drug
          </button>
        ) : (
          <form
            onSubmit={handleAdd}
            className="rounded-xl border p-5 space-y-4"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>New drug</h3>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
                Drug name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Amoxicillin 500mg"
                autoFocus
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Default dosage</label>
                <input
                  type="text"
                  value={form.defaultDosage}
                  onChange={(e) => setForm((f) => ({ ...f, defaultDosage: e.target.value }))}
                  placeholder="e.g. 1 tablet"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                  style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Default frequency</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={form.defaultFrequency}
                    onChange={(e) => setForm((f) => ({ ...f, defaultFrequency: e.target.value }))}
                    placeholder="e.g. 1-0-1"
                    className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                    style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                  />
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) setForm((f) => ({ ...f, defaultFrequency: e.target.value })); }}
                    className="text-xs border rounded-lg px-2 py-2 focus:outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}
                  >
                    <option value="">Preset</option>
                    {FREQ_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Default duration</label>
                <input
                  type="text"
                  value={form.defaultDuration}
                  onChange={(e) => setForm((f) => ({ ...f, defaultDuration: e.target.value }))}
                  placeholder="e.g. 5 days"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                  style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                />
              </div>
            </div>

            {error && <p className="text-xs" style={{ color: "#dc2626" }}>{error}</p>}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(""); }}
                className="px-4 py-2 text-sm border rounded-lg transition"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium rounded-lg text-white transition disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {submitting ? "Adding…" : "Add Drug"}
              </button>
            </div>
          </form>
        )}

        {/* Drug list */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          {loading ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>Loading…</p>
          ) : drugs.length === 0 ? (
            <div className="py-10 text-center">
              <svg className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--muted-foreground)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>No drugs in your formulary yet</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Add drugs your clinic uses most often to speed up prescriptions.</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div
                className="grid px-5 py-2.5 text-xs font-medium border-b"
                style={{ gridTemplateColumns: "1fr 100px 100px 100px 40px", background: "var(--muted)", borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                <span>Drug name</span>
                <span>Dosage</span>
                <span>Frequency</span>
                <span>Duration</span>
                <span />
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {drugs.map((drug) => (
                  <div
                    key={drug.id}
                    className="grid items-center px-5 py-3"
                    style={{ gridTemplateColumns: "1fr 100px 100px 100px 40px" }}
                  >
                    <span className="text-sm font-medium truncate pr-2" style={{ color: "var(--foreground)" }}>{drug.name}</span>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{drug.defaultDosage || "—"}</span>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{drug.defaultFrequency || "—"}</span>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{drug.defaultDuration || "—"}</span>
                    <button
                      onClick={() => handleDelete(drug.id)}
                      disabled={deletingId === drug.id}
                      aria-label={`Remove ${drug.name}`}
                      className="flex items-center justify-center w-7 h-7 rounded-lg transition disabled:opacity-40"
                      style={{ color: "#dc2626" }}
                    >
                      {deletingId === drug.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Changes apply immediately to the prescription form.{" "}
          <Link href="/dashboard/settings" className="underline">Back to settings</Link>
        </p>
      </main>
    </div>
  );
}
