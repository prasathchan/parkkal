/**
 * POST /api/internal/seed-demo
 *
 * Inserts a realistic demo dataset into the database:
 *   1 org · 3 staff (admin / doctor / receptionist) · 10 patients
 *   20 visits · 15 treatments · 30 appointments
 *
 * Security gates:
 *   - Requires X-Internal-Key header matching INTERNAL_API_KEY env var
 *   - Disabled in production (NODE_ENV === "production")
 *   - Idempotent: skips seed if demo org already exists (slug "demo-clinic")
 */
import { eq } from "drizzle-orm";
import {
  organizations, users, organizationMembers, organizationPatients,
  patients, visits, visitItems, payments, appointments, treatments,
  patientCodeSequences,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import { hashPassword } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

const DEMO_SLUG = "demo-clinic";

function days(n: number) { return Date.now() - n * 86_400_000; }
function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const PATIENT_NAMES = [
  "Arun Kumar", "Priya Sharma", "Rajesh Patel", "Meena Iyer", "Suresh Pillai",
  "Anitha Nair", "Karthik Rajan", "Deepa Menon", "Vijay Krishnan", "Lakshmi Devi",
];
const PHONES = [
  "9876543210", "9123456789", "8765432109", "9988776655", "7654321098",
  "8899001122", "9900112233", "7788990011", "8877665544", "9966554433",
];
const CHIEF_COMPLAINTS = [
  "Toothache upper left", "Routine checkup", "Bleeding gums", "Broken tooth",
  "Sensitivity to cold", "Jaw pain", "Tooth extraction request", "Cavity filling needed",
  "Scaling and polishing", "Root canal consultation",
];
const PROCEDURES = [
  "Tooth Extraction", "Root Canal Treatment", "Scaling & Polishing", "Composite Filling",
  "Crown Placement", "Whitening Treatment", "Dental Implant Consultation",
];
const APPT_NOTES = [
  "Follow-up for root canal", "New patient evaluation", "Post-extraction review",
  "Crown fitting", "Orthodontic consultation", "Wisdom tooth assessment",
];

export async function POST(req: NextRequest) {
  // Production guard
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seed disabled in production" }, { status: 403 });
  }

  // Auth gate
  const key = req.headers.get("x-internal-key");
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (!expectedKey || key !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getCloudflareContext({ async: true });
  const db = getDb((ctx.env as unknown) as { DB: D1Database });

  // Idempotency check
  const existing = await db.select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, DEMO_SLUG))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ message: "Demo data already seeded", orgId: existing[0].id });
  }

  const now = Date.now();
  const orgId = generateId();
  const adminId = generateId();
  const doctorId = generateId();
  const receptionistId = generateId();
  const pwHash = await hashPassword("Demo@1234");

  // ── 1. Organisation ────────────────────────────────────────────────────────
  await db.insert(organizations).values({
    id: orgId,
    name: "Parkkal Demo Clinic",
    slug: DEMO_SLUG,
    tagline: "A healthy smile, always",
    address: "12, Anna Salai, Chennai, TN 600002",
    phone: "04423456789",
    email: "demo@parkkal.app",
    isActive: 1,
    onboardingDismissedAt: now,
    dataRetentionYears: 7,
    timezone: "Asia/Kolkata",
    createdAt: days(60),
    updatedAt: now,
  });

  // ── 2. Staff users ─────────────────────────────────────────────────────────
  const staffRows = [
    { id: adminId,        name: "Dr. Admin",       email: "admin@demo.parkkal.app",        role: "ADMIN",        isDoctor: 0 },
    { id: doctorId,       name: "Dr. Kavitha Nair", email: "doctor@demo.parkkal.app",      role: "DOCTOR",       isDoctor: 1 },
    { id: receptionistId, name: "Ramesh Kumar",     email: "reception@demo.parkkal.app",   role: "RECEPTIONIST", isDoctor: 0 },
  ] as const;

  for (const s of staffRows) {
    await db.insert(users).values({
      id: s.id, name: s.name, email: s.email,
      passwordHash: pwHash, isActive: 1, isVerified: 1, isSuperAdmin: 0,
      createdAt: days(60), updatedAt: now,
    });
    await db.insert(organizationMembers).values({
      id: generateId(), organizationId: orgId, userId: s.id,
      role: s.role as "ADMIN" | "DOCTOR" | "RECEPTIONIST",
      salaryType: "FIXED", salaryAmount: 50000,
      isActive: 1, isDoctor: s.isDoctor, portalAccess: 0,
      createdAt: days(60),
    });
  }

  // ── 3. Patients ────────────────────────────────────────────────────────────
  // Reserve 10 sequence slots
  const [globalRow, orgRow] = await Promise.all([
    db.insert(patientCodeSequences)
      .values({ scope: "global", lastSeq: 10, updatedAt: now })
      .onConflictDoUpdate({ target: patientCodeSequences.scope, set: { lastSeq: 10, updatedAt: now } })
      .returning({ lastSeq: patientCodeSequences.lastSeq }),
    db.insert(patientCodeSequences)
      .values({ scope: `org:${DEMO_SLUG}`, lastSeq: 10, updatedAt: now })
      .onConflictDoUpdate({ target: patientCodeSequences.scope, set: { lastSeq: 10, updatedAt: now } })
      .returning({ lastSeq: patientCodeSequences.lastSeq }),
  ]);

  const gStart = Number(globalRow[0].lastSeq) - 9;
  const oStart = Number(orgRow[0].lastSeq) - 9;

  const patientIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const pid = generateId();
    patientIds.push(pid);
    const globalCode = `PKL-${String(gStart + i).padStart(6, "0")}`;
    const orgCode    = `DEM-${String(oStart + i).padStart(4, "0")}`;

    await db.insert(patients).values({
      id: pid, patientCode: globalCode,
      name: PATIENT_NAMES[i], phone: PHONES[i],
      email: `patient${i + 1}@example.com`,
      dateOfBirth: `${1970 + i * 3}-0${(i % 9) + 1}-15`,
      gender: i % 2 === 0 ? "MALE" : "FEMALE",
      bloodGroup: rand(["A+", "B+", "O+", "AB+"]),
      medicalHistory: i % 3 === 0 ? "Diabetic — insulin-dependent" : null,
      panNumber: null, aadhaarNumber: null,
      emergencyContactAdded: 0, referralSource: null, referredByPatientId: null,
      dataConsentAt: days(30 - i), dataConsentIp: "127.0.0.1",
      createdAt: days(30 - i), updatedAt: now,
    });

    await db.insert(organizationPatients).values({
      id: generateId(), organizationId: orgId, patientId: pid,
      patientCode: orgCode, registeredAt: days(30 - i), isActive: 1,
    });
  }

  // ── 4. Visits (20) ─────────────────────────────────────────────────────────
  const visitIds: string[] = [];
  for (let i = 0; i < 20; i++) {
    const vid = generateId();
    visitIds.push(vid);
    const patientId = patientIds[i % 10];
    const totalAmt = randInt(500, 8000);
    const paidAmt  = i % 4 === 0 ? 0 : i % 4 === 1 ? Math.floor(totalAmt / 2) : totalAmt;
    const visitDate = new Date(days(20 - i));
    const visitDateStr = visitDate.toLocaleDateString("en-CA");

    await db.insert(visits).values({
      id: vid,
      visitCode: `V${String(i + 1).padStart(5, "0")}`,
      organizationId: orgId,
      patientId,
      doctorId,
      visitDate: visitDateStr,
      visitType: i % 3 === 0 ? "WALKIN" : "APPOINTMENT",
      status: i < 16 ? "COMPLETED" : "OPEN",
      chiefComplaint: CHIEF_COMPLAINTS[i % CHIEF_COMPLAINTS.length],
      doctorNotes: i % 2 === 0 ? "Patient responded well to treatment." : null,
      totalAmount: totalAmt,
      paidAmount: paidAmt,
      balanceDue: totalAmt - paidAmt,
      billingStatus: paidAmt >= totalAmt ? "PAID" : paidAmt > 0 ? "PARTIAL" : "UNPAID",
      createdAt: days(20 - i),
      updatedAt: now,
    });

    // Add a visit item
    await db.insert(visitItems).values({
      id: generateId(),
      visitId: vid,
      organizationId: orgId,
      itemName: rand(PROCEDURES),
      category: "PROCEDURE",
      quantity: 1,
      unitPrice: totalAmt,
      totalPrice: totalAmt,
      createdAt: days(20 - i),
      updatedAt: now,
    });

    // Add payment if paid
    if (paidAmt > 0) {
      await db.insert(payments).values({
        id: generateId(),
        visitId: vid,
        organizationId: orgId,
        amount: paidAmt,
        paymentMethod: rand(["CASH", "UPI", "CARD"]),
        notes: null,
        referenceNumber: null,
        paidAt: days(20 - i),
        createdAt: days(20 - i),
      });
    }
  }

  // ── 5. Treatments (15) ─────────────────────────────────────────────────────
  for (let i = 0; i < 15; i++) {
    await db.insert(treatments).values({
      id: generateId(),
      organizationId: orgId,
      patientId: patientIds[i % 10],
      visitId: visitIds[i % 20],
      doctorId,
      description: rand(PROCEDURES),
      procedure: rand(PROCEDURES),
      toothNumber: String(randInt(11, 48)),
      status: rand(["PLANNED", "IN_PROGRESS", "COMPLETED"]),
      cost: randInt(1000, 6000),
      notes: null,
      consentStatus: "NOT_REQUIRED",
      plannedSessions: null,
      completedSessions: 0,
      createdAt: days(15 - i),
      updatedAt: now,
    });
  }

  // ── 6. Appointments (30) ───────────────────────────────────────────────────
  const apptStatuses = ["COMPLETED", "COMPLETED", "COMPLETED", "SCHEDULED", "NO_SHOW"];
  for (let i = 0; i < 30; i++) {
    const apptDate = new Date(days(15 - i));
    const apptDateStr = apptDate.toLocaleDateString("en-CA");
    const hour = 9 + (i % 8);
    const apptTime = `${String(hour).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`;

    await db.insert(appointments).values({
      id: generateId(),
      organizationId: orgId,
      patientId: patientIds[i % 10],
      doctorId,
      appointmentDate: apptDateStr,
      appointmentTime: apptTime,
      durationMinutes: 30,
      type: rand(["CHECKUP", "FOLLOWUP", "PROCEDURE"]),
      status: rand(apptStatuses),
      notes: rand(APPT_NOTES),
      visitId: i < 20 ? visitIds[i % 20] : null,
      remindersScheduled: 0,
      createdAt: days(20 - i),
      updatedAt: now,
    });
  }

  return NextResponse.json({
    message: "Demo data seeded successfully",
    orgId,
    credentials: {
      admin:        { email: "admin@demo.parkkal.app",       password: "Demo@1234" },
      doctor:       { email: "doctor@demo.parkkal.app",      password: "Demo@1234" },
      receptionist: { email: "reception@demo.parkkal.app",   password: "Demo@1234" },
    },
    counts: { patients: 10, visits: 20, treatments: 15, appointments: 30 },
  });
}
