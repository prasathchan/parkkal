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
import { exportPatients } from "@/api/export";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
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

      <main id="main-content" className="flex-1 p-6">
        {/* Error banner — shown if the API call fails */}
        {errorMsg && (
          <ErrorState message={errorMsg} onRetry={() => fetchPatients(search, offset)} />
        )}

        <div className="bg-pk-surface rounded-pk-lg border border-pk-border shadow-pk-e1">
          {/* Search bar + New Patient button */}
          <div className="px-6 py-4 border-b border-pk-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="search"
              aria-label="Search patients"
              placeholder="Search by name, phone, or patient code..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full sm:max-w-sm px-4 py-2 border border-pk-border-strong rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportPatients}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-pk-sm text-sm font-medium border border-pk-border-strong text-pk-text-secondary hover:bg-pk-surface-raised transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
              <Link href="/dashboard/patients/new">
                <Button size="sm">
                  <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Patient
                </Button>
              </Link>
            </div>
          </div>

          {/* Patient list */}
          {loading ? (
            <div role="status" aria-label="Loading patients..." className="p-4">
              <SkeletonTable rows={8} cols={5} />
            </div>
          ) : patients.length === 0 ? (
            <EmptyState
              title={searchInput ? "No patients found" : "No patients yet"}
              description={searchInput ? "Try a different name, phone, or patient code." : "Add your first patient to get started."}
              action={searchInput ? undefined : { label: "Add Patient", href: "/dashboard/patients/new" }}
            />
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
                        <TableCell className="font-mono text-xs font-medium text-pk-teal-700">
                          {patient.patientCode}
                        </TableCell>
                        <TableCell className="font-medium">{patient.name}</TableCell>
                        <TableCell>{patient.phone}</TableCell>
                        <TableCell>
                          {patient.dateOfBirth ? `${calculateAge(patient.dateOfBirth)} yrs` : "—"}
                          {patient.gender ? ` · ${patient.gender}` : ""}
                        </TableCell>
                        <TableCell className="text-pk-text-muted">
                          {formatDate(patient.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/dashboard/patients/${patient.id}`}
                            className="text-pk-teal-600 hover:underline text-xs font-medium"
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
              <div className="md:hidden divide-y divide-pk-border">
                {patients.map((patient) => (
                  <Link
                    key={patient.id}
                    href={`/dashboard/patients/${patient.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-pk-surface-raised transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-pk-text truncate">{patient.name}</span>
                        <span className="text-[10px] font-mono text-pk-teal-600 bg-pk-teal-50 px-1.5 py-0.5 rounded flex-shrink-0">{patient.patientCode}</span>
                      </div>
                      <p className="text-xs text-pk-text-muted mt-0.5">{patient.phone}</p>
                      {patient.dateOfBirth && (
                        <p className="text-xs text-pk-text-muted">{calculateAge(patient.dateOfBirth)} yrs{patient.gender ? ` · ${patient.gender}` : ""}</p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-pk-text-muted flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Pagination — only shown when there are more than PAGE_SIZE results */}
          {total > PAGE_SIZE && (
            <div className="px-6 py-3 border-t border-pk-border flex items-center justify-between text-sm text-pk-text-muted">
              <span>
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total} patients
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="px-3 py-1 rounded-pk-sm border border-pk-border disabled:opacity-40 hover:bg-pk-surface-raised"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total}
                  className="px-3 py-1 rounded-pk-sm border border-pk-border disabled:opacity-40 hover:bg-pk-surface-raised"
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
