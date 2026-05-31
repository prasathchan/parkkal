"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BloodGroupSelect } from "@/components/ui/blood-group-select";
import { AddressForm, type AddressValue } from "@/components/ui/address-form";

function validatePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length < 10) return "Phone number must be at least 10 digits";
  if (digits.length > 15) return "Phone number is too long";
  return "";
}

function validateEmail(email: string) {
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Enter a valid email address";
}

function validatePan(pan: string) {
  if (!pan) return "";
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase()) ? "" : "PAN format: ABCDE1234F";
}

function validateAadhaar(aadhaar: string) {
  if (!aadhaar) return "";
  return /^\d{12}$/.test(aadhaar.replace(/\s/g, "")) ? "" : "Aadhaar must be 12 digits";
}

export default function NewPatientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    dateOfBirth: "",
    gender: "",
    bloodGroup: "",
    medicalHistory: "",
    panNumber: "",
    aadhaarNumber: "",
    ecName: "",
    ecRelationship: "",
    ecPhone: "",
    ecEmail: "",
  });
  const [addressData, setAddressData] = useState<AddressValue>({
    country: "India",
    state: "",
    district: "",
    city: "",
    pincode: "",
    fullAddress: "",
  });

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setTouched(t => ({ ...t, [field]: true }));
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  const fieldErrors = {
    phone: validatePhone(form.phone),
    email: validateEmail(form.email),
    panNumber: validatePan(form.panNumber),
    aadhaarNumber: validateAadhaar(form.aadhaarNumber),
    ecPhone: validatePhone(form.ecPhone),
  };

  const requiredFilled = form.name.trim() && form.phone.trim() && form.ecName.trim() && form.ecRelationship && form.ecPhone.trim();
  const hasValidationErrors = Object.values(fieldErrors).some(Boolean);
  const canSubmit = requiredFilled && !hasValidationErrors;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);

    const addressString = [
      addressData.fullAddress,
      addressData.city,
      addressData.district,
      addressData.state
        ? addressData.pincode
          ? `${addressData.state} - ${addressData.pincode}`
          : addressData.state
        : "",
      addressData.country,
    ]
      .filter(Boolean)
      .join(", ")
      .trim();

    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      bloodGroup: form.bloodGroup || undefined,
      address: addressString || undefined,
      medicalHistory: form.medicalHistory,
      panNumber: form.panNumber,
      aadhaarNumber: form.aadhaarNumber,
      emergencyContact: form.ecName && form.ecRelationship && form.ecPhone
        ? { name: form.ecName, relationship: form.ecRelationship, phone: form.ecPhone, email: form.ecEmail }
        : undefined,
    };

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create patient");
        return;
      }

      router.push(`/dashboard/patients/${data.patient.id}`);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="New Patient"
        breadcrumb={[
          { label: "Dashboard" },
          { label: "Patients", href: "/dashboard/patients" },
          { label: "New" },
        ]}
      />

      <main className="flex-1 p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Patient Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="name"
                  label="Full Name *"
                  value={form.name}
                  onChange={update("name")}
                  required
                  placeholder="e.g. Rajan Kumar"
                />
                <Input
                  id="phone"
                  label="Phone Number *"
                  value={form.phone}
                  onChange={update("phone")}
                  required
                  placeholder="+91 98765 43210"
                  error={touched.phone ? fieldErrors.phone : ""}
                />
              </div>

              <Input
                id="email"
                label="Email Address"
                value={form.email}
                onChange={update("email")}
                placeholder="patient@example.com"
                error={touched.email ? fieldErrors.email : ""}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="dob"
                  type="date"
                  label="Date of Birth"
                  value={form.dateOfBirth}
                  onChange={update("dateOfBirth")}
                />
                <Select
                  id="gender"
                  label="Gender"
                  value={form.gender}
                  onChange={update("gender")}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Blood Group
                </label>
                <BloodGroupSelect
                  value={form.bloodGroup}
                  onChange={(v) => setForm((f) => ({ ...f, bloodGroup: v }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Address
                </label>
                <AddressForm value={addressData} onChange={setAddressData} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Medical History
                </label>
                <textarea
                  value={form.medicalHistory}
                  onChange={update("medicalHistory")}
                  rows={3}
                  placeholder="Known allergies, conditions, medications..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                />
              </div>

              {/* Emergency Contact */}
              <div className={`border-2 rounded-lg p-4 ${!form.ecName || !form.ecRelationship || !form.ecPhone ? "border-red-300" : "border-green-300"}`}>
                <p className="text-sm font-semibold text-slate-900 mb-3">
                  Emergency Contact <span className="text-red-500">*</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    id="ec-name"
                    label="Contact Name *"
                    value={form.ecName}
                    onChange={update("ecName")}
                    required
                    placeholder="Full name"
                  />
                  <Select
                    id="ec-rel"
                    label="Relationship *"
                    value={form.ecRelationship}
                    onChange={update("ecRelationship")}
                  >
                    <option value="">Select relationship</option>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Friend">Friend</option>
                    <option value="Other">Other</option>
                  </Select>
                  <Input
                    id="ec-phone"
                    label="Phone *"
                    value={form.ecPhone}
                    onChange={update("ecPhone")}
                    required
                    placeholder="+91 98765 43210"
                    error={touched.ecPhone ? fieldErrors.ecPhone : ""}
                  />
                  <Input
                    id="ec-email"
                    type="email"
                    label="Email (optional)"
                    value={form.ecEmail}
                    onChange={update("ecEmail")}
                    placeholder="emergency@example.com"
                  />
                </div>
              </div>

              {/* Documents */}
              <div className="border border-yellow-300 rounded-lg p-4 bg-yellow-50">
                <p className="text-sm font-semibold text-yellow-900 mb-1">Documents</p>
                <p className="text-xs text-yellow-700 mb-3">
                  Adding PAN and Aadhaar helps with government compliance and identity verification.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    id="pan"
                    label="PAN Number (optional)"
                    value={form.panNumber}
                    onChange={update("panNumber")}
                    placeholder="AAAAA9999A"
                    maxLength={10}
                    error={touched.panNumber ? fieldErrors.panNumber : ""}
                  />
                  <Input
                    id="aadhaar"
                    label="Aadhaar Number (optional)"
                    value={form.aadhaarNumber}
                    onChange={update("aadhaarNumber")}
                    placeholder="12 digits"
                    maxLength={12}
                    error={touched.aadhaarNumber ? fieldErrors.aadhaarNumber : ""}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              {!canSubmit && (
                <p className="text-xs text-slate-400 pt-1">
                  {hasValidationErrors
                    ? "Fix the errors above to continue."
                    : "Fill in all required fields (*) to register."}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                {canSubmit && (
                  <Button type="submit" disabled={loading}>
                    {loading ? "Saving..." : "Register Patient"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
