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
  patientId: string;
  doctorId: string;
  description: string;
  toothNumbers?: string;
  procedure?: string;
  cost: number;
  createdAt: number;
  patientName?: string;
  doctorName?: string;
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

      <main className="flex-1 p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">All Treatments</h2>
          </div>

          <Table>
            <TableHead>
              <tr>
                <TableHeadCell>Patient</TableHeadCell>
                <TableHeadCell>Description</TableHeadCell>
                <TableHeadCell>Procedure</TableHeadCell>
                <TableHeadCell>Tooth(s)</TableHeadCell>
                <TableHeadCell>Doctor</TableHeadCell>
                <TableHeadCell>Cost</TableHeadCell>
                <TableHeadCell>Date</TableHeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : treatments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    No treatments recorded
                  </TableCell>
                </TableRow>
              ) : (
                treatments.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.patientName || t.patientId}</TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell className="text-slate-600">{t.procedure || "—"}</TableCell>
                    <TableCell className="text-slate-600">{t.toothNumbers || "—"}</TableCell>
                    <TableCell className="text-slate-600">
                      {t.doctorName ? `Dr. ${t.doctorName}` : "—"}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      {formatCurrency(t.cost)}
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(t.createdAt)}</TableCell>
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
