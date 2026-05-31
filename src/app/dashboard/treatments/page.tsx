"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeadCell,
} from "@/components/ui/table";

interface Treatment {
  id: string;
  visitId: string;
  visitCode: string;
  visitDate: string;
  patientId: string;
  doctorId: string;
  itemName: string;
  category: string;
  toothNumber?: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  notes?: string | null;
  createdAt: number;
  patientName?: string | null;
  patientCode?: string | null;
  doctorName?: string | null;
}

export default function TreatmentsPage() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/treatments")
      .then((r) => r.json())
      .then((d) => setTreatments(d.treatments || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Treatments"
        breadcrumb={[{ label: "Dashboard" }, { label: "Treatments" }]}
      />

      <main className="flex-1 p-6 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-blue-800">
            Treatments are added inside a <strong>Visit</strong> under the Prescription tab.
          </p>
          <a
            href="/dashboard/visits/new"
            className="text-sm font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
          >
            + New Visit
          </a>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">All Treatments</h2>
            <p className="text-sm text-slate-500 mt-0.5">Summary of all treatment items across visits</p>
          </div>

          <Table>
            <TableHead>
              <tr>
                <TableHeadCell>Item Name</TableHeadCell>
                <TableHeadCell>Category</TableHeadCell>
                <TableHeadCell>Patient</TableHeadCell>
                <TableHeadCell>Doctor</TableHeadCell>
                <TableHeadCell>Visit Code</TableHeadCell>
                <TableHeadCell>Tooth #</TableHeadCell>
                <TableHeadCell>Amount</TableHeadCell>
                <TableHeadCell>Date</TableHeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : treatments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    No treatments recorded
                  </TableCell>
                </TableRow>
              ) : (
                treatments.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-slate-900">{t.itemName}</TableCell>
                    <TableCell>
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{t.category}</span>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{t.patientName || t.patientId}</div>
                      {t.patientCode && <div className="text-xs text-slate-400">{t.patientCode}</div>}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {t.doctorName ? `Dr. ${t.doctorName}` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-blue-700">
                      <a href={`/dashboard/visits/${t.visitId}`} className="hover:underline">{t.visitCode}</a>
                    </TableCell>
                    <TableCell className="text-slate-600">{t.toothNumber || "—"}</TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      {formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell className="text-slate-500">{t.visitDate}</TableCell>
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
