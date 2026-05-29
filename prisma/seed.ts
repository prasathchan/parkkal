import { PrismaClient, Role, Gender } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@parkkal.com" },
    update: {},
    create: {
      name: "Dr. Admin",
      email: "admin@parkkal.com",
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  // Create a doctor
  const doctorPassword = await bcrypt.hash("doctor123", 12);
  const doctor = await prisma.user.upsert({
    where: { email: "doctor@parkkal.com" },
    update: {},
    create: {
      name: "Dr. Priya Sharma",
      email: "doctor@parkkal.com",
      password: doctorPassword,
      role: Role.DOCTOR,
    },
  });

  // Create a receptionist
  const receptionistPassword = await bcrypt.hash("reception123", 12);
  await prisma.user.upsert({
    where: { email: "reception@parkkal.com" },
    update: {},
    create: {
      name: "Meera Nair",
      email: "reception@parkkal.com",
      password: receptionistPassword,
      role: Role.RECEPTIONIST,
    },
  });

  // Create sample patients
  const patient1 = await prisma.patient.upsert({
    where: { patientId: "PKL-001" },
    update: {},
    create: {
      patientId: "PKL-001",
      name: "Ravi Kumar",
      phone: "9876543210",
      email: "ravi@example.com",
      dateOfBirth: new Date("1985-06-15"),
      gender: Gender.MALE,
      address: "123 Main Street, Chennai",
      medicalHistory: "Hypertension",
    },
  });

  const patient2 = await prisma.patient.upsert({
    where: { patientId: "PKL-002" },
    update: {},
    create: {
      patientId: "PKL-002",
      name: "Lakshmi Devi",
      phone: "9876543211",
      email: "lakshmi@example.com",
      dateOfBirth: new Date("1990-03-22"),
      gender: Gender.FEMALE,
      address: "456 Park Avenue, Chennai",
      medicalHistory: "No known allergies",
    },
  });

  // Create sample appointments
  const today = new Date();
  const appointment1 = await prisma.appointment.create({
    data: {
      patientId: patient1.id,
      doctorId: doctor.id,
      date: today,
      time: "10:00",
      status: "SCHEDULED",
      type: "CHECKUP",
      notes: "Regular dental checkup",
    },
  });

  await prisma.appointment.create({
    data: {
      patientId: patient2.id,
      doctorId: doctor.id,
      date: today,
      time: "11:00",
      status: "SCHEDULED",
      type: "CONSULTATION",
      notes: "Tooth pain consultation",
    },
  });

  // Create sample treatment
  const treatment = await prisma.treatment.create({
    data: {
      patientId: patient1.id,
      appointmentId: appointment1.id,
      doctorId: doctor.id,
      description: "Dental filling on upper molar",
      toothNumber: "16",
      procedure: "Composite Filling",
      cost: 1500,
    },
  });

  // Create sample invoice
  await prisma.invoice.create({
    data: {
      patientId: patient1.id,
      totalAmount: 1500,
      paidAmount: 0,
      status: "PENDING",
      treatments: {
        connect: [{ id: treatment.id }],
      },
    },
  });

  console.log("Seeding complete!");
  console.log("Login credentials:");
  console.log("  Admin: admin@parkkal.com / admin123");
  console.log("  Doctor: doctor@parkkal.com / doctor123");
  console.log("  Receptionist: reception@parkkal.com / reception123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
