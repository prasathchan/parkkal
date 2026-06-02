"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddressForm, type AddressValue } from "@/components/ui/address-form";
import { parseAddress, serializeAddress, formatAddressDisplay, EMPTY_ADDRESS } from "@/lib/address";

interface Member {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  role: string;
  salaryType: string;
  salaryAmount: number;
  joinedAt: string | null;
  isActive: number;
}

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  address: string | null;
}

type SalaryRecord = {
  month: string;
  salaryAmount: number;
  paidAmount: number;
  status: string;
  appointmentCount: number;
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  DOCTOR: "bg-purple-100 text-purple-700",
  NURSE: "bg-pink-100 text-pink-700",
  RECEPTIONIST: "bg-blue-100 text-blue-700",
  ATTENDANT: "bg-orange-100 text-orange-700",
  HELPER: "bg-gray-100 text-gray-700",
};

const ROLES = ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "ATTENDANT", "HELPER"] as const;

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [addingEC, setAddingEC] = useState(false);
  const [ecForm, setEcForm] = useState({ name: "", relationship: "", phone: "", email: "" });
  const [ecSaving, setEcSaving] = useState(false);
  const [ecError, setEcError] = useState("");

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    role: "",
    salaryType: "FIXED",
    salaryAmount: "0",
    isActive: true,
  });
  const [addressData, setAddressData] = useState<AddressValue>({ ...EMPTY_ADDRESS });
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    fetchMember();
    fetchSalary();
    fetchEmergencyContacts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function fetchMember() {
    const res = await fetch("/api/org/members");
    const data = await res.json();
    const found: Member | undefined = (data.members || []).find((m: Member) => m.userId === userId);
    setMember(found || null);
    if (found) {
      setEditForm({
        name: found.name || "",
        phone: found.phone || "",
        dateOfBirth: found.dateOfBirth || "",
        gender: found.gender || "",
        role: found.role,
        salaryType: found.salaryType,
        salaryAmount: String(found.salaryAmount),
        isActive: found.isActive === 1,
      });
      setAddressData(parseAddress(found.address));
    }
    setLoading(false);
  }

  async function fetchEmergencyContacts() {
    const res = await fetch(`/api/emergency-contacts?entityType=USER&entityId=${userId}`);
    if (res.ok) {
      const data = await res.json();
      setEmergencyContacts(data.contacts || []);
    }
  }

  async function fetchSalary() {
    const res = await fetch("/api/org/salary");
    const data = await res.json();
    setSalaryRecords((data.records || []).filter((r: SalaryRecord & { userId: string }) => r.userId === userId));
  }

  function validatePhone(phone: string) {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return "Phone must have at least 10 digits";
    if (digits.length > 15) return "Phone number is too long";
    return "";
  }

  async function handleSave() {
    const pErr = validatePhone(editForm.phone);
    if (pErr) { setPhoneError(pErr); return; }
    setPhoneError("");
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    try {
      // Update personal info
      const userRes = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone || null,
          dateOfBirth: editForm.dateOfBirth || null,
          gender: editForm.gender || null,
          address: serializeAddress(addressData) || null,
        }),
      });
      if (!userRes.ok) {
        const d = await userRes.json();
        setSaveError(d.error || "Failed to save personal info");
        return;
      }
      // Update role & salary
      const res = await fetch(`/api/org/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editForm.role,
          salaryType: editForm.salaryType,
          salaryAmount: parseFloat(editForm.salaryAmount) || 0,
          isActive: editForm.isActive,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSaveError(d.error || "Failed to save");
        return;
      }
      setSaveSuccess(true);
      setEditing(false);
      await fetchMember();
    } catch {
      setSaveError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddEC() {
    setEcSaving(true);
    setEcError("");
    const res = await fetch("/api/emergency-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "USER", entityId: userId, ...ecForm }),
    });
    if (!res.ok) {
      const d = await res.json();
      setEcError(d.error || "Failed to save");
    } else {
      setAddingEC(false);
      setEcForm({ name: "", relationship: "", phone: "", email: "" });
      await fetchEmergencyContacts();
    }
    setEcSaving(false);
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-slate-400">Loading...</div>;
  if (!member) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <p className="text-slate-500">Staff member not found.</p>
      <button onClick={() => router.push("/dashboard/staff")} className="text-blue-600 hover:underline text-sm">
        Back to Staff
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title={member.name}
        breadcrumb={[
          { label: "Dashboard" },
          { label: "Staff", href: "/dashboard/staff" },
          { label: member.name },
        ]}
      />
      <main className="flex-1 p-6 max-w-3xl space-y-6">

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Staff Profile</CardTitle>
              {!editing && (
                <Button size="sm" variant="outline" onClick={() => { setEditing(true); setSaveSuccess(false); }}>
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-5 mb-6">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 text-2xl font-bold">{member.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-slate-900">{member.name}</h2>
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${ROLE_COLORS[member.role] || "bg-gray-100 text-gray-700"}`}>
                    {member.role}
                  </span>
                  {!member.isActive && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>
                  )}
                </div>
                <p className="text-sm text-slate-500">{member.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-6">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Phone</p>
                <p className="font-medium text-slate-900">{member.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Gender</p>
                <p className="font-medium text-slate-900">{member.gender || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Date of Birth</p>
                <p className="font-medium text-slate-900">{member.dateOfBirth || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Joined</p>
                <p className="font-medium text-slate-900">{member.joinedAt || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Salary</p>
                <p className="font-medium text-slate-900">
                  ₹{member.salaryAmount.toLocaleString("en-IN")}
                  {member.salaryType === "PER_APPOINTMENT" ? "/appt" : "/month"}
                </p>
              </div>
              {member.address && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-slate-400 mb-0.5">Address</p>
                  <p className="font-medium text-slate-900">{formatAddressDisplay(parseAddress(member.address))}</p>
                </div>
              )}
            </div>

            {/* Edit Form */}
            {editing && (
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <p className="text-sm font-semibold text-slate-700">Edit Personal Info</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => { setEditForm((f) => ({ ...f, phone: e.target.value })); setPhoneError(""); }}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${phoneError ? "border-red-400" : "border-slate-300"}`}
                      placeholder="+91 98765 43210"
                    />
                    {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
                    <input
                      type="date"
                      value={editForm.dateOfBirth}
                      onChange={(e) => setEditForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Gender</label>
                    <select
                      value={editForm.gender}
                      onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select —</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
                    <AddressForm value={addressData} onChange={setAddressData} />
                  </div>
                </div>

                <p className="text-sm font-semibold text-slate-700 pt-2">Edit Role &amp; Salary</p>

                {saveError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    {saveError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
                    <select
                      value={editForm.isActive ? "active" : "inactive"}
                      onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.value === "active" }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Salary Type</label>
                    <select
                      value={editForm.salaryType}
                      onChange={(e) => setEditForm((f) => ({ ...f, salaryType: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="FIXED">Fixed Monthly</option>
                      <option value="PER_APPOINTMENT">Per Appointment</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {editForm.salaryType === "PER_APPOINTMENT" ? "Rate per Appointment (₹)" : "Monthly Salary (₹)"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.salaryAmount}
                      onChange={(e) => setEditForm((f) => ({ ...f, salaryAmount: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button variant="outline" onClick={() => { setEditing(false); setSaveError(""); setPhoneError(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {saveSuccess && (
              <div className="mt-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
                Changes saved successfully.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emergency Contacts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Emergency Contacts</CardTitle>
              <Button size="sm" variant="outline" onClick={() => { setAddingEC(true); setEcError(""); }}>
                + Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {emergencyContacts.length === 0 && !addingEC && (
              <p className="text-sm text-slate-400">No emergency contacts added.</p>
            )}
            {emergencyContacts.map((ec) => (
              <div key={ec.id} className="flex flex-col sm:flex-row sm:items-center gap-1 py-3 border-b border-slate-100 last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{ec.name} <span className="text-slate-400 font-normal">({ec.relationship})</span></p>
                  <p className="text-sm text-slate-600">{ec.phone}{ec.email ? ` · ${ec.email}` : ""}</p>
                  {ec.address && <p className="text-xs text-slate-400 mt-0.5">{ec.address}</p>}
                </div>
              </div>
            ))}
            {addingEC && (
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-4">
                {ecError && <p className="text-sm text-red-600">{ecError}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                    <input type="text" value={ecForm.name} onChange={(e) => setEcForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Relationship *</label>
                    <input type="text" value={ecForm.relationship} onChange={(e) => setEcForm((f) => ({ ...f, relationship: e.target.value }))}
                      placeholder="Spouse, Parent, Sibling…"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone *</label>
                    <input type="tel" value={ecForm.phone} onChange={(e) => setEcForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input type="email" value={ecForm.email} onChange={(e) => setEcForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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

        {/* Salary History */}
        {salaryRecords.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Salary History</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 text-left font-medium text-slate-600">Month</th>
                    <th className="pb-2 text-left font-medium text-slate-600">Amount</th>
                    <th className="pb-2 text-left font-medium text-slate-600">Paid</th>
                    <th className="pb-2 text-left font-medium text-slate-600">Appts</th>
                    <th className="pb-2 text-left font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salaryRecords.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 text-slate-700">{r.month}</td>
                      <td className="py-2 text-slate-700">₹{r.salaryAmount.toLocaleString("en-IN")}</td>
                      <td className="py-2 text-slate-700">₹{r.paidAmount.toLocaleString("en-IN")}</td>
                      <td className="py-2 text-slate-500">{r.appointmentCount || "—"}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          r.status === "PAID" ? "bg-green-100 text-green-700"
                          : r.status === "PARTIAL" ? "bg-yellow-100 text-yellow-700"
                          : "bg-slate-100 text-slate-600"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <button
          onClick={() => router.push("/dashboard/staff")}
          className="text-sm text-slate-500 hover:text-slate-700 transition"
        >
          &larr; Back to Staff
        </button>
      </main>
    </div>
  );
}
