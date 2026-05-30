"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function NewPatientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    dateOfBirth: "",
    gender: "",
    address: "",
    medicalHistory: "",
    panNumber: "",
    aadhaarNumber: "",
    ecName: "",
    ecRelationship: "",
    ecPhone: "",
    ecEmail: "",
  });

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      address: form.address,
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
                />
              </div>

              <Input
                id="email"
                type="email"
                label="Email Address"
                value={form.email}
                onChange={update("email")}
                placeholder="patient@example.com"
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
                  Address
                </label>
                <textarea
                  value={form.address}
                  onChange={update("address")}
                  rows={2}
                  placeholder="Street, City, State, PIN"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                />
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
                  />
                  <Input
                    id="aadhaar"
                    label="Aadhaar Number (optional)"
                    value={form.aadhaarNumber}
                    onChange={update("aadhaarNumber")}
                    placeholder="12 digits"
                    maxLength={12}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Register Patient"}
                </Button>
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
