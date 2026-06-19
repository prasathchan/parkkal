"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { emergencyContactsApi, ApiError } from "@/api";

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string | null;
  address?: string | null;
}

export function StaffEmergencyContactsCard({ userId }: { userId: string }) {
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [addingEC, setAddingEC] = useState(false);
  const [ecForm, setEcForm] = useState({ name: "", relationship: "", phone: "", email: "" });
  const [ecSaving, setEcSaving] = useState(false);
  const [ecError, setEcError] = useState("");

  useEffect(() => {
    emergencyContactsApi.list("USER", userId)
      .then((data) => setEmergencyContacts((data.contacts ?? []) as EmergencyContact[]))
      .catch(() => { /* non-fatal */ });
  }, [userId]);

  async function handleAddEC() {
    setEcSaving(true); setEcError("");
    try {
      await emergencyContactsApi.add({ entityType: "USER", entityId: userId, ...ecForm });
      setAddingEC(false); setEcForm({ name: "", relationship: "", phone: "", email: "" });
      const data = await emergencyContactsApi.list("USER", userId);
      setEmergencyContacts((data.contacts ?? []) as EmergencyContact[]);
    } catch (e) {
      setEcError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setEcSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Emergency Contacts</CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setAddingEC(true); setEcError(""); }}>+ Add</Button>
        </div>
      </CardHeader>
      <CardContent>
        {emergencyContacts.length === 0 && !addingEC && (
          <p className="text-sm text-pk-text-muted">No emergency contacts added.</p>
        )}
        {emergencyContacts.map((ec) => (
          <div key={ec.id} className="flex flex-col sm:flex-row sm:items-center gap-1 py-3 border-b border-pk-border last:border-0">
            <div className="flex-1">
              <p className="text-sm font-medium text-pk-text">{ec.name} <span className="text-pk-text-muted font-normal">({ec.relationship})</span></p>
              <p className="text-sm text-pk-text-secondary">{ec.phone}{ec.email ? ` · ${ec.email}` : ""}</p>
              {ec.address && <p className="text-xs text-pk-text-muted mt-0.5">{ec.address}</p>}
            </div>
          </div>
        ))}
        {addingEC && (
          <div className="mt-3 space-y-3 border-t border-pk-border pt-4">
            {ecError && <p className="text-sm text-pk-danger-text">{ecError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-pk-text-secondary mb-1">Name *</label>
                <input type="text" value={ecForm.name} onChange={(e) => setEcForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-pk-text-secondary mb-1">Relationship *</label>
                <input type="text" value={ecForm.relationship} onChange={(e) => setEcForm((f) => ({ ...f, relationship: e.target.value }))}
                  placeholder="Spouse, Parent, Sibling…"
                  className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-pk-text-secondary mb-1">Phone *</label>
                <input type="tel" value={ecForm.phone} onChange={(e) => setEcForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-pk-text-secondary mb-1">Email</label>
                <input type="email" value={ecForm.email} onChange={(e) => setEcForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddEC} disabled={ecSaving || !ecForm.name || !ecForm.relationship || !ecForm.phone}>
                {ecSaving ? "Saving…" : "Save Contact"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setAddingEC(false); setEcError(""); }}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
