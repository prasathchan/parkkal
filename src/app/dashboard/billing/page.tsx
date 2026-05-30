"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeadCell,
} from "@/components/ui/table";

interface Invoice {
  id: string;
  patientId: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  patientName?: string;
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Billing"
        breadcrumb={[{ label: "Dashboard" }, { label: "Billing" }]}
      />

      <main className="flex-1 p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Invoices</h2>
            <div className="flex gap-2 text-xs">
              <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                {invoices.filter((i) => i.status === "PENDING").length} Pending
              </span>
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {invoices.filter((i) => i.status === "PARTIAL").length} Partial
              </span>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">
                {invoices.filter((i) => i.status === "PAID").length} Paid
              </span>
            </div>
          </div>

          <Table>
            <TableHead>
              <tr>
                <TableHeadCell>Patient</TableHeadCell>
                <TableHeadCell>Total</TableHeadCell>
                <TableHeadCell>Paid</TableHeadCell>
                <TableHeadCell>Balance</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Date</TableHeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      {inv.patientName || inv.patientId}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(inv.totalAmount)}
                    </TableCell>
                    <TableCell className="text-green-700">
                      {formatCurrency(inv.paidAmount)}
                    </TableCell>
                    <TableCell className="text-red-600 font-medium">
                      {formatCurrency(inv.totalAmount - inv.paidAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(inv.status)}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(inv.createdAt)}</TableCell>
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
