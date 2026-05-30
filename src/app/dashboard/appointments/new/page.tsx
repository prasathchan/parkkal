"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface Patient { id: string; patientCode: string; name: string; }
interface Doctor { id: string; name: string; }

export default function NewAppointmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    appointmentDate: "",
    appointmentTime: "",
    type: "CONSULTATION",
    notes: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/patients${patientSearch ? `?search=${encodeURIComponent(patientSearch)}` : ""}`)
        .then((r) => r.json())
        .then((d) => setPatients((d.patients || []).slice(0, 20)));
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setDoctors([{ id: d.user.userId, name: d.user.name }]);
      });
  }, []);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.patientId) { setError("Please select a patient"); return; }
    if (!form.doctorId) { setError("Please select a doctor"); return; }
    setLoading(true);

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create appointment"); return; }
      router.push("/dashboard/appointments");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="New Appointment"
        breadcrumb={[
          { label: "Dashboard" },
          { label: "Appointments", href: "/dashboard/appointments" },
          { label: "New" },
        ]}
      />

      <main className="flex-1 p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Appointment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Patient search */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Patient *
                </label>
                <input
                  type="text"
                  placeholder="Search patient by name or code..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                />
                <select
                  value={form.patientId}
                  onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select Patient —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patientCode} · {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <Select
                id="doctor"
                label="Doctor *"
                value={form.doctorId}
                onChange={update("doctorId")}
              >
                <option value="">— Select Doctor —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.name}
                  </option>
                ))}
              </Select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="date"
                  type="date"
                  label="Date *"
                  value={form.appointmentDate}
                  onChange={update("appointmentDate")}
                  required
                />
                <Input
                  id="time"
                  type="time"
                  label="Time *"
                  value={form.appointmentTime}
                  onChange={update("appointmentTime")}
                  required
                />
              </div>

              <Select id="type" label="Appointment Type" value={form.type} onChange={update("type")}>
                <option value="CONSULTATION">Consultation</option>
                <option value="CHECKUP">Checkup</option>
                <option value="TREATMENT">Treatment</option>
                <option value="FOLLOWUP">Follow-up</option>
              </Select>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={update("notes")}
                  rows={3}
                  placeholder="Additional notes..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Book Appointment"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
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
