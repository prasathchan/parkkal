"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import Link from "next/link";
import { BloodGroupSelect } from "@/components/ui/blood-group-select";
import { AddressForm, type AddressValue } from "@/components/ui/address-form";
import { serializeAddress, EMPTY_ADDRESS } from "@/lib/address";
import { orgApi, ApiError } from "@/api";
import { EmptyState } from "@/components/ui/empty-state";
import type { StaffMember, OrgRole } from "@/types";

// Use shared types from @/types
type Member = StaffMember;

// Maps org role slug → system role enum (used when saving member)
const SLUG_TO_SYSTEM_ROLE: Record<string, string> = {
  administrator: "ADMIN",
  doctor: "DOCTOR",
  nurse: "NURSE",
  receptionist: "RECEPTIONIST",
  attendant: "ATTENDANT",
  helper: "HELPER",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-pk-danger-fill text-pk-danger-text",
  DOCTOR: "bg-pk-neutral-100 text-pk-neutral-700",
  NURSE: "bg-pink-100 text-pink-700",
  RECEPTIONIST: "bg-pk-teal-100 text-pk-teal-700",
  ATTENDANT: "bg-pk-warning-fill text-pk-warning-text",
  HELPER: "bg-pk-surface-sunken text-pk-text-secondary",
};

export default function StaffPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [orgRoles, setOrgRoles] = useState<OrgRole[]>([]);
  const [form, setForm] = useState({
    email: "",
    name: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    bloodGroup: "",
    panNumber: "",
    aadhaarNumber: "",
    orgRoleId: "",
    salaryType: "FIXED",
    salaryAmount: "",
    joinedAt: new Date().toISOString().split("T")[0],
    activationMode: "invite_link" as "invite_link" | "set_password" | "no_login_verify",
    password: "",
    ecName: "",
    ecRelationship: "",
    ecPhone: "",
  });
  const [staffAddress, setStaffAddress] = useState<AddressValue>({ ...EMPTY_ADDRESS });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [togglingDoctor, setTogglingDoctor] = useState<string | null>(null);

  function touch(field: string) { setTouched(t => ({ ...t, [field]: true })); }

  async function toggleDoctor(member: Member) {
    setTogglingDoctor(member.memberId);
    try {
      await orgApi.members.update(member.memberId, { isDoctor: member.isDoctor !== 1 });
      setMembers(ms => ms.map(m => m.memberId === member.memberId ? { ...m, isDoctor: member.isDoctor === 1 ? 0 : 1 } : m));
    } catch {
      // silently ignore — user can retry
    } finally {
      setTogglingDoctor(null);
    }
  }

  const fieldErrors = {
    email: form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? "Enter a valid email address" : "",
    phone: form.phone && !/^\+?\d{10,15}$/.test(form.phone.replace(/[\s-]/g, "")) ? "Phone must be 10–15 digits" : "",
    panNumber: form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.panNumber.toUpperCase()) ? "PAN format: ABCDE1234F" : "",
    aadhaarNumber: form.aadhaarNumber && !/^\d{12}$/.test(form.aadhaarNumber.replace(/\s/g, "")) ? "Aadhaar must be 12 digits" : "",
    ecPhone: form.ecPhone && !/^\+?\d{10,15}$/.test(form.ecPhone.replace(/[\s-]/g, "")) ? "Phone must be 10–15 digits" : "",
  };

  useEffect(() => {
    fetchMembers();
    orgApi.roles.list()
      .then(d => setOrgRoles(d.roles ?? []))
      .catch(() => {});
  }, []);

  async function fetchMembers() {
    setLoading(true);
    try {
      const data = await orgApi.members.list();
      setMembers(data.members ?? []);
    } finally {
      setLoading(false);
    }
  }

  function updateForm(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setTouched(t => ({ ...t, [field]: true }));
      setForm(f => {
        const updated = { ...f, [field]: e.target.value };
        if (field === "orgRoleId") {
          const selectedRole = orgRoles.find(r => r.id === e.target.value);
          const slug = selectedRole?.slug || "";
          // Auto-set salary type based on role
          updated.salaryType = slug === "doctor" ? "PER_APPOINTMENT" : "FIXED";
        }
        return updated;
      });
    };
  }

  const staffHasErrors = Object.values(fieldErrors).some(Boolean);
  const needsPassword = form.activationMode === "set_password";
  const staffCanSubmit = form.email.trim() && form.orgRoleId && form.ecName?.trim() && form.ecRelationship && form.ecPhone?.trim() && !staffHasErrors
    && (!needsPassword || form.password.length >= 8);

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!staffCanSubmit) return;
    const errs = {
      email: form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? "error" : "",
      phone: form.phone && !/^\+?\d{10,15}$/.test(form.phone.replace(/[\s-]/g, "")) ? "error" : "",
      panNumber: form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.panNumber.toUpperCase()) ? "error" : "",
      aadhaarNumber: form.aadhaarNumber && !/^\d{12}$/.test(form.aadhaarNumber.replace(/\s/g, "")) ? "error" : "",
      ecPhone: form.ecPhone && !/^\+?\d{10,15}$/.test(form.ecPhone.replace(/[\s-]/g, "")) ? "error" : "",
    };
    if (Object.values(errs).some(Boolean)) return;
    setFormError("");
    setSaving(true);
    try {
      const addressString = serializeAddress(staffAddress);

      await orgApi.members.add({
        email: form.email,
        name: form.name || undefined,
        phone: form.phone || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        bloodGroup: form.bloodGroup || undefined,
        address: addressString || undefined,
        panNumber: form.panNumber || undefined,
        aadhaarNumber: form.aadhaarNumber || undefined,
        role: (() => {
          const selectedRole = orgRoles.find(r => r.id === form.orgRoleId);
          return SLUG_TO_SYSTEM_ROLE[selectedRole?.slug || ""] || "ATTENDANT";
        })(),
        orgRoleId: form.orgRoleId || undefined,
        salaryType: form.salaryType as "FIXED" | "PER_APPOINTMENT",
        salaryAmount: parseFloat(form.salaryAmount) || 0,
        joinedAt: form.joinedAt,
        activationMode: form.activationMode,
        password: form.activationMode === "set_password" ? form.password : undefined,
        emergencyContact: {
          name: form.ecName,
          relationship: form.ecRelationship,
          phone: form.ecPhone,
        },
      });
      setShowModal(false);
      fetchMembers();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Staff" breadcrumb={[{ label: "Dashboard" }, { label: "Staff" }]} />
      <main id="main-content" className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold text-pk-text">Organization Members</h2>
            <p className="text-sm text-pk-text-muted">{members.length} total staff</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-pk-teal-600 hover:bg-pk-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-pk-sm transition"
          >
            + Add Staff
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-pk-text-muted">Loading staff...</div>
        ) : members.length === 0 ? (
          <EmptyState
            title="No staff members yet"
            description="Add your first staff member to get started."
            action={{ label: "Add Staff", onClick: () => setShowModal(true) }}
          />
        ) : (
          <div className="bg-pk-surface rounded-pk-lg border border-pk-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-pk-surface-raised border-b border-pk-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Salary Type</th>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Salary Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Joined</th>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-pk-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pk-border">
                {members.map((m) => (
                  <tr key={m.memberId} className="hover:bg-pk-surface-raised">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-pk-text">{m.name}</p>
                        <p className="text-xs text-pk-text-muted">{m.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {m.orgRoleName ? (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: m.orgRoleColor || "#6B7280" }}
                        >
                          {m.orgRoleName}
                        </span>
                      ) : (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role] || "bg-pk-surface-sunken text-pk-text-secondary"}`}>
                          {m.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-pk-text-secondary">{m.salaryType}</td>
                    <td className="px-4 py-3 text-pk-text-secondary">
                      {m.salaryType === "PER_APPOINTMENT"
                        ? `₹${(m.salaryAmount ?? 0).toLocaleString("en-IN")}/appt`
                        : `₹${(m.salaryAmount ?? 0).toLocaleString("en-IN")}/mo`}
                    </td>
                    <td className="px-4 py-3 text-pk-text-muted">{m.joinedAt || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.isActive ? "bg-pk-success-fill text-pk-success-text" : m.isVerified === 0 ? "bg-pk-warning-fill text-pk-warning-text" : "bg-pk-surface-sunken text-pk-text-muted"}`}>
                        {m.isActive ? "Active" : m.isVerified === 0 ? "Pending Setup" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link href={`/dashboard/staff/${m.userId}`} className="text-pk-teal-600 hover:text-pk-teal-800 text-xs font-medium">
                          View
                        </Link>
                        {m.role === "ADMIN" && (
                          <button
                            type="button"
                            disabled={togglingDoctor === m.memberId}
                            onClick={() => toggleDoctor(m)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${m.isDoctor === 1 ? "bg-pk-teal-50 border-pk-teal-200 text-pk-teal-700 hover:bg-pk-teal-100" : "bg-pk-surface-raised border-pk-border text-pk-text-muted hover:bg-pk-surface-sunken"}`}
                          >
                            <span className={`relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors ${m.isDoctor === 1 ? "bg-pk-teal-500" : "bg-pk-neutral-300"}`}>
                              <span className={`inline-block h-3 w-3 transform rounded-full bg-pk-surface shadow transition-transform ${m.isDoctor === 1 ? "translate-x-3.5" : "translate-x-0.5"}`} />
                            </span>
                            {togglingDoctor === m.memberId ? "Saving…" : m.isDoctor === 1 ? "Acts as Doctor" : "Can act as Doctor?"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-pk-surface rounded-pk-xl shadow-pk-e3 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-pk-border flex justify-between items-center">
              <h2 className="text-lg font-bold text-pk-text">Add Staff Member</h2>
              <button onClick={() => setShowModal(false)} aria-label="Close modal" className="text-pk-text-muted hover:text-pk-text-secondary">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1">Email *</label>
                  <input
                    type="text"
                    value={form.email}
                    onChange={updateForm("email")}
                    onBlur={() => touch("email")}
                    required
                    placeholder="staff@example.com"
                    className={`w-full px-3 py-2 border rounded-pk-sm text-sm focus:outline-none focus:ring-2 ${touched.email && fieldErrors.email ? "border-pk-danger-border focus:ring-pk-danger" : "border-pk-border-strong focus:ring-pk-teal-500"}`}
                  />
                  {touched.email && fieldErrors.email && <p className="text-xs text-pk-danger-text mt-1">{fieldErrors.email}</p>}
                  <p className="text-xs text-pk-text-muted mt-1">If user exists, their profile will be used. Otherwise fill the fields below.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1">Full Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={updateForm("name")}
                    placeholder="Dr. Rajan Kumar"
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={updateForm("phone")}
                    onBlur={() => touch("phone")}
                    placeholder="+91 98765 43210"
                    className={`w-full px-3 py-2 border rounded-pk-sm text-sm focus:outline-none focus:ring-2 ${touched.phone && fieldErrors.phone ? "border-pk-danger-border focus:ring-pk-danger" : "border-pk-border-strong focus:ring-pk-teal-500"}`}
                  />
                  {touched.phone && fieldErrors.phone && <p className="text-xs text-pk-danger-text mt-1">{fieldErrors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={updateForm("dateOfBirth")}
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={updateForm("gender")}
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                  >
                    <option value="">Select</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1">Blood Group</label>
                  <BloodGroupSelect
                    value={form.bloodGroup}
                    onChange={(v) => setForm((f) => ({ ...f, bloodGroup: v }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1">Role *</label>
                  <select
                    value={form.orgRoleId}
                    onChange={updateForm("orgRoleId")}
                    required
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                  >
                    <option value="">— Select Role —</option>
                    {orgRoles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1">Salary Type</label>
                  <select
                    value={form.salaryType}
                    onChange={updateForm("salaryType")}
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                  >
                    <option value="FIXED">Fixed Monthly</option>
                    <option value="PER_APPOINTMENT">Per Appointment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1">
                    {form.salaryType === "PER_APPOINTMENT" ? "Amount per Appointment (₹)" : "Monthly Salary (₹)"}
                  </label>
                  <input
                    type="number"
                    value={form.salaryAmount}
                    onChange={updateForm("salaryAmount")}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-pk-text-secondary mb-1">Joined Date</label>
                  <input
                    type="date"
                    value={form.joinedAt}
                    onChange={updateForm("joinedAt")}
                    className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-pk-text-secondary mb-1.5">Address</label>
                <AddressForm value={staffAddress} onChange={setStaffAddress} />
              </div>

              {/* Documents */}
              <div className="border border-pk-warning-border rounded-pk-sm p-4 bg-pk-warning-fill">
                <p className="text-sm font-medium text-pk-warning-text mb-3">Documents (Optional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-pk-text-secondary mb-1">PAN Number</label>
                    <input
                      type="text"
                      value={form.panNumber}
                      onChange={updateForm("panNumber")}
                      onBlur={() => touch("panNumber")}
                      placeholder="AAAAA9999A"
                      maxLength={10}
                      className={`w-full px-3 py-2 border rounded-pk-sm text-sm focus:outline-none focus:ring-2 uppercase ${touched.panNumber && fieldErrors.panNumber ? "border-pk-danger-border focus:ring-pk-danger" : "border-pk-border-strong focus:ring-pk-teal-500"}`}
                    />
                    {touched.panNumber && fieldErrors.panNumber && <p className="text-xs text-pk-danger-text mt-1">{fieldErrors.panNumber}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-pk-text-secondary mb-1">Aadhaar Number</label>
                    <input
                      type="text"
                      value={form.aadhaarNumber}
                      onChange={updateForm("aadhaarNumber")}
                      onBlur={() => touch("aadhaarNumber")}
                      placeholder="12 digits"
                      maxLength={12}
                      className={`w-full px-3 py-2 border rounded-pk-sm text-sm focus:outline-none focus:ring-2 ${touched.aadhaarNumber && fieldErrors.aadhaarNumber ? "border-pk-danger-border focus:ring-pk-danger" : "border-pk-border-strong focus:ring-pk-teal-500"}`}
                    />
                    {touched.aadhaarNumber && fieldErrors.aadhaarNumber && <p className="text-xs text-pk-danger-text mt-1">{fieldErrors.aadhaarNumber}</p>}
                  </div>
                </div>
              </div>

              {/* Activation Mode */}
              <div className="border border-pk-border rounded-pk-sm p-4 space-y-3">
                <p className="text-sm font-medium text-pk-text">Login &amp; Activation *</p>
                {[
                  {
                    value: "invite_link",
                    label: "Send activation link",
                    desc: "User receives an email link. They set their own password and verify both email and phone before they can log in.",
                  },
                  {
                    value: "set_password",
                    label: "Set password now — activate immediately",
                    desc: "You set the password. The account is ready to log in right away. The user can verify their email and phone later.",
                  },
                  {
                    value: "no_login_verify",
                    label: "No login — verify devices only",
                    desc: "The HR record is created as active (visible in staff, salary). A verification link is sent so the user can confirm their email and phone. Login remains disabled until you enable it.",
                  },
                ].map((opt) => (
                  <label key={opt.value} className={`flex gap-3 p-3 rounded-pk-sm border cursor-pointer transition ${form.activationMode === opt.value ? "border-pk-teal-500 bg-pk-teal-50" : "border-pk-border hover:bg-pk-surface-raised"}`}>
                    <input
                      type="radio"
                      name="activationMode"
                      value={opt.value}
                      checked={form.activationMode === opt.value}
                      onChange={() => setForm(f => ({ ...f, activationMode: opt.value as typeof f.activationMode, password: "" }))}
                      className="mt-0.5 accent-pk-teal-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-pk-text">{opt.label}</p>
                      <p className="text-xs text-pk-text-muted mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
                {form.activationMode === "set_password" && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-pk-text-secondary mb-1">Password *</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={updateForm("password")}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                    />
                    {form.password && form.password.length < 8 && (
                      <p className="text-xs text-pk-danger-text mt-1">Password must be at least 8 characters</p>
                    )}
                  </div>
                )}
              </div>

              {/* Emergency Contact — mandatory for staff */}
              <div className="border border-pk-border rounded-pk-sm p-4">
                <p className="text-sm font-medium text-pk-text mb-1">Emergency Contact <span className="text-pk-danger-text">*</span></p>
                <p className="text-xs text-pk-text-muted mb-3">Required before the staff record can be saved.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-pk-text-secondary mb-1">Contact Name *</label>
                    <input
                      type="text"
                      value={form.ecName}
                      onChange={updateForm("ecName")}
                      required
                      placeholder="Full name"
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-pk-text-secondary mb-1">Relationship *</label>
                    <select
                      value={form.ecRelationship}
                      onChange={updateForm("ecRelationship")}
                      required
                      className="w-full px-3 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
                    >
                      <option value="">Select</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Friend">Friend</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-pk-text-secondary mb-1">Phone *</label>
                    <input
                      type="text"
                      value={form.ecPhone}
                      onChange={updateForm("ecPhone")}
                      onBlur={() => touch("ecPhone")}
                      required
                      placeholder="+91 98765 43210"
                      className={`w-full px-3 py-2 border rounded-pk-sm text-sm focus:outline-none focus:ring-2 ${touched.ecPhone && fieldErrors.ecPhone ? "border-pk-danger-border focus:ring-pk-danger" : "border-pk-border-strong focus:ring-pk-teal-500"}`}
                    />
                    {touched.ecPhone && fieldErrors.ecPhone && <p className="text-xs text-pk-danger-text mt-1">{fieldErrors.ecPhone}</p>}
                  </div>
                </div>
              </div>

              {formError && (
                <div className="bg-pk-danger-fill border border-pk-danger-border text-pk-danger-text text-sm rounded-pk-sm px-4 py-3">
                  {formError}
                </div>
              )}

              {!staffCanSubmit && (
                <p className="text-xs text-pk-text-muted pt-1">
                  {staffHasErrors ? "Fix the errors above to continue." : "Fill in all required fields (*) to add staff."}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                {staffCanSubmit && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-pk-teal-600 hover:bg-pk-teal-700 disabled:bg-pk-teal-400 text-white font-semibold px-6 py-2.5 rounded-pk-sm transition text-sm"
                  >
                    {saving ? "Adding..." : "Add Staff"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border border-pk-border-strong text-pk-text-secondary hover:bg-pk-surface-raised font-medium px-6 py-2.5 rounded-pk-sm transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
