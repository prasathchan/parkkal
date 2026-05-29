import { prisma } from "@/lib/prisma";
import { formatDate, calculateAge } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Search, Users } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
}

async function getPatients(search?: string) {
  return prisma.patient.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { patientId: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { appointments: true, treatments: true },
      },
    },
  });
}

const genderLabel: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const patients = await getPatients(searchParams.q);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage patient records — {patients.length} patient{patients.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <Link href="/patients/new">
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
            <UserPlus className="w-4 h-4" />
            New Patient
          </Button>
        </Link>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <form method="GET" className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                name="q"
                defaultValue={searchParams.q ?? ""}
                placeholder="Search by name, patient ID, phone, or email..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <Button type="submit" variant="outline">
              Search
            </Button>
            {searchParams.q && (
              <Link href="/patients">
                <Button variant="ghost">Clear</Button>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Patient Records
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          {patients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No patients found</p>
              <p className="text-gray-400 text-sm mt-1">
                {searchParams.q
                  ? "Try a different search term"
                  : "Add your first patient to get started"}
              </p>
              {!searchParams.q && (
                <Link href="/patients/new">
                  <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
                    Add First Patient
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Age / Gender</TableHead>
                  <TableHead>Appointments</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {patient.patientId}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-gray-900">
                      {patient.name}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="text-gray-900">{patient.phone}</p>
                        {patient.email && (
                          <p className="text-gray-500 text-xs">{patient.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {patient.dateOfBirth && (
                          <p className="text-gray-900">
                            {calculateAge(patient.dateOfBirth)} yrs
                          </p>
                        )}
                        {patient.gender && (
                          <p className="text-gray-500 text-xs">
                            {genderLabel[patient.gender] ?? patient.gender}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-700">
                        {patient._count.appointments}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(patient.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/patients/${patient.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
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
