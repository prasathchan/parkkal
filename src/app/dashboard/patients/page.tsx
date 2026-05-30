"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeadCell,
} from "@/components/ui/table";
import { calculateAge, formatDate } from "@/lib/utils";

interface Patient {
  id: string;
  patientCode: string;
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  createdAt: number;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPatients = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const url = q ? `/api/patients?search=${encodeURIComponent(q)}` : "/api/patients";
      const res = await fetch(url);
      const data = await res.json();
      setPatients(data.patients || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchPatients(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchPatients]);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Patients"
        breadcrumb={[{ label: "Dashboard" }, { label: "Patients" }]}
      />

      <main className="flex-1 p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="search"
              placeholder="Search by name, phone, or patient code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-sm px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Link href="/dashboard/patients/new">
              <Button size="sm">
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Patient
              </Button>
            </Link>
          </div>

          <Table>
            <TableHead>
              <tr>
                <TableHeadCell>Code</TableHeadCell>
                <TableHeadCell>Name</TableHeadCell>
                <TableHeadCell>Phone</TableHeadCell>
                <TableHeadCell>Age / Gender</TableHeadCell>
                <TableHeadCell>Registered</TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    No patients found
                  </TableCell>
                </TableRow>
              ) : (
                patients.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-medium text-blue-700">
                      {p.patientCode}
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.phone}</TableCell>
                    <TableCell>
                      {p.dateOfBirth ? `${calculateAge(p.dateOfBirth)} yrs` : "—"}
                      {p.gender ? ` · ${p.gender}` : ""}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {formatDate(p.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/patients/${p.id}`}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
