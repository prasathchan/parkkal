import { prisma } from "@/lib/prisma";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, DollarSign, AlertCircle, CheckCircle } from "lucide-react";

export const dynamic = "force-dynamic";

interface SearchParams {
  status?: string;
}

async function getInvoices(status?: string) {
  return prisma.invoice.findMany({
    where: status ? { status: status as "PENDING" | "PARTIAL" | "PAID" } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      patient: { select: { name: true, patientId: true } },
      treatments: { select: { procedure: true, cost: true } },
    },
  });
}

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "info" }> = {
  PENDING: { label: "Pending", variant: "warning" },
  PARTIAL: { label: "Partial", variant: "info" },
  PAID: { label: "Paid", variant: "success" },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const invoices = await getInvoices(searchParams.status);

  const totalRevenue = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
  const totalPending = invoices
    .filter((i) => i.status !== "PAID")
    .reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0);
  const paidCount = invoices.filter((i) => i.status === "PAID").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Invoices</h1>
        <p className="text-sm text-gray-500 mt-1">
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Collected</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Outstanding</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(totalPending)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Paid Invoices</p>
                <p className="text-xl font-bold text-gray-900">{paidCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <form method="GET" className="flex gap-3">
            <select
              name="status"
              defaultValue={searchParams.status ?? ""}
              className="h-10 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
            </select>
            <button
              type="submit"
              className="h-10 px-4 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Filter
            </button>
            {searchParams.status && (
              <a
                href="/billing"
                className="h-10 px-4 text-sm flex items-center rounded-md hover:bg-gray-50 transition-colors text-gray-600"
              >
                Clear
              </a>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Invoice List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No invoices found</p>
              <p className="text-gray-400 text-sm mt-1">
                Invoices will appear here after treatments are recorded
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Treatments</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Paid Amount</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const sc = statusConfig[invoice.status] ?? { label: invoice.status, variant: "default" as const };
                  const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">
                            {invoice.patient.name}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            {invoice.patient.patientId}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {invoice.treatments.slice(0, 2).map((t, i) => (
                            <p key={i} className="text-gray-700">
                              {t.procedure}
                            </p>
                          ))}
                          {invoice.treatments.length > 2 && (
                            <p className="text-gray-400 text-xs">
                              +{invoice.treatments.length - 2} more
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-gray-900">
                        {formatCurrency(Number(invoice.totalAmount))}
                      </TableCell>
                      <TableCell className="text-sm text-green-700 font-medium">
                        {formatCurrency(Number(invoice.paidAmount))}
                      </TableCell>
                      <TableCell
                        className={`text-sm font-medium ${
                          balance > 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {formatCurrency(balance)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(invoice.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
