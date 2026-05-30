"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface Patient {
  id: string;
  patientCode: string;
  name: string;
  phone: string;
}

interface Doctor {
  id: string;
  name: string;
  role: string;
}

export default function NewVisitPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    visitDate: new Date().toISOString().split("T")[0],
    chiefComplaint: "",
    doctorNotes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/patients?limit=200")
      .then((r) => r.json())
      .then((d) => setPatients(d.patients || []));
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        // We need all users, use appointments endpoint trick or separate call
        // Fetch doctors from patients API headers — actually fetch appointments to get doctors list
        // Fallback: just load current user as doctor option
        if (d.user) setDoctors([{ id: d.user.id, name: d.user.name, role: d.user.role }]);
      });
    // Try fetching users list if exists
    fetch("/api/users").then((r) => {
      if (r.ok) r.json().then((d) => setDoctors(d.users || []));
    }).catch(() => {});
  }, []);

  const filteredPatients = patients.filter(
    (p) =>
      search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.patientCode.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId || !form.doctorId || !form.visitDate) {
      setError("Patient, Doctor, and Visit Date are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create visit");
      setSubmitting(false);
      return;
    }
    router.push(`/dashboard/visits/${data.visit.id}`);
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="New Visit"
        breadcrumb={[
          { label: "Dashboard" },
          { label: "Visits", href: "/dashboard/visits" },
          { label: "New" },
        ]}
      />
      <main className="flex-1 p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Create New Visit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              {/* Patient Search + Select */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Patient <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={form.patientId}
                  onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  size={5}
                >
                  <option value="">-- Select Patient --</option>
                  {filteredPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patientCode} · {p.name} ({p.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Doctor */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Doctor <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.doctorId}
                  onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Doctor --</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Visit Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Visit Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.visitDate}
                  onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Chief Complaint */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Chief Complaint
                </label>
                <textarea
                  value={form.chiefComplaint}
                  onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })}
                  rows={3}
                  placeholder="Patient symptoms / reason for visit..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Doctor Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Doctor Notes
                </label>
                <textarea
                  value={form.doctorNotes}
                  onChange={(e) => setForm({ ...form, doctorNotes: e.target.value })}
                  rows={3}
                  placeholder="Clinical observations..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {submitting ? "Creating..." : "Create Visit"}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
