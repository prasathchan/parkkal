"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import Link from "next/link";
import { BloodGroupSelect } from "@/components/ui/blood-group-select";
import { AddressForm, type AddressValue } from "@/components/ui/address-form";

interface Member {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  role: string;
  salaryType: string;
  salaryAmount: number;
  joinedAt: string | null;
  isActive: number;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  DOCTOR: "bg-purple-100 text-purple-700",
  NURSE: "bg-pink-100 text-pink-700",
  RECEPTIONIST: "bg-blue-100 text-blue-700",
  ATTENDANT: "bg-orange-100 text-orange-700",
  HELPER: "bg-gray-100 text-gray-700",
};

const ROLES = ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "ATTENDANT", "HELPER"] as const;

export default function StaffPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    bloodGroup: "",
    panNumber: "",
    aadhaarNumber: "",
    role: "RECEPTIONIST" as typeof ROLES[number],
    salaryType: "FIXED",
    salaryAmount: "",
    joinedAt: new Date().toISOString().split("T")[0],
    password: "",
    ecName: "",
    ecRelationship: "",
    ecPhone: "",
  });
  const [staffAddress, setStaffAddress] = useState<AddressValue>({
    country: "India",
    state: "",
    district: "",
    city: "",
    pincode: "",
    fullAddress: "",
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function touch(field: string) {
    setTouched(t => ({ ...t, [field]: true }));
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
  }, []);

  async function fetchMembers() {
    setLoading(true);
    const res = await fetch("/api/org/members");
    const data = await res.json();
    setMembers(data.members || []);
    setLoading(false);
  }

  function updateForm(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setTouched(t => ({ ...t, [field]: true }));
      setForm(f => {
        const updated = { ...f, [field]: e.target.value };
        if (field === "role") {
          updated.salaryType = e.target.value === "DOCTOR" ? "PER_APPOINTMENT" : "FIXED";
        }
        return updated;
      });
    };
  }

  const staffHasErrors = Object.values(fieldErrors).some(Boolean);
  const staffCanSubmit = form.email.trim() && form.role && form.ecName?.trim() && form.ecRelationship && form.ecPhone?.trim() && !staffHasErrors;

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
      const addressString = [
        staffAddress.fullAddress,
        staffAddress.city,
        staffAddress.district,
        staffAddress.state
          ? staffAddress.pincode
            ? `${staffAddress.state} - ${staffAddress.pincode}`
            : staffAddress.state
          : "",
        staffAddress.country,
      ]
        .filter(Boolean)
        .join(", ")
        .trim();

      const res = await fetch("/api/org/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          name: form.name || undefined,
          phone: form.phone || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender || undefined,
          bloodGroup: form.bloodGroup || undefined,
          address: addressString || undefined,
          panNumber: form.panNumber || undefined,
          aadhaarNumber: form.aadhaarNumber || undefined,
          role: form.role,
          salaryType: form.salaryType,
          salaryAmount: parseFloat(form.salaryAmount) || 0,
          joinedAt: form.joinedAt,
          password: form.password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to add staff");
        return;
      }
      // Add emergency contact if provided
      if (form.ecName && form.ecRelationship && form.ecPhone) {
        await fetch("/api/emergency-contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: "USER",
            entityId: data.user.id,
            name: form.ecName,
            relationship: form.ecRelationship,
            phone: form.ecPhone,
          }),
        });
      }
      setShowModal(false);
      fetchMembers();
    } catch {
      setFormError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Staff" breadcrumb={[{ label: "Dashboard" }, { label: "Staff" }]} />
      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Organization Members</h2>
            <p className="text-sm text-slate-500">{members.length} total staff</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            + Add Staff
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading staff...</div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No staff members yet.</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Salary Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Salary Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Joined</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => (
                  <tr key={m.memberId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{m.name}</p>
                        <p className="text-xs text-slate-500">{m.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role] || "bg-gray-100 text-gray-700"}`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{m.salaryType}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {m.salaryType === "PER_APPOINTMENT"
                        ? `₹${m.salaryAmount.toLocaleString("en-IN")}/appt`
                        : `₹${m.salaryAmount.toLocaleString("en-IN")}/mo`}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{m.joinedAt || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {m.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/staff/${m.userId}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                        View
                      </Link>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Add Staff Member</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <input
                    type="text"
                    value={form.email}
                    onChange={updateForm("email")}
                    required
                    placeholder="staff@example.com"
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${touched.email && fieldErrors.email ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}`}
                  />
                  {touched.email && fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>}
                  <p className="text-xs text-slate-500 mt-1">If user exists, their profile will be used. Otherwise fill the fields below.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={updateForm("name")}
                    placeholder="Dr. Rajan Kumar"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password (for new user)</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={updateForm("password")}
                    placeholder="min 6 chars"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={updateForm("phone")}
                    placeholder="+91 98765 43210"
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${touched.phone && fieldErrors.phone ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}`}
                  />
                  {touched.phone && fieldErrors.phone && <p className="text-xs text-red-600 mt-1">{fieldErrors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={updateForm("dateOfBirth")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={updateForm("gender")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
                  <BloodGroupSelect
                    value={form.bloodGroup}
                    onChange={(v) => setForm((f) => ({ ...f, bloodGroup: v }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
                  <select
                    value={form.role}
                    onChange={updateForm("role")}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Salary Type</label>
                  <select
                    value={form.salaryType}
                    onChange={updateForm("salaryType")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FIXED">Fixed Monthly</option>
                    <option value="PER_APPOINTMENT">Per Appointment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {form.salaryType === "PER_APPOINTMENT" ? "Amount per Appointment (₹)" : "Monthly Salary (₹)"}
                  </label>
                  <input
                    type="number"
                    value={form.salaryAmount}
                    onChange={updateForm("salaryAmount")}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Joined Date</label>
                  <input
                    type="date"
                    value={form.joinedAt}
                    onChange={updateForm("joinedAt")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
                <AddressForm value={staffAddress} onChange={setStaffAddress} />
              </div>

              {/* Documents */}
              <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                <p className="text-sm font-medium text-yellow-800 mb-3">Documents (Optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">PAN Number</label>
                    <input
                      type="text"
                      value={form.panNumber}
                      onChange={updateForm("panNumber")}
                      placeholder="AAAAA9999A"
                      maxLength={10}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 uppercase ${touched.panNumber && fieldErrors.panNumber ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}`}
                    />
                    {touched.panNumber && fieldErrors.panNumber && <p className="text-xs text-red-600 mt-1">{fieldErrors.panNumber}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Aadhaar Number</label>
                    <input
                      type="text"
                      value={form.aadhaarNumber}
                      onChange={updateForm("aadhaarNumber")}
                      placeholder="12 digits"
                      maxLength={12}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${touched.aadhaarNumber && fieldErrors.aadhaarNumber ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}`}
                    />
                    {touched.aadhaarNumber && fieldErrors.aadhaarNumber && <p className="text-xs text-red-600 mt-1">{fieldErrors.aadhaarNumber}</p>}
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="border border-slate-200 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-900 mb-3">Emergency Contact *</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Contact Name *</label>
                    <input
                      type="text"
                      value={form.ecName}
                      onChange={updateForm("ecName")}
                      required
                      placeholder="Full name"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Relationship *</label>
                    <select
                      value={form.ecRelationship}
                      onChange={updateForm("ecRelationship")}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-xs font-medium text-slate-700 mb-1">Phone *</label>
                    <input
                      type="text"
                      value={form.ecPhone}
                      onChange={updateForm("ecPhone")}
                      required
                      placeholder="+91 98765 43210"
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${touched.ecPhone && fieldErrors.ecPhone ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"}`}
                    />
                    {touched.ecPhone && fieldErrors.ecPhone && <p className="text-xs text-red-600 mt-1">{fieldErrors.ecPhone}</p>}
                  </div>
                </div>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}

              {!staffCanSubmit && (
                <p className="text-xs text-slate-400 pt-1">
                  {staffHasErrors ? "Fix the errors above to continue." : "Fill in all required fields (*) to add staff."}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                {staffCanSubmit && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-6 py-2.5 rounded-lg transition text-sm"
                  >
                    {saving ? "Adding..." : "Add Staff"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-6 py-2.5 rounded-lg transition text-sm"
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
