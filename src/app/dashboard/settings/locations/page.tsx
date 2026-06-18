"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/header";
import { locationsApi, ApiError } from "@/api";
import { parseAddress, formatAddressDisplay } from "@/lib/address";
import { useLocation } from "@/context/location-context";
import type { Location } from "@/types";

function displayAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "country" in parsed) {
      return formatAddressDisplay(parseAddress(raw)) || null;
    }
  } catch { /* plain text */ }
  return raw || null;
}

const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const h = Math.floor(i / 2) + 7;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60];

function AddLocationModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [openingTime, setOpeningTime] = useState("09:00");
  const [closingTime, setClosingTime] = useState("18:00");
  const [slotDuration, setSlotDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await locationsApi.create({
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        gstin: gstin.trim() || undefined,
        timezone,
        openingTime,
        closingTime,
        slotDurationMinutes: slotDuration,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create location");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-pk-surface border border-pk-border rounded-pk-lg shadow-pk-e3 w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-pk-border">
          <h2 className="text-base font-semibold text-pk-text">Add Branch</h2>
          <button onClick={onClose} className="text-pk-text-muted hover:text-pk-text text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-pk-text mb-1">Branch Name <span className="text-pk-danger-text">*</span></label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Adyar Branch"
              className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm text-pk-text bg-pk-surface focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-pk-text mb-1">Address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm text-pk-text bg-pk-surface focus:outline-none focus:ring-2 focus:ring-pk-teal-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-pk-text mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm text-pk-text bg-pk-surface focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pk-text mb-1">GSTIN</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
                className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm text-pk-text bg-pk-surface focus:outline-none focus:ring-2 focus:ring-pk-teal-500 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-pk-text mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm text-pk-text bg-pk-surface focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
            >
              <option value="Asia/Kolkata">IST (Asia/Kolkata)</option>
              <option value="Asia/Dubai">GST (Asia/Dubai)</option>
              <option value="Asia/Singapore">SGT (Asia/Singapore)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-pk-text mb-1">Opens</label>
              <select value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} className="w-full border border-pk-border rounded-pk-sm px-2 py-2 text-sm bg-pk-surface text-pk-text focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-pk-text mb-1">Closes</label>
              <select value={closingTime} onChange={(e) => setClosingTime(e.target.value)} className="w-full border border-pk-border rounded-pk-sm px-2 py-2 text-sm bg-pk-surface text-pk-text focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-pk-text mb-1">Slot (min)</label>
              <select value={slotDuration} onChange={(e) => setSlotDuration(Number(e.target.value))} className="w-full border border-pk-border rounded-pk-sm px-2 py-2 text-sm bg-pk-surface text-pk-text focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                {SLOT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-pk-danger-text">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-pk-sm border border-pk-border text-sm text-pk-text hover:bg-pk-surface-raised transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-pk-sm bg-pk-teal-600 text-white text-sm font-medium hover:bg-pk-teal-700 transition disabled:opacity-50">
              {saving ? "Adding…" : "Add Branch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditLocationModal({ location, onClose, onSaved }: { location: Location; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(location.name);
  const [address, setAddress] = useState(location.address ?? "");
  const [phone, setPhone] = useState(location.phone ?? "");
  const [gstin, setGstin] = useState(location.gstin ?? "");
  const [isActive, setIsActive] = useState(location.isActive === 1);
  const [openingTime, setOpeningTime] = useState(location.settings?.openingTime ?? "09:00");
  const [closingTime, setClosingTime] = useState(location.settings?.closingTime ?? "18:00");
  const [slotDuration, setSlotDuration] = useState(location.settings?.slotDurationMinutes ?? 30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await locationsApi.update(location.id, {
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        gstin: gstin.trim() || null,
        isActive: isActive ? 1 : 0,
        openingTime,
        closingTime,
        slotDurationMinutes: slotDuration,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-pk-surface border border-pk-border rounded-pk-lg shadow-pk-e3 w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-pk-border">
          <h2 className="text-base font-semibold text-pk-text">Edit Branch</h2>
          <button onClick={onClose} className="text-pk-text-muted hover:text-pk-text text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-pk-text mb-1">Branch Name <span className="text-pk-danger-text">*</span></label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm text-pk-text bg-pk-surface focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-pk-text mb-1">Address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm text-pk-text bg-pk-surface focus:outline-none focus:ring-2 focus:ring-pk-teal-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-pk-text mb-1">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm text-pk-text bg-pk-surface focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-pk-text mb-1">GSTIN</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
                className="w-full border border-pk-border rounded-pk-sm px-3 py-2 text-sm text-pk-text bg-pk-surface focus:outline-none focus:ring-2 focus:ring-pk-teal-500 font-mono"
              />
            </div>
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-pk-border" />
              <span className="text-sm text-pk-text">Active</span>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-pk-text mb-1">Opens</label>
              <select value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} className="w-full border border-pk-border rounded-pk-sm px-2 py-2 text-sm bg-pk-surface text-pk-text focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-pk-text mb-1">Closes</label>
              <select value={closingTime} onChange={(e) => setClosingTime(e.target.value)} className="w-full border border-pk-border rounded-pk-sm px-2 py-2 text-sm bg-pk-surface text-pk-text focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-pk-text mb-1">Slot (min)</label>
              <select value={slotDuration} onChange={(e) => setSlotDuration(Number(e.target.value))} className="w-full border border-pk-border rounded-pk-sm px-2 py-2 text-sm bg-pk-surface text-pk-text focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                {SLOT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-pk-danger-text">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-pk-sm border border-pk-border text-sm text-pk-text hover:bg-pk-surface-raised transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-pk-sm bg-pk-teal-600 text-white text-sm font-medium hover:bg-pk-teal-700 transition disabled:opacity-50">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LocationsSettingsPage() {
  const { refetchLocations } = useLocation();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editLocation, setEditLocation] = useState<Location | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await locationsApi.list();
      setLocations(res.locations);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  async function handleDelete(id: string) {
    setDeleteBusy(true);
    try {
      await locationsApi.delete(id);
      setDeleteId(null);
      await fetchLocations();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Locations"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/dashboard/settings" },
          { label: "Locations" },
        ]}
      />

      <main id="main-content" className="flex-1 p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-pk-text">Branches</h2>
            <p className="text-sm text-pk-text-secondary mt-0.5">Manage your clinic&apos;s branches and their operating hours.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-pk-sm bg-pk-teal-600 text-white text-sm font-medium hover:bg-pk-teal-700 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Branch
          </button>
        </div>

        {error && <div className="mb-4 bg-pk-danger-fill border border-pk-danger text-pk-danger-text text-sm px-4 py-3 rounded-pk-sm">{error}</div>}

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-pk-surface-raised rounded-pk-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <div key={loc.id} className="bg-pk-surface border border-pk-border rounded-pk-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-pk-text">{loc.name}</h3>
                      {loc.isDefault === 1 && (
                        <span className="text-xs bg-pk-teal-50 text-pk-teal-700 border border-pk-teal-200 rounded-full px-2 py-0.5">Default</span>
                      )}
                      {loc.isActive === 0 && (
                        <span className="text-xs bg-pk-neutral-100 text-pk-neutral-600 rounded-full px-2 py-0.5">Inactive</span>
                      )}
                    </div>
                    {displayAddress(loc.address) && <p className="text-xs text-pk-text-secondary mt-0.5 truncate">{displayAddress(loc.address)}</p>}
                    {loc.phone && <p className="text-xs text-pk-text-muted">{loc.phone}</p>}
                    {loc.settings && (
                      <p className="text-xs text-pk-text-muted mt-1">
                        {loc.settings.openingTime}–{loc.settings.closingTime} · {loc.settings.slotDurationMinutes} min slots · {loc.timezone}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setEditLocation(loc)}
                      className="text-xs text-pk-teal-600 hover:underline font-medium"
                    >
                      Edit
                    </button>
                    {loc.isDefault === 0 && (
                      <button
                        onClick={() => setDeleteId(loc.id)}
                        className="text-xs text-pk-danger-text hover:underline font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showAdd && (
        <AddLocationModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); fetchLocations(); refetchLocations(); }}
        />
      )}

      {editLocation && (
        <EditLocationModal
          location={editLocation}
          onClose={() => setEditLocation(null)}
          onSaved={() => { setEditLocation(null); fetchLocations(); refetchLocations(); }}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-pk-surface border border-pk-border rounded-pk-lg shadow-pk-e3 p-6 max-w-sm w-full">
            <h3 className="text-base font-semibold text-pk-text mb-2">Delete Branch?</h3>
            <p className="text-sm text-pk-text-secondary mb-5">
              This will permanently delete the branch. Visits and appointments linked to it will lose their branch association.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-pk-sm border border-pk-border text-sm hover:bg-pk-surface-raised transition">Cancel</button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleteBusy}
                className="px-4 py-2 rounded-pk-sm bg-pk-danger text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
