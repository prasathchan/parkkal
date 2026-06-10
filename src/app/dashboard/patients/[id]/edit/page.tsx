"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/context/toast-context";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressForm, type AddressValue } from "@/components/ui/address-form";
import { parseAddress, serializeAddress, EMPTY_ADDRESS } from "@/lib/address";
import { BloodGroupSelect } from "@/components/ui/blood-group-select";
import { patientsApi, ApiError } from "@/api";


const GENDERS: { value: string; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

export default function PatientEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
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
  });
  const [addressData, setAddressData] = useState<AddressValue>({ ...EMPTY_ADDRESS });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    patientsApi.get(id)
      .then((d) => {
        const p = d.patient;
        if (!p) return;
        setForm({
          name: p.name || "",
          phone: p.phone || "",
          email: p.email || "",
          dateOfBirth: p.dateOfBirth || "",
          gender: p.gender || "",
          bloodGroup: p.bloodGroup || "",
          medicalHistory: p.medicalHistory || "",
          panNumber: p.panNumber || "",
          aadhaarNumber: p.aadhaarNumber || "",
        });
        setAddressData(parseAddress(p.address ?? null));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const fieldErrors: Record<string, string> = {
    name: !form.name.trim() ? "Name is required" : "",
    phone: form.phone && !/^\+?\d{10,15}$/.test(form.phone.replace(/[\s-]/g, ""))
      ? "Phone must be 10–15 digits" : "",
    email: form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
      ? "Enter a valid email address" : "",
    panNumber: form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.panNumber.toUpperCase())
      ? "PAN format: ABCDE1234F" : "",
    aadhaarNumber: form.aadhaarNumber && !/^\d{12}$/.test(form.aadhaarNumber.replace(/\s/g, ""))
      ? "Aadhaar must be 12 digits" : "",
  };

  const hasErrors = Object.values(fieldErrors).some(Boolean);

  function touch(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, phone: true, email: true, panNumber: true, aadhaarNumber: true });
    if (hasErrors) return;

    setSaving(true);
    setError("");
    try {
      await patientsApi.update(id, {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: (form.gender || undefined) as "MALE" | "FEMALE" | "OTHER" | undefined,
        address: serializeAddress(addressData) || undefined,
        medicalHistory: form.medicalHistory || undefined,
        bloodGroup: form.bloodGroup || undefined,
        panNumber: form.panNumber || null,
        aadhaarNumber: form.aadhaarNumber || null,
      });
      toast.success("Patient updated successfully");
      setSuccess(true);
      setTimeout(() => router.push(`/dashboard/patients/${id}`), 800);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong.";
      toast.error(msg);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-slate-400">Loading...</div>;
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Edit Patient"
        breadcrumb={[
          { label: "Dashboard" },
          { label: "Patients", href: "/dashboard/patients" },
          { label: form.name || "Patient", href: `/dashboard/patients/${id}` },
          { label: "Edit" },
        ]}
      />

      <main className="flex-1 p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Edit Patient Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
                  Patient updated successfully. Redirecting...
                </div>
              )}

              <Input
                id="name"
                label="Full Name *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onBlur={() => touch("name")}
                error={touched.name ? fieldErrors.name : ""}
                required
              />

              <Input
                id="phone"
                label="Phone Number"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                onBlur={() => touch("phone")}
                error={touched.phone ? fieldErrors.phone : ""}
                placeholder="10–15 digit mobile number"
              />

              <Input
                id="email"
                type="email"
                label="Email Address"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                onBlur={() => touch("email")}
                error={touched.email ? fieldErrors.email : ""}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="dob"
                  type="date"
                  label="Date of Birth"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select gender</option>
                    {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Blood Group</label>
                <BloodGroupSelect
                  value={form.bloodGroup || ""}
                  onChange={(v) => setForm((f) => ({ ...f, bloodGroup: v }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
                <AddressForm value={addressData} onChange={setAddressData} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Medical History / Known Conditions
                </label>
                <textarea
                  value={form.medicalHistory}
                  onChange={(e) => setForm((f) => ({ ...f, medicalHistory: e.target.value }))}
                  rows={3}
                  placeholder="Allergies, chronic conditions, current medications..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving || hasErrors}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/patients/${id}`)}
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
