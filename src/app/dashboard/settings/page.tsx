"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useToast } from "@/context/toast-context";
import { Header } from "@/components/header";
import { AddressForm, type AddressValue } from "@/components/ui/address-form";
import Link from "next/link";
import { type OrgThemeConfig, DEFAULT_THEME, COLOR_PRESETS, FONT_OPTIONS, parseThemeConfig } from "@/lib/theme";
import { parseAddress, serializeAddress, EMPTY_ADDRESS } from "@/lib/address";
import { orgApi, authApi, ApiError } from "@/api";
import type { OrgProfile, StaffMember } from "@/types";

interface AdminMember {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
}


type Tab = "profile" | "appearance" | "security";

export default function SettingsPage() {
  const { toast } = useToast();
  const [org, setOrg] = useState<OrgProfile | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [form, setForm] = useState({ name: "", tagline: "", phone: "", email: "" });
  const [adminMembers, setAdminMembers] = useState<AdminMember[]>([]);
  const [addressData, setAddressData] = useState<AddressValue>({ ...EMPTY_ADDRESS });
  const [theme, setTheme] = useState<OrgThemeConfig>(DEFAULT_THEME);
  const [customColor, setCustomColor] = useState("#2563eb");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gstForm, setGstForm] = useState({ gstin: "", gstRegistered: false, gstStateCode: "", cgstRate: 9, sgstRate: 9 });
  const [dataRetentionYears, setDataRetentionYears] = useState(7);
  const [dpaStatus, setDpaStatus] = useState<{ version: string | null; acceptedAt: number | null }>({ version: null, acceptedAt: null });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    orgApi.getProfile()
      .then(data => {
        const o = data.organization;
        setOrg(o);
        setForm({ name: o.name || "", tagline: o.tagline ?? "", phone: o.phone ?? "", email: o.email ?? "" });
        setAddressData(parseAddress(o.address ?? null));
        const t = parseThemeConfig(o.themeConfig ?? null);
        setTheme(t);
        setCustomColor(t.primaryColor);
        setLogoPreview(o.logoUrl ?? null);
        const orgAny = o as unknown as Record<string, unknown>;
        setGstForm({
          gstin: (orgAny.gstin as string) ?? "",
          gstRegistered: !!orgAny.gstRegistered,
          gstStateCode: (orgAny.gstStateCode as string) ?? "",
          cgstRate: (orgAny.cgstRate as number) ?? 9,
          sgstRate: (orgAny.sgstRate as number) ?? 9,
        });
        setDataRetentionYears((orgAny.dataRetentionYears as number) ?? 7);
        setDpaStatus({ version: (o.dpaVersion ?? null), acceptedAt: (o.dpaAcceptedAt ?? null) });
        setLoading(false);
      });
    orgApi.members.list()
      .then(data => {
        const admins = (data.members ?? []).filter((m: StaffMember) => m.role === "ADMIN");
        setAdminMembers(admins.map((m: StaffMember) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          phone: m.phone ?? null,
        })));
      })
      .catch(() => {});
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await orgApi.updateProfile({
        ...form,
        tagline: form.tagline || null,
        address: serializeAddress(addressData),
        gstin: gstForm.gstin || null,
        gstRegistered: gstForm.gstRegistered,
        gstStateCode: gstForm.gstStateCode || null,
        cgstRate: gstForm.cgstRate,
        sgstRate: gstForm.sgstRate,
        dataRetentionYears,
      } as Parameters<typeof orgApi.updateProfile>[0]);
      toast.success("Profile saved successfully");
      setMessage("Profile saved successfully.");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to save.";
      toast.error(msg);
      setMessage(msg);
    }
    setSaving(false);
  }

  async function handleSaveAppearance() {
    setSaving(true);
    setMessage("");
    try {
      await orgApi.updateProfile({ themeConfig: theme });
      toast.success("Appearance saved");
      setMessage("Appearance saved. Refresh to see all changes.");
      // Apply immediately
      document.documentElement.style.setProperty("--primary", theme.primaryColor);
      const fontOpt = FONT_OPTIONS.find(f => f.value === theme.fontFamily);
      if (fontOpt) document.documentElement.style.setProperty("--font-body", fontOpt.stack);
      if (theme.darkMode === "dark") document.documentElement.classList.add("dark");
      else if (theme.darkMode === "light") document.documentElement.classList.remove("dark");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to save.";
      toast.error(msg);
      setMessage(msg);
    }
    setSaving(false);
  }

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    try {
      const { logoUrl } = await orgApi.uploadLogo(file);
      setLogoPreview(logoUrl);
      setOrg(o => o ? { ...o, logoUrl } : o);
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "Logo upload failed.");
    }
    setLogoUploading(false);
  }

  async function handleRemoveLogo() {
    await orgApi.deleteLogo();
    setLogoPreview(null);
    setOrg(o => o ? { ...o, logoUrl: null } : o);
  }

  if (loading) return <div className="flex-1 p-6 text-slate-500" style={{ color: "var(--muted-foreground)" }}>Loading...</div>;

  async function handleDeleteOrg() {
    setDeleteError("");
    setDeleteSubmitting(true);
    try {
      await orgApi.delete(deleteConfirmName);
      await authApi.logout();
      window.location.href = "/login";
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : "Something went wrong.");
      setDeleteSubmitting(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Organization Profile" },
    { id: "appearance", label: "Appearance" },
    { id: "security", label: "Security" },
  ];

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    setPwSaving(true);
    setPwMessage(null);
    try {
      await authApi.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success("Password changed successfully");
      setPwMessage({ type: "success", text: "Password changed successfully." });
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
      toast.error(msg);
      setPwMessage({ type: "error", text: msg });
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Header title="Settings" breadcrumb={[{ label: "Dashboard" }, { label: "Settings" }]} />
      <main className="flex-1 p-6 max-w-2xl">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ background: "var(--muted)" }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setMessage(""); }}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={tab === t.id
                ? { background: "var(--card)", color: "var(--foreground)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                : { color: "var(--muted-foreground)" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {tab === "profile" && (
          <div className="rounded-xl border p-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>Organization Profile</h2>
            <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>Update your clinic&apos;s information</p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <Field label="Organization Name *">
                <input type="text" value={form.name} required onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="field-input" placeholder="e.g. Parkkal Dental Clinic" />
              </Field>
              <Field label="Tagline">
                <input type="text" value={form.tagline} maxLength={100} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} className="field-input" placeholder="e.g. One Platform. Every Clinic. Zero Compromises." />
              </Field>
              <Field label="Phone">
                <input type="text" value={form.phone} placeholder="+91 98765 43210" onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="field-input" />
              </Field>
              <Field label="Contact Person">
                <select
                  value={form.email}
                  onChange={e => {
                    const selected = adminMembers.find(m => m.email === e.target.value);
                    setForm(f => ({
                      ...f,
                      email: e.target.value,
                      phone: selected?.phone ?? f.phone,
                    }));
                  }}
                  className="field-input"
                >
                  <option value="">— None —</option>
                  {adminMembers.map(m => (
                    <option key={m.userId} value={m.email}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
                {form.email && (
                  <p className="text-xs text-slate-500 mt-1">Contact email: {form.email}</p>
                )}
              </Field>
              <Field label="Address">
                <AddressForm value={addressData} onChange={setAddressData} />
              </Field>

              {/* GST Section */}
              <div className="pt-4 mt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>GST Details (India)</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gstForm.gstRegistered}
                      onChange={e => setGstForm(g => ({ ...g, gstRegistered: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm" style={{ color: "var(--foreground)" }}>GST Registered</span>
                  </label>
                  {gstForm.gstRegistered && (
                    <>
                      <Field label="GSTIN (15-digit)">
                        <input
                          type="text"
                          value={gstForm.gstin}
                          onChange={e => setGstForm(g => ({ ...g, gstin: e.target.value.toUpperCase() }))}
                          placeholder="33ABCDE1234F1Z5"
                          maxLength={15}
                          className="field-input font-mono uppercase"
                        />
                      </Field>
                      <Field label="State Code">
                        <input
                          type="text"
                          value={gstForm.gstStateCode}
                          onChange={e => setGstForm(g => ({ ...g, gstStateCode: e.target.value }))}
                          placeholder="33 (Tamil Nadu)"
                          maxLength={2}
                          className="field-input"
                        />
                        <p className="text-xs text-slate-400 mt-0.5">First 2 digits of your GSTIN (e.g. 33 for Tamil Nadu, 27 for Maharashtra)</p>
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="CGST Rate (%)">
                          <input
                            type="number"
                            min={0}
                            max={14}
                            step={0.5}
                            value={gstForm.cgstRate}
                            onChange={e => setGstForm(g => ({ ...g, cgstRate: parseFloat(e.target.value) || 0 }))}
                            className="field-input"
                          />
                        </Field>
                        <Field label="SGST Rate (%)">
                          <input
                            type="number"
                            min={0}
                            max={14}
                            step={0.5}
                            value={gstForm.sgstRate}
                            onChange={e => setGstForm(g => ({ ...g, sgstRate: parseFloat(e.target.value) || 0 }))}
                            className="field-input"
                          />
                        </Field>
                      </div>
                      <p className="text-xs text-slate-400 -mt-1">
                        Total GST: {gstForm.cgstRate + gstForm.sgstRate}% — most dental procedures use 9% + 9% = 18%. Healthcare services may be exempt (0%).
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Data & Privacy Section */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>Data & Privacy (DPDP Act 2023)</h3>
                <div className="flex items-center gap-3">
                  <div className={`text-xs font-medium px-2.5 py-1 rounded-full border ${dpaStatus.acceptedAt ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
                    {dpaStatus.acceptedAt
                      ? `DPA accepted (${dpaStatus.version}) on ${new Date(dpaStatus.acceptedAt).toLocaleDateString("en-IN")}`
                      : "DPA not yet accepted"}
                  </div>
                  {!dpaStatus.acceptedAt && (
                    <a href="/accept-dpa" className="text-xs text-blue-600 hover:underline">Accept DPA →</a>
                  )}
                  <a href="/legal/dpa/v1" target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:underline ml-auto">View DPA text →</a>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Data retention period (years)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={dataRetentionYears}
                      onChange={e => setDataRetentionYears(Math.max(1, parseInt(e.target.value) || 7))}
                      className="field-input w-24"
                    />
                    <span className="text-xs text-slate-400">years (minimum 7 years recommended under DPDP Act 2023)</span>
                  </div>
                </div>
              </div>

              {message && <StatusMessage message={message} />}
              <div className="pt-2">
                <SaveButton saving={saving} label="Save Profile" />
              </div>
            </form>
          </div>
        )}

        {/* Appearance Tab */}
        {tab === "appearance" && (
          <div className="space-y-6">
            {/* Logo */}
            <Section title="Clinic Logo" subtitle="Upload your clinic logo — shown in the sidebar">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden flex-shrink-0" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                  {logoPreview ? (
                    <Image src={logoPreview} alt="Logo" width={80} height={80} className="w-full h-full object-contain" />
                  ) : (
                    <svg className="w-8 h-8" style={{ color: "var(--muted-foreground)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div className="space-y-2">
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={logoUploading}
                    className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--card)" }}>
                    {logoUploading ? "Uploading..." : "Upload Logo"}
                  </button>
                  {logoPreview && (
                    <button onClick={handleRemoveLogo} className="block px-4 py-2 text-sm rounded-lg transition-colors" style={{ color: "#ef4444" }}>
                      Remove
                    </button>
                  )}
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>PNG, JPG, SVG · Max 2MB</p>
                </div>
              </div>
            </Section>

            {/* Primary Color */}
            <Section title="Brand Color" subtitle="Used for buttons, active nav items, and accents">
              <div className="flex flex-wrap gap-2 mb-3">
                {COLOR_PRESETS.map(c => (
                  <button key={c.value} title={c.name} onClick={() => { setTheme(t => ({ ...t, primaryColor: c.value })); setCustomColor(c.value); }}
                    className="w-9 h-9 rounded-lg transition-all border-2"
                    style={{ background: c.value, borderColor: theme.primaryColor === c.value ? "var(--foreground)" : "transparent", outline: theme.primaryColor === c.value ? `3px solid ${c.value}30` : "none", outlineOffset: "2px" }}
                  />
                ))}
                {/* Custom color */}
                <label className="w-9 h-9 rounded-lg border-2 cursor-pointer overflow-hidden relative" title="Custom color"
                  style={{ borderColor: !COLOR_PRESETS.find(c => c.value === theme.primaryColor) ? "var(--foreground)" : "var(--border)" }}>
                  <input type="color" value={customColor} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={e => { setCustomColor(e.target.value); setTheme(t => ({ ...t, primaryColor: e.target.value })); }} />
                  <div className="w-full h-full flex items-center justify-center" style={{ background: customColor }}>
                    <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded" style={{ background: theme.primaryColor }} />
                <code className="text-xs" style={{ color: "var(--muted-foreground)" }}>{theme.primaryColor}</code>
              </div>
            </Section>

            {/* Font */}
            <Section title="Font Family" subtitle="Applied across the entire interface">
              <div className="space-y-2">
                {FONT_OPTIONS.map(f => (
                  <label key={f.value} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                    style={{ borderColor: theme.fontFamily === f.value ? theme.primaryColor : "var(--border)", background: theme.fontFamily === f.value ? `${theme.primaryColor}08` : "var(--card)" }}>
                    <input type="radio" name="font" value={f.value} checked={theme.fontFamily === f.value}
                      onChange={() => setTheme(t => ({ ...t, fontFamily: f.value as OrgThemeConfig["fontFamily"] }))} className="sr-only" />
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: theme.fontFamily === f.value ? theme.primaryColor : "var(--border)" }}>
                      {theme.fontFamily === f.value && <div className="w-2 h-2 rounded-full" style={{ background: theme.primaryColor }} />}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium" style={{ fontFamily: f.stack, color: "var(--foreground)" }}>{f.label}</span>
                      <span className="ml-2 text-xs" style={{ fontFamily: f.stack, color: "var(--muted-foreground)" }}>The quick brown fox jumps</span>
                    </div>
                  </label>
                ))}
              </div>
            </Section>

            {/* Sidebar Style */}
            <Section title="Sidebar Style" subtitle="Background style for the navigation sidebar">
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: "dark", label: "Dark", desc: "Classic dark sidebar", preview: "#0f172a" },
                  { value: "light", label: "Light", desc: "Clean white sidebar", preview: "#ffffff" },
                  { value: "colored", label: "Colored", desc: "Your brand color", preview: theme.primaryColor },
                ] as { value: OrgThemeConfig["sidebarStyle"]; label: string; desc: string; preview: string }[]).map(s => (
                  <button key={s.value} onClick={() => setTheme(t => ({ ...t, sidebarStyle: s.value }))}
                    className="p-3 rounded-xl border-2 text-left transition-all"
                    style={{ borderColor: theme.sidebarStyle === s.value ? theme.primaryColor : "var(--border)", background: "var(--card)" }}>
                    <div className="w-full h-10 rounded-lg mb-2 border" style={{ background: s.preview, borderColor: "var(--border)" }} />
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{s.label}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{s.desc}</p>
                  </button>
                ))}
              </div>
            </Section>

            {/* Dark Mode */}
            <Section title="Color Scheme" subtitle="Light, dark, or follow system preference">
              <div className="flex gap-2">
                {([
                  { value: "light", label: "Light", icon: "☀️" },
                  { value: "dark", label: "Dark", icon: "🌙" },
                  { value: "system", label: "System", icon: "💻" },
                ] as { value: OrgThemeConfig["darkMode"]; label: string; icon: string }[]).map(m => (
                  <button key={m.value} onClick={() => setTheme(t => ({ ...t, darkMode: m.value }))}
                    className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-sm font-medium transition-all"
                    style={{ borderColor: theme.darkMode === m.value ? theme.primaryColor : "var(--border)", background: theme.darkMode === m.value ? `${theme.primaryColor}10` : "var(--card)", color: theme.darkMode === m.value ? theme.primaryColor : "var(--muted-foreground)" }}>
                    <span className="text-xl">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Live Preview */}
            <Section title="Preview" subtitle="How your sidebar will look">
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                <div className="flex h-28">
                  <div className="w-40 flex flex-col p-3 gap-1.5" style={{ background: theme.sidebarStyle === "dark" ? "#0f172a" : theme.sidebarStyle === "light" ? "#ffffff" : theme.primaryColor, borderRight: `1px solid ${theme.sidebarStyle === "light" ? "#e2e8f0" : "rgba(255,255,255,0.1)"}` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded" style={{ background: theme.sidebarStyle === "colored" ? "rgba(255,255,255,0.2)" : theme.primaryColor }} />
                      <div className="h-2 rounded flex-1" style={{ background: theme.sidebarStyle === "dark" ? "#475569" : theme.sidebarStyle === "light" ? "#94a3b8" : "rgba(255,255,255,0.5)" }} />
                    </div>
                    {[true, false, false].map((active, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-md">
                        <div className="w-3 h-3 rounded-sm" style={{ background: active ? (theme.sidebarStyle === "dark" ? theme.primaryColor : theme.sidebarStyle === "light" ? theme.primaryColor : "rgba(255,255,255,0.9)") : (theme.sidebarStyle === "dark" ? "#475569" : theme.sidebarStyle === "light" ? "#94a3b8" : "rgba(255,255,255,0.4)") }} />
                        <div className="h-2 flex-1 rounded" style={{ background: active ? (theme.sidebarStyle === "dark" ? theme.primaryColor : theme.sidebarStyle === "light" ? theme.primaryColor : "rgba(255,255,255,0.9)") : (theme.sidebarStyle === "dark" ? "#334155" : theme.sidebarStyle === "light" ? "#e2e8f0" : "rgba(255,255,255,0.3)") }} />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 p-3" style={{ background: "var(--muted)" }}>
                    <div className="h-4 w-24 rounded mb-2" style={{ background: "var(--border)" }} />
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-10 rounded-lg" style={{ background: i === 1 ? `${theme.primaryColor}20` : "var(--card)" }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {message && <StatusMessage message={message} />}

            <button onClick={handleSaveAppearance} disabled={saving}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: saving ? "var(--muted-foreground)" : theme.primaryColor }}>
              {saving ? "Saving..." : "Save Appearance"}
            </button>
          </div>
        )}

        {org && tab === "profile" && (
          <div className="mt-4 rounded-xl border p-4 space-y-3" style={{ background: "var(--muted)", borderColor: "var(--border)" }}>
            <div>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Organization ID: <code style={{ color: "var(--foreground)" }}>{org.id}</code></p>
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Slug: <code style={{ color: "var(--foreground)" }}>{org.slug}</code></p>
            </div>
            <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "#dc2626" }}>Danger Zone</p>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Permanently delete this organization and all its data. This cannot be undone.</p>
                <button
                  onClick={() => { setShowDeleteDialog(true); setDeleteConfirmName(""); setDeleteError(""); }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                  style={{ background: "#dc2626" }}
                >
                  Delete Organization
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation dialog */}
        {showDeleteDialog && org && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Delete Organization</h3>
                  <p className="text-xs text-slate-500">This cannot be undone</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                This will <strong>immediately and permanently delete</strong> all data for <strong>{org.name}</strong> — patients, appointments, visits, staff, and all records. This cannot be undone.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Type <strong>{org.name}</strong> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={e => setDeleteConfirmName(e.target.value)}
                  placeholder={org.name}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {deleteError && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteDialog(false)}
                  className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteOrg}
                  disabled={deleteSubmitting || deleteConfirmName !== org.name}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40"
                  style={{ background: "#dc2626" }}
                >
                  {deleteSubmitting ? "Deleting..." : "Delete Organization"}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "security" && (
          <form onSubmit={handleChangePassword} className="space-y-5">
            <Section title="Change Password" subtitle="Update your account password. You must enter your current password to confirm.">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>Current Password</label>
                  <input type="password" required autoComplete="current-password"
                    value={pwForm.currentPassword}
                    onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>New Password</label>
                  <input type="password" required autoComplete="new-password" minLength={8}
                    value={pwForm.newPassword}
                    onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Minimum 8 characters.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>Confirm New Password</label>
                  <input type="password" required autoComplete="new-password"
                    value={pwForm.confirmPassword}
                    onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                </div>
                {pwMessage && (
                  <div className="text-sm rounded-lg px-4 py-3 border"
                    style={pwMessage.type === "success"
                      ? { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#15803d" }
                      : { background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626" }}>
                    {pwMessage.text}
                  </div>
                )}
                <SaveButton saving={pwSaving} label="Change Password" />
              </div>
            </Section>

            {/* Audit Log link */}
            <div className="rounded-xl border p-6 flex items-start justify-between gap-4"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Audit Log</h3>
                <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                  Review all administrative actions — staff changes, deletions, and role assignments. Visible to admins only.
                </p>
              </div>
              <Link
                href="/dashboard/settings/audit-log"
                className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg border transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                View Log →
              </Link>
            </div>

            {/* App Logs — errors & security events captured by the API layer */}
            <div className="rounded-xl border p-6 flex items-start justify-between gap-4"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>App Logs</h3>
                <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                  Errors, security events, and warnings captured by the API layer. Filter by level, route, user, and date range.
                </p>
              </div>
              <Link
                href="/dashboard/settings/app-logs"
                className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg border transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                View Logs →
              </Link>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>{label}</label>
      {children}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-semibold mb-0.5" style={{ color: "var(--foreground)" }}>{title}</h3>
      <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>{subtitle}</p>
      {children}
    </div>
  );
}

function SaveButton({ saving, label }: { saving: boolean; label: string }) {
  return (
    <button type="submit" disabled={saving}
      className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
      style={{ background: "var(--primary)" }}>
      {saving ? "Saving..." : label}
    </button>
  );
}

function StatusMessage({ message }: { message: string }) {
  const isSuccess = message.toLowerCase().includes("success") || message.toLowerCase().includes("saved") || message.toLowerCase().includes("refresh");
  return (
    <div className="text-sm rounded-lg px-4 py-3 border" style={isSuccess
      ? { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#15803d" }
      : { background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626" }}>
      {message}
    </div>
  );
}
