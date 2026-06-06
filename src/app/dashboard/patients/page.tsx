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

const PAGE_SIZE = 25;

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchPatients = useCallback(async (q: string, off: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
      if (q) params.set("search", q);
      const res = await fetch(`/api/patients?${params}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setPatients(data.patients || []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg("Failed to load patients. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOffset(0);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchPatients(search, offset), 300);
    return () => clearTimeout(timer);
  }, [search, offset, fetchPatients]);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Patients"
        breadcrumb={[{ label: "Dashboard" }, { label: "Patients" }]}
      />

      <main className="flex-1 p-6">
        {errorMsg && (
          <div className="mb-4 flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 font-medium">✕</button>
          </div>
        )}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="search"
              aria-label="Search patients"
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

          {/* Pagination footer */}
          {total > PAGE_SIZE && (
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
              <span>
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total} patients
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="px-3 py-1 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total}
                  className="px-3 py-1 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
