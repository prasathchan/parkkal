"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddressForm, type AddressValue } from "@/components/ui/address-form";
import { parseAddress, serializeAddress, formatAddressDisplay, EMPTY_ADDRESS } from "@/lib/address";
import { orgApi, usersApi, emergencyContactsApi, ApiError } from "@/api";
import type { StaffMember } from "@/types";

type Member = StaffMember;

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string | null;
  address?: string | null;
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
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkMode, setLinkMode] = useState<"invite_link" | "no_login_verify">("invite_link");

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    role: "",
    salaryType: "FIXED",
    salaryAmount: "0",
    isActive: true,
    isDoctor: false,
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
    try {
      const data = await orgApi.members.list();
      const found: Member | undefined = (data.members ?? []).find((m: Member) => m.userId === userId);
      setMember(found ?? null);
      if (found) {
        setEditForm({
          name: found.name || "",
          phone: found.phone || "",
          dateOfBirth: found.dateOfBirth || "",
          gender: found.gender || "",
          role: found.role,
          salaryType: found.salaryType ?? "FIXED",
          salaryAmount: String(found.salaryAmount ?? 0),
          isActive: found.isActive === 1,
          isDoctor: found.isDoctor === 1,
        });
        // default link mode based on current portal access
        setLinkMode((found as Member & { portalAccess?: number }).portalAccess === 1 ? "invite_link" : "no_login_verify");
        setAddressData(parseAddress(found.address ?? null));
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchEmergencyContacts() {
    try {
      const data = await emergencyContactsApi.list("USER", userId);
      setEmergencyContacts((data.contacts ?? []) as EmergencyContact[]);
    } catch {
      // non-fatal
    }
  }

  async function fetchSalary() {
    try {
      const data = await orgApi.salary.list();
      setSalaryRecords((data.records ?? []).filter((r: SalaryRecord & { userId: string }) => r.userId === userId));
    } catch {
      // non-fatal
    }
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
      await usersApi.update(userId, {
        name: editForm.name,
        phone: editForm.phone || null,
        dateOfBirth: editForm.dateOfBirth || null,
        gender: editForm.gender || null,
        address: serializeAddress(addressData) || null,
      });
      // Update role & salary
      await orgApi.members.update(userId, {
        role: editForm.role,
        salaryType: editForm.salaryType as "FIXED" | "PER_APPOINTMENT",
        salaryAmount: parseFloat(editForm.salaryAmount) || 0,
        isActive: editForm.isActive,
        isDoctor: editForm.isDoctor,
      });
      setSaveSuccess(true);
      setEditing(false);
      await fetchMember();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddEC() {
    setEcSaving(true);
    setEcError("");
    try {
      await emergencyContactsApi.add({ entityType: "USER", entityId: userId, ...ecForm });
      setAddingEC(false);
      setEcForm({ name: "", relationship: "", phone: "", email: "" });
      await fetchEmergencyContacts();
    } catch (e) {
      setEcError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setEcSaving(false);
    }
  }

  async function handleSendLink() {
    setSendingLink(true);
    setLinkError("");
    setLinkSent(false);
    try {
      await orgApi.members.sendActivation(userId, linkMode);
      setLinkSent(true);
    } catch (e) {
      setLinkError(e instanceof ApiError ? e.message : "Failed to send link");
    } finally {
      setSendingLink(false);
    }
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
      <main id="main-content" className="flex-1 p-6 max-w-3xl space-y-6">

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
                  ₹{(member.salaryAmount ?? 0).toLocaleString("en-IN")}
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

                  {editForm.role === "ADMIN" && (
                    <div className="flex items-center justify-between py-2 px-3 border border-slate-200 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Can act as Doctor</p>
                        <p className="text-xs text-slate-500">Appears in the doctor dropdown for appointments</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditForm((f) => ({ ...f, isDoctor: !f.isDoctor }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.isDoctor ? "bg-blue-600" : "bg-slate-200"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${editForm.isDoctor ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  )}

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

        {/* Account Access */}
        <Card>
          <CardHeader><CardTitle>Account Access</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${member.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {member.isActive ? "HR Active" : "HR Inactive"}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${member.portalAccess ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>
                {member.portalAccess ? "Login Enabled" : "Login Disabled"}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${member.isVerified ? "bg-teal-100 text-teal-700" : "bg-orange-100 text-orange-700"}`}>
                {member.isVerified ? "Devices Verified" : "Unverified"}
              </span>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">Send activation / verification link</p>
              <div className="space-y-2">
                {[
                  { value: "invite_link" as const, label: "Activation link (enable login)", desc: "User sets their own password and verifies email + phone. Login is enabled after." },
                  { value: "no_login_verify" as const, label: "Verification link (no login)", desc: "User verifies their email and phone. Login access remains disabled." },
                ].map(opt => (
                  <label key={opt.value} className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition ${linkMode === opt.value ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                    <input type="radio" name="linkMode" value={opt.value} checked={linkMode === opt.value}
                      onChange={() => { setLinkMode(opt.value); setLinkSent(false); setLinkError(""); }}
                      className="mt-0.5 accent-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{opt.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              {linkError && <p className="text-sm text-red-600">{linkError}</p>}
              {linkSent && <p className="text-sm text-green-600">Link sent to {member.email}</p>}
              <Button size="sm" onClick={handleSendLink} disabled={sendingLink}>
                {sendingLink ? "Sending..." : "Send link"}
              </Button>
            </div>
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
