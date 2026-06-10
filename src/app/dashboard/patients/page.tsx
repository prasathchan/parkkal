/**
 * dashboard/patients/page.tsx
 *
 * The patient list page — shows all patients for this clinic, with search
 * and pagination. Clicking a patient goes to their detail page.
 *
 * HOW IT WORKS:
 *  1. User types in the search box
 *  2. useDebounce waits 300ms after typing stops (prevents API spam)
 *  3. useEffect re-fetches patients whenever search or page changes
 *  4. patientsApi.list() makes the typed API call
 *
 * TO ADD A NEW COLUMN: add it to the <TableHead> and <TableRow> sections below.
 */
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
import { SkeletonTable } from "@/components/ui/skeleton";
import { calculateAge, formatDate } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { patientsApi } from "@/api";
import type { Patient } from "@/types";

// How many patients to show per page
const PAGE_SIZE = 25;

export default function PatientsPage() {
  // ─── State ─────────────────────────────────────────────────────────────────

  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchInput, setSearchInput] = useState("");   // What the user is typing RIGHT NOW
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);              // Which page of results we're on
  const [total, setTotal] = useState(0);                // Total number of matching patients

  // Wait 300ms after the user stops typing before searching
  // (prevents firing an API call on every single keystroke)
  const search = useDebounce(searchInput, 300);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchPatients = useCallback(async (query: string, pageOffset: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await patientsApi.list({
        search: query || undefined,
        limit: PAGE_SIZE,
        offset: pageOffset,
      });
      setPatients(result.patients);
      setTotal(result.total);
    } catch {
      setErrorMsg("Failed to load patients. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset to page 1 whenever the search changes
  useEffect(() => { setOffset(0); }, [search]);

  // Fetch patients whenever search or page changes
  useEffect(() => {
    fetchPatients(search, offset);
  }, [search, offset, fetchPatients]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Patients"
        breadcrumb={[{ label: "Dashboard" }, { label: "Patients" }]}
      />

      <main className="flex-1 p-6">
        {/* Error banner — shown if the API call fails */}
        {errorMsg && (
          <div role="alert" className="mb-4 flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            <span>{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-red-400 hover:text-red-600 font-medium"
            >
              ✕
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          {/* Search bar + New Patient button */}
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="search"
              aria-label="Search patients"
              placeholder="Search by name, phone, or patient code..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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

          {/* Patient list */}
          {loading ? (
            <div role="status" aria-label="Loading patients..." className="p-4">
              <SkeletonTable rows={8} cols={5} />
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              {searchInput ? "No patients found matching your search" : "No patients yet"}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
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
                    {patients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell className="font-mono text-xs font-medium text-blue-700">
                          {patient.patientCode}
                        </TableCell>
                        <TableCell className="font-medium">{patient.name}</TableCell>
                        <TableCell>{patient.phone}</TableCell>
                        <TableCell>
                          {patient.dateOfBirth ? `${calculateAge(patient.dateOfBirth)} yrs` : "—"}
                          {patient.gender ? ` · ${patient.gender}` : ""}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {formatDate(patient.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/dashboard/patients/${patient.id}`}
                            className="text-blue-600 hover:underline text-xs font-medium"
                          >
                            View
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {patients.map((patient) => (
                  <Link
                    key={patient.id}
                    href={`/dashboard/patients/${patient.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900 truncate">{patient.name}</span>
                        <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">{patient.patientCode}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{patient.phone}</p>
                      {patient.dateOfBirth && (
                        <p className="text-xs text-slate-400">{calculateAge(patient.dateOfBirth)} yrs{patient.gender ? ` · ${patient.gender}` : ""}</p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-slate-300 flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Pagination — only shown when there are more than PAGE_SIZE results */}
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
