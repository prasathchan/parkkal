import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createAppointmentSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  doctorId: z.string().min(1, "Doctor is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  type: z.enum(["CONSULTATION", "CHECKUP", "TREATMENT", "FOLLOWUP"]),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const appointments = await prisma.appointment.findMany({
    where: status ? { status: status as "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" } : undefined,
    orderBy: [{ date: "desc" }, { time: "asc" }],
    include: {
      patient: { select: { name: true, patientId: true } },
      doctor: { select: { name: true } },
    },
  });

  return NextResponse.json({ appointments });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createAppointmentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { patientId, doctorId, date, time, type, notes } = parsed.data;

  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      doctorId,
      date: new Date(date),
      time,
      type,
      notes: notes || undefined,
      status: "SCHEDULED",
    },
  });

  return NextResponse.json({ appointment }, { status: 201 });
}
