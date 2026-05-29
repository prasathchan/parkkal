import { prisma } from "@/lib/prisma";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Stethoscope } from "lucide-react";

export const dynamic = "force-dynamic";

async function getTreatments() {
  return prisma.treatment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      patient: { select: { name: true, patientId: true } },
      doctor: { select: { name: true } },
    },
  });
}

export default async function TreatmentsPage() {
  const treatments = await getTreatments();

  const totalRevenue = treatments.reduce(
    (sum, t) => sum + Number(t.cost),
    0
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Treatments</h1>
          <p className="text-sm text-gray-500 mt-1">
            {treatments.length} treatment record{treatments.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Total Treatments</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {treatments.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Average Cost</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {treatments.length > 0
                ? formatCurrency(totalRevenue / treatments.length)
                : formatCurrency(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Treatments Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-blue-600" />
            Treatment Records
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          {treatments.length === 0 ? (
            <div className="text-center py-12">
              <Stethoscope className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No treatment records</p>
              <p className="text-gray-400 text-sm mt-1">
                Treatments will appear here after they are recorded
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Procedure</TableHead>
                  <TableHead>Tooth #</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {treatments.map((treatment) => (
                  <TableRow key={treatment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">
                          {treatment.patient.name}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          {treatment.patient.patientId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {treatment.doctor.name}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-gray-900">
                      {treatment.procedure}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {treatment.toothNumber ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                      {treatment.description}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-gray-900">
                      {formatCurrency(Number(treatment.cost))}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(treatment.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
