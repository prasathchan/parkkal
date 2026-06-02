import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  organizationPatients,
  orgRoles,
  patients,
  emergencyContacts,
  appointments,
  treatments,
  prescriptions,
  invoices,
  invoiceTreatments,
  salaryRecords,
  visits,
  visitItems,
  payments,
  attachments,
  verificationTokens,
  featureFlags,
  users,
} from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { confirmName?: string };
  if (!body.confirmName) return NextResponse.json({ error: "Confirmation required" }, { status: 400 });

  const db = getDb();
  const orgId = session.orgId;

  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId));
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  if (body.confirmName.trim() !== org.name.trim()) {
    return NextResponse.json({ error: "Organization name does not match" }, { status: 400 });
  }

  // Collect all user IDs in this org
  const members = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, orgId));
  const userIds = members.map((m: { userId: string }) => m.userId);

  // Collect all patient IDs in this org
  const orgPatientRows = await db
    .select({ patientId: organizationPatients.patientId })
    .from(organizationPatients)
    .where(eq(organizationPatients.organizationId, orgId));
  const patientIds = orgPatientRows.map((r: { patientId: string }) => r.patientId);

  // Collect visit IDs for this org
  const orgVisits = await db
    .select({ id: visits.id })
    .from(visits)
    .where(eq(visits.organizationId, orgId));
  const visitIds = orgVisits.map((v: { id: string }) => v.id);

  // Collect invoice IDs for this org
  const orgInvoices = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.organizationId, orgId));
  const invoiceIds = orgInvoices.map((i: { id: string }) => i.id);

  // Delete in FK-safe order (leaves before roots)
  if (visitIds.length > 0) {
    await db.delete(payments).where(inArray(payments.visitId, visitIds));
    await db.delete(visitItems).where(inArray(visitItems.visitId, visitIds));
  }
  if (invoiceIds.length > 0) {
    await db.delete(invoiceTreatments).where(inArray(invoiceTreatments.invoiceId, invoiceIds));
  }

  await db.delete(visits).where(eq(visits.organizationId, orgId));
  await db.delete(invoices).where(eq(invoices.organizationId, orgId));
  await db.delete(appointments).where(eq(appointments.organizationId, orgId));
  await db.delete(treatments).where(eq(treatments.organizationId, orgId));
  await db.delete(prescriptions).where(eq(prescriptions.organizationId, orgId));
  await db.delete(salaryRecords).where(eq(salaryRecords.organizationId, orgId));
  if (visitIds.length > 0) {
    await db.delete(attachments).where(inArray(attachments.visitId, visitIds));
  }
  await db.delete(featureFlags).where(eq(featureFlags.orgId, orgId));

  if (patientIds.length > 0) {
    await db.delete(emergencyContacts).where(
      and(
        inArray(emergencyContacts.entityType, ["PATIENT"]),
        inArray(emergencyContacts.entityId, patientIds)
      )
    );
  }
  await db.delete(organizationPatients).where(eq(organizationPatients.organizationId, orgId));

  // Delete patients who belong only to this org
  if (patientIds.length > 0) {
    const sharedPatients = await db
      .select({ patientId: organizationPatients.patientId })
      .from(organizationPatients)
      .where(inArray(organizationPatients.patientId, patientIds));
    const sharedIds = new Set(sharedPatients.map((r: { patientId: string }) => r.patientId));
    const soloPatientIds = patientIds.filter(id => !sharedIds.has(id));
    if (soloPatientIds.length > 0) {
      await db.delete(patients).where(inArray(patients.id, soloPatientIds));
    }
  }

  await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgId));
  await db.delete(orgRoles).where(eq(orgRoles.organizationId, orgId));

  // Delete users who are not members of any other org, and clean their tokens
  if (userIds.length > 0) {
    const stillMembered = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(inArray(organizationMembers.userId, userIds));
    const stillMemberedIds = new Set(stillMembered.map((r: { userId: string }) => r.userId));
    const soloUserIds = userIds.filter(id => !stillMemberedIds.has(id));

    if (soloUserIds.length > 0) {
      await db.delete(verificationTokens).where(inArray(verificationTokens.userId, soloUserIds));
      await db.delete(users).where(inArray(users.id, soloUserIds));
    }
  }

  // Finally delete the org itself
  await db.delete(organizations).where(eq(organizations.id, orgId));

  return NextResponse.json({ deleted: true });
}
