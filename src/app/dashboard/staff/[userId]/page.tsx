"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddressForm, type AddressValue } from "@/components/ui/address-form";
import { parseAddress, serializeAddress, formatAddressDisplay, EMPTY_ADDRESS } from "@/lib/address";
import { orgApi, usersApi, ApiError } from "@/api";
import type { StaffMember } from "@/types";
import { SkeletonDetailPage } from "@/components/ui/skeleton";
import { StaffProfessionalProfileCard } from "@/components/staff/StaffProfessionalProfileCard";
import { StaffEmergencyContactsCard } from "@/components/staff/StaffEmergencyContactsCard";
import { StaffAccountAccessCard } from "@/components/staff/StaffAccountAccessCard";

type Member = StaffMember;

type SalaryRecord = {
  month: string;
  salaryAmount: number;
  paidAmount: number;
  status: string;
  appointmentCount: number;
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-pk-danger-fill text-pk-danger-text",
  DOCTOR: "bg-pk-neutral-100 text-pk-neutral-700",
  NURSE: "bg-pink-100 text-pink-700",
  RECEPTIONIST: "bg-pk-teal-100 text-pk-teal-700",
  ATTENDANT: "bg-pk-warning-fill text-pk-warning-text",
  HELPER: "bg-pk-surface-sunken text-pk-text-secondary",
};

const ROLES = ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "ATTENDANT", "HELPER"] as const;

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", phone: "", dateOfBirth: "", gender: "",
    role: "", salaryType: "FIXED", salaryAmount: "0",
    isActive: true, isDoctor: false,
  });
  const [addressData, setAddressData] = useState<AddressValue>({ ...EMPTY_ADDRESS });
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    fetchMember();
    fetchSalary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function fetchMember() {
    try {
      const data = await orgApi.members.list();
      const found: Member | undefined = (data.members ?? []).find((m: Member) => m.userId === userId);
      setMember(found ?? null);
      if (found) {
        setEditForm({
          name: found.name || "", phone: found.phone || "",
          dateOfBirth: found.dateOfBirth || "", gender: found.gender || "",
          role: found.role, salaryType: found.salaryType ?? "FIXED",
          salaryAmount: String(found.salaryAmount ?? 0),
          isActive: found.isActive === 1, isDoctor: found.isDoctor === 1,
        });
        setAddressData(parseAddress(found.address ?? null));
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchSalary() {
    try {
      const data = await orgApi.salary.list();
      setSalaryRecords((data.records ?? []).filter((r: SalaryRecord & { userId: string }) => r.userId === userId));
    } catch { /* non-fatal */ }
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
    setSaving(true); setSaveError(""); setSaveSuccess(false);
    try {
      await usersApi.update(userId, {
        name: editForm.name, phone: editForm.phone || null,
        dateOfBirth: editForm.dateOfBirth || null, gender: editForm.gender || null,
        address: serializeAddress(addressData) || null,
      });
      await orgApi.members.update(userId, {
        role: editForm.role,
        salaryType: editForm.salaryType as "FIXED" | "PER_APPOINTMENT",
        salaryAmount: parseFloat(editForm.salaryAmount) || 0,
        isActive: editForm.isActive, isDoctor: editForm.isDoctor,
      });
      setSaveSuccess(true); setEditing(false);
      await fetchMember();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonDetailPage />;
  if (!member) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <p className="text-pk-text-muted">Staff member not found.</p>
      <button onClick={() => router.push("/dashboard/staff")} className="text-pk-teal-600 hover:underline text-sm">
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

        {/* ── Personal Profile ── */}
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
              <div className="w-14 h-14 bg-pk-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-pk-teal-700 text-2xl font-bold">{member.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-pk-text">{member.name}</h2>
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${ROLE_COLORS[member.role] || "bg-pk-surface-sunken text-pk-text-secondary"}`}>
                    {member.role}
                  </span>
                  {!member.isActive && (
                    <span className="text-xs bg-pk-danger-fill text-pk-danger-text px-2 py-0.5 rounded-full">Inactive</span>
                  )}
                </div>
                <p className="text-sm text-pk-text-muted">{member.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-6">
              <div>
                <p className="text-xs text-pk-text-muted mb-0.5">Phone</p>
                <p className="font-medium text-pk-text">{member.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-pk-text-muted mb-0.5">Gender</p>
                <p className="font-medium text-pk-text">{member.gender || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-pk-text-muted mb-0.5">Date of Birth</p>
                <p className="font-medium text-pk-text">{member.dateOfBirth || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-pk-text-muted mb-0.5">Joined</p>
                <p className="font-medium text-pk-text">{member.joinedAt || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-pk-text-muted mb-0.5">Salary</p>
                <p className="font-medium text-pk-text">
                  ₹{(member.salaryAmount ?? 0).toLocaleString("en-IN")}
                  {member.salaryType === "PER_APPOINTMENT" ? "/appt" : "/month"}
                </p>
              </div>
              {member.address && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-pk-text-muted mb-0.5">Address</p>
                  <p className="font-medium text-pk-text">{formatAddressDisplay(parseAddress(member.address))}</p>
                </div>
              )}
            </div>

            {editing && (
              <div className="border-t border-pk-border pt-5 space-y-4">
                <p className="text-sm font-semibold text-pk-text-secondary">Edit Personal Info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Name</label>
                    <input type="text" value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Phone</label>
                    <input type="tel" value={editForm.phone}
                      onChange={(e) => { setEditForm((f) => ({ ...f, phone: e.target.value })); setPhoneError(""); }}
                      className={`w-full px-3 py-2 border rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 ${phoneError ? "border-pk-danger-border" : "border-pk-border-strong"}`}
                      placeholder="+91 98765 43210" />
                    {phoneError && <p className="text-xs text-pk-danger-text mt-1">{phoneError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Date of Birth</label>
                    <input type="date" value={editForm.dateOfBirth}
                      onChange={(e) => setEditForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Gender</label>
                    <select value={editForm.gender}
                      onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                      <option value="">— Select —</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Address</label>
                    <AddressForm value={addressData} onChange={setAddressData} />
                  </div>
                </div>

                <p className="text-sm font-semibold text-pk-text-secondary pt-2">Role &amp; Salary</p>
                {saveError && (
                  <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">{saveError}</div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Role</label>
                    <select value={editForm.role}
                      onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Status</label>
                    <select value={editForm.isActive ? "active" : "inactive"}
                      onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.value === "active" }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  {editForm.role === "ADMIN" && (
                    <div className="flex items-center justify-between py-2 px-3 border border-pk-border rounded-pk-sm">
                      <div>
                        <p className="text-sm font-medium text-pk-text-secondary">Can act as Doctor</p>
                        <p className="text-xs text-pk-text-muted">Appears in the doctor dropdown</p>
                      </div>
                      <button type="button"
                        onClick={() => setEditForm((f) => ({ ...f, isDoctor: !f.isDoctor }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.isDoctor ? "bg-pk-teal-600" : "bg-pk-surface-sunken"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-pk-surface shadow transition-transform ${editForm.isDoctor ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Salary Type</label>
                    <select value={editForm.salaryType}
                      onChange={(e) => setEditForm((f) => ({ ...f, salaryType: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500">
                      <option value="FIXED">Fixed Monthly</option>
                      <option value="PER_APPOINTMENT">Per Appointment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">
                      {editForm.salaryType === "PER_APPOINTMENT" ? "Rate per Appointment (₹)" : "Monthly Salary (₹)"}
                    </label>
                    <input type="number" min="0" value={editForm.salaryAmount}
                      onChange={(e) => setEditForm((f) => ({ ...f, salaryAmount: e.target.value }))}
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500" />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
                  <Button variant="outline" onClick={() => { setEditing(false); setSaveError(""); setPhoneError(""); }}>Cancel</Button>
                </div>
              </div>
            )}

            {saveSuccess && (
              <div className="mt-4 bg-pk-success-fill border border-pk-success-border text-pk-success-text text-sm rounded-pk-sm px-4 py-3">
                Changes saved successfully.
              </div>
            )}
          </CardContent>
        </Card>

        <StaffProfessionalProfileCard userId={userId} />

        <StaffEmergencyContactsCard userId={userId} />

        <StaffAccountAccessCard userId={userId} member={member} onMemberRefresh={fetchMember} />

        {/* ── Salary History ── */}
        {salaryRecords.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Salary History</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pk-border">
                    <th className="pb-2 text-left font-medium text-pk-text-secondary">Month</th>
                    <th className="pb-2 text-left font-medium text-pk-text-secondary">Amount</th>
                    <th className="pb-2 text-left font-medium text-pk-text-secondary">Paid</th>
                    <th className="pb-2 text-left font-medium text-pk-text-secondary">Appts</th>
                    <th className="pb-2 text-left font-medium text-pk-text-secondary">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pk-border">
                  {salaryRecords.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 text-pk-text-secondary">{r.month}</td>
                      <td className="py-2 text-pk-text-secondary">₹{r.salaryAmount.toLocaleString("en-IN")}</td>
                      <td className="py-2 text-pk-text-secondary">₹{r.paidAmount.toLocaleString("en-IN")}</td>
                      <td className="py-2 text-pk-text-muted">{r.appointmentCount || "—"}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          r.status === "PAID" ? "bg-pk-success-fill text-pk-success-text"
                          : r.status === "PARTIAL" ? "bg-pk-warning-fill text-pk-warning-text"
                          : "bg-pk-surface-sunken text-pk-text-secondary"
                        }`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <button onClick={() => router.push("/dashboard/staff")}
          className="text-sm text-pk-text-muted hover:text-pk-text-secondary transition">
          &larr; Back to Staff
        </button>
      </main>
    </div>
  );
}
