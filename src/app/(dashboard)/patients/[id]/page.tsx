import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatDate, formatCurrency, calculateAge } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, User, Phone, Mail, MapPin, Calendar, Stethoscope, FileText } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "info" }> = {
  SCHEDULED: { label: "Scheduled", variant: "info" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
  NO_SHOW: { label: "No Show", variant: "warning" },
};

const invoiceStatusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "info" }> = {
  PENDING: { label: "Pending", variant: "warning" },
  PARTIAL: { label: "Partial", variant: "info" },
  PAID: { label: "Paid", variant: "success" },
};

export default async function PatientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const patient = await prisma.patient.findUnique({
    where: { id: params.id },
    include: {
      appointments: {
        orderBy: { date: "desc" },
        include: { doctor: { select: { name: true } } },
        take: 10,
      },
      treatments: {
        orderBy: { createdAt: "desc" },
        include: { doctor: { select: { name: true } } },
        take: 10,
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!patient) notFound();

  const genderLabel: Record<string, string> = {
    MALE: "Male",
    FEMALE: "Female",
    OTHER: "Other",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/patients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
            <Badge variant="outline" className="font-mono">{patient.patientId}</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Patient Details</p>
        </div>
        <Link href={`/appointments/new?patientId=${patient.id}`}>
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Calendar className="w-4 h-4" />
            Book Appointment
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="text-sm font-medium text-gray-900">{patient.phone}</p>
              </div>
            </div>

            {patient.email && (
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm font-medium text-gray-900">{patient.email}</p>
                </div>
              </div>
            )}

            {patient.dateOfBirth && (
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Date of Birth</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDate(patient.dateOfBirth)} ({calculateAge(patient.dateOfBirth)} yrs)
                  </p>
                </div>
              </div>
            )}

            {patient.gender && (
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Gender</p>
                  <p className="text-sm font-medium text-gray-900">
                    {genderLabel[patient.gender] ?? patient.gender}
                  </p>
                </div>
              </div>
            )}

            {patient.address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Address</p>
                  <p className="text-sm font-medium text-gray-900">{patient.address}</p>
                </div>
              </div>
            )}

            {patient.medicalHistory && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Medical History</p>
                <p className="text-sm text-gray-700 bg-amber-50 p-2 rounded-md">
                  {patient.medicalHistory}
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-gray-100 text-xs text-gray-400">
              Registered: {formatDate(patient.createdAt)}
            </div>
          </CardContent>
        </Card>

        {/* Right side tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Appointments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Appointments ({patient.appointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {patient.appointments.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No appointments yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patient.appointments.map((appt) => {
                      const sc = statusConfig[appt.status] ?? { label: appt.status, variant: "default" as const };
                      return (
                        <TableRow key={appt.id}>
                          <TableCell className="text-sm">
                            <p className="text-gray-900">{formatDate(appt.date)}</p>
                            <p className="text-gray-500 text-xs">{appt.time}</p>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">
                            {appt.doctor.name}
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">
                            {appt.type}
                          </TableCell>
                          <TableCell>
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Treatments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-blue-600" />
                Treatments ({patient.treatments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {patient.treatments.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No treatments yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Procedure</TableHead>
                      <TableHead>Tooth #</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patient.treatments.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm font-medium text-gray-900">
                          {t.procedure}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {t.toothNumber ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {t.doctor.name}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-gray-900">
                          {formatCurrency(Number(t.cost))}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(t.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Invoices ({patient.invoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {patient.invoices.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No invoices yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Total</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patient.invoices.map((inv) => {
                      const sc = invoiceStatusConfig[inv.status] ?? { label: inv.status, variant: "default" as const };
                      const balance = Number(inv.totalAmount) - Number(inv.paidAmount);
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="text-sm font-medium">
                            {formatCurrency(Number(inv.totalAmount))}
                          </TableCell>
                          <TableCell className="text-sm text-green-700">
                            {formatCurrency(Number(inv.paidAmount))}
                          </TableCell>
                          <TableCell className={`text-sm font-medium ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
                            {formatCurrency(balance)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {formatDate(inv.createdAt)}
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
      </div>
    </div>
  );
}
