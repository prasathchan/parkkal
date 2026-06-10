"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/toast-context";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BloodGroupSelect } from "@/components/ui/blood-group-select";
import { AddressForm, type AddressValue } from "@/components/ui/address-form";
import { serializeAddress, EMPTY_ADDRESS } from "@/lib/address";
import { patientsApi, ApiError } from "@/api";

interface PatientOption { id: string; patientCode: string; name: string; phone: string; }

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
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [apiFieldErrors, setApiFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    dateOfBirth: "",
    gender: "",
    bloodGroup: "",
    medicalHistory: "",
    referralSource: "",
    panNumber: "",
    aadhaarNumber: "",
    ecName: "",
    ecRelationship: "",
    ecPhone: "",
    ecEmail: "",
  });
  const [addressData, setAddressData] = useState<AddressValue>({ ...EMPTY_ADDRESS });

  // Referral
  const [referralType, setReferralType] = useState<"external" | "patient">("external");
  const [referralSearch, setReferralSearch] = useState("");
  const [referralPatients, setReferralPatients] = useState<PatientOption[]>([]);
  const [referredByPatientId, setReferredByPatientId] = useState<string | null>(null);
  const [referralDropdownOpen, setReferralDropdownOpen] = useState(false);
  const [selectedReferralName, setSelectedReferralName] = useState("");
  const referralRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (referralType !== "patient") return;
    const timer = setTimeout(() => {
      patientsApi.list({ search: referralSearch || undefined })
        .then((d) => setReferralPatients((d.patients || []).slice(0, 20)))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [referralSearch, referralType]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (referralRef.current && !referralRef.current.contains(e.target as Node)) {
        setReferralDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const requiredFilled = form.name.trim() && form.phone.trim();
  // EC is optional; only block on ecPhone error if the user started filling EC fields
  const ecPartiallyFilled = !!(form.ecName.trim() || form.ecRelationship || form.ecPhone.trim());
  const hasValidationErrors =
    !!fieldErrors.phone || !!fieldErrors.email || !!fieldErrors.panNumber || !!fieldErrors.aadhaarNumber ||
    (ecPartiallyFilled && !!fieldErrors.ecPhone);
  const canSubmit = requiredFilled && !hasValidationErrors;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setApiFieldErrors({});
    setLoading(true);

    const addressString = serializeAddress(addressData);

    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      dateOfBirth: form.dateOfBirth,
      gender: form.gender as "MALE" | "FEMALE" | "OTHER" | undefined,
      bloodGroup: form.bloodGroup || undefined,
      address: addressString || undefined,
      medicalHistory: form.medicalHistory,
      referralSource: referralType === "external" ? (form.referralSource || undefined) : undefined,
      referredByPatientId: referralType === "patient" ? referredByPatientId : null,
      panNumber: form.panNumber,
      aadhaarNumber: form.aadhaarNumber,
      emergencyContact: form.ecName && form.ecRelationship && form.ecPhone
        ? { name: form.ecName, relationship: form.ecRelationship, phone: form.ecPhone, email: form.ecEmail }
        : undefined,
    };

    try {
      const data = await patientsApi.create(payload);
      toast.success("Patient created successfully");
      router.push(`/dashboard/patients/${data.patient.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && e.details?.length) {
        const errs: Record<string, string> = {};
        for (const d of e.details) {
          if (d.path?.[0]) errs[String(d.path[0])] = d.message;
        }
        setApiFieldErrors(errs);
        return;
      }
      const msg = e instanceof ApiError ? e.message : "Something went wrong.";
      toast.error(msg);
      setError(msg);
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
                <div>
                  <Input
                    id="name"
                    label="Full Name *"
                    value={form.name}
                    onChange={update("name")}
                    required
                    placeholder="e.g. Rajan Kumar"
                  />
                  {apiFieldErrors.name && <p className="mt-1 text-xs text-red-600" role="alert">{apiFieldErrors.name}</p>}
                </div>
                <div>
                  <Input
                    id="phone"
                    label="Phone Number *"
                    value={form.phone}
                    onChange={update("phone")}
                    required
                    placeholder="+91 98765 43210"
                    error={touched.phone ? fieldErrors.phone : ""}
                  />
                  {apiFieldErrors.phone && <p className="mt-1 text-xs text-red-600" role="alert">{apiFieldErrors.phone}</p>}
                </div>
              </div>

              <div>
                <Input
                  id="email"
                  label="Email Address"
                  value={form.email}
                  onChange={update("email")}
                  placeholder="patient@example.com"
                  error={touched.email ? fieldErrors.email : ""}
                />
                {apiFieldErrors.email && <p className="mt-1 text-xs text-red-600" role="alert">{apiFieldErrors.email}</p>}
              </div>

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
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  How did the patient find us? <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => { setReferralType("external"); setReferredByPatientId(null); setSelectedReferralName(""); }}
                    className={`flex-1 py-2 text-sm rounded-lg border transition ${referralType === "external" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"}`}
                  >
                    External Source
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReferralType("patient"); setForm(f => ({ ...f, referralSource: "" })); }}
                    className={`flex-1 py-2 text-sm rounded-lg border transition ${referralType === "patient" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"}`}
                  >
                    Existing Patient
                  </button>
                </div>
                {referralType === "external" ? (
                  <input
                    type="text"
                    value={form.referralSource}
                    onChange={update("referralSource")}
                    maxLength={100}
                    placeholder="e.g. Google, Facebook, walk-in…"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                ) : (
                  <div className="relative" ref={referralRef}>
                    <input
                      type="text"
                      value={selectedReferralName || referralSearch}
                      onChange={(e) => {
                        setReferralSearch(e.target.value);
                        setSelectedReferralName("");
                        setReferredByPatientId(null);
                        setReferralDropdownOpen(true);
                      }}
                      onFocus={() => setReferralDropdownOpen(true)}
                      placeholder="Search referring patient by name or code…"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                    {referredByPatientId && (
                      <button
                        type="button"
                        onClick={() => { setReferredByPatientId(null); setSelectedReferralName(""); setReferralSearch(""); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                    {referralDropdownOpen && referralPatients.length > 0 && (
                      <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {referralPatients.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition"
                              onClick={() => {
                                setReferredByPatientId(p.id);
                                setSelectedReferralName(`${p.patientCode} · ${p.name}`);
                                setReferralSearch("");
                                setReferralDropdownOpen(false);
                              }}
                            >
                              <span className="font-medium">{p.patientCode}</span>
                              <span className="text-slate-500"> · {p.name}</span>
                              <span className="text-slate-400 text-xs ml-1">({p.phone})</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Emergency Contact */}
              <div className="border border-slate-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-slate-900 mb-0.5">Emergency Contact</p>
                <p className="text-xs text-slate-500 mb-3">Optional — recommended but not required to save.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    id="ec-name"
                    label="Contact Name"
                    value={form.ecName}
                    onChange={update("ecName")}
                    placeholder="Full name"
                  />
                  <Select
                    id="ec-rel"
                    label="Relationship"
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
                    label="Phone"
                    value={form.ecPhone}
                    onChange={update("ecPhone")}
                    placeholder="+91 98765 43210"
                    error={touched.ecPhone && ecPartiallyFilled ? fieldErrors.ecPhone : ""}
                  />
                  <Input
                    id="ec-email"
                    type="email"
                    label="Email"
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
