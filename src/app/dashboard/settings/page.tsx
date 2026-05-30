"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";

interface OrgProfile {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
}

export default function SettingsPage() {
  const [org, setOrg] = useState<OrgProfile | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/org/profile")
      .then(r => r.json())
      .then(data => {
        const o = data.organization;
        setOrg(o);
        setForm({
          name: o.name || "",
          address: o.address || "",
          phone: o.phone || "",
          email: o.email || "",
        });
        setLoading(false);
      });
  }, []);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [field]: e.target.value }));
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/org/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setMessage("Organization settings saved successfully.");
    } else {
      const data = await res.json();
      setMessage(data.error || "Failed to save.");
    }
    setSaving(false);
  }

  if (loading) return <div className="flex-1 p-6 text-slate-500">Loading...</div>;

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Settings" breadcrumb={[{ label: "Dashboard" }, { label: "Settings" }]} />
      <main className="flex-1 p-6 max-w-2xl">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Organization Profile</h2>
          <p className="text-sm text-slate-500 mb-6">Update your clinic's information</p>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Organization Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={update("name")}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={update("phone")}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={update("email")}
                placeholder="clinic@example.com"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
              <textarea
                value={form.address}
                onChange={update("address")}
                rows={3}
                placeholder="Clinic address"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {message && (
              <div className={`text-sm rounded-lg px-4 py-3 ${message.includes("success") ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                {message}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-6 py-2.5 rounded-lg transition text-sm"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        {org && (
          <div className="mt-4 bg-slate-50 rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Organization ID: <code className="text-slate-700">{org.id}</code></p>
            <p className="text-xs text-slate-500 mt-1">Slug: <code className="text-slate-700">{org.slug}</code></p>
          </div>
        )}
      </main>
    </div>
  );
}
