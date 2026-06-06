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
  visitTreatments,
  consentAuditLog,
  prescriptions,
  invoices,
  invoiceTreatments,
  salaryRecords,
  visits,
  visitItems,
  payments,
  attachments,
  verificationTokens,
  users,
} from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { confirmName?: string };
  if (!body.confirmName)
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });

  const db = getDb();
  const orgId = session.orgId;

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  if (body.confirmName.trim() !== org.name.trim()) {
    return NextResponse.json({ error: "Organization name does not match" }, { status: 400 });
  }

  // ── Phase 1: read-only ID collection (outside the transaction) ────────────
  // All reads happen here so Phase 2 (the transaction) contains pure writes.
  // D1's batch API sends the entire write phase atomically in one HTTP round-trip.

  const memberRows = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, orgId));
  const userIds = memberRows.map((r: { userId: string }) => r.userId);

  const patientRows = await db
    .select({ patientId: organizationPatients.patientId })
    .from(organizationPatients)
    .where(eq(organizationPatients.organizationId, orgId));
  const patientIds = patientRows.map((r: { patientId: string }) => r.patientId);

  const visitRows = await db
    .select({ id: visits.id })
    .from(visits)
    .where(eq(visits.organizationId, orgId));
  const visitIds = visitRows.map((r: { id: string }) => r.id);

  const invoiceRows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.organizationId, orgId));
  const invoiceIds = invoiceRows.map((r: { id: string }) => r.id);

  // Patients linked to more than one org must not be hard-deleted.
  let exclusivePatientIds: string[] = patientIds;
  if (patientIds.length > 0) {
    const allPatientLinks = await db
      .select({ patientId: organizationPatients.patientId })
      .from(organizationPatients)
      .where(inArray(organizationPatients.patientId, patientIds));
    const linkCount = new Map<string, number>();
    for (const { patientId } of allPatientLinks) {
      linkCount.set(patientId, (linkCount.get(patientId) ?? 0) + 1);
    }
    exclusivePatientIds = patientIds.filter((pid: string) => (linkCount.get(pid) ?? 0) <= 1);
  }

  // Users who are members of another org must not be hard-deleted.
  let exclusiveUserIds: string[] = userIds;
  if (userIds.length > 0) {
    const allUserMemberships = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(inArray(organizationMembers.userId, userIds));
    const membershipCount = new Map<string, number>();
    for (const { userId } of allUserMemberships) {
      membershipCount.set(userId, (membershipCount.get(userId) ?? 0) + 1);
    }
    exclusiveUserIds = userIds.filter((uid: string) => (membershipCount.get(uid) ?? 0) <= 1);
  }

  // ── Phase 2: cascade delete (sequential — avoids D1 transaction batch API limitations) ──
  if (visitIds.length > 0) {
    await db.delete(visitTreatments).where(inArray(visitTreatments.visitId, visitIds));
    await db.delete(payments).where(inArray(payments.visitId, visitIds));
    await db.delete(visitItems).where(inArray(visitItems.visitId, visitIds));
    await db.delete(attachments).where(inArray(attachments.visitId, visitIds));
  }
  if (invoiceIds.length > 0) {
    await db.delete(invoiceTreatments).where(inArray(invoiceTreatments.invoiceId, invoiceIds));
  }

  await db.delete(consentAuditLog).where(eq(consentAuditLog.organizationId, orgId));
  await db.delete(visits).where(eq(visits.organizationId, orgId));
  await db.delete(invoices).where(eq(invoices.organizationId, orgId));
  await db.delete(appointments).where(eq(appointments.organizationId, orgId));
  await db.delete(treatments).where(eq(treatments.organizationId, orgId));
  await db.delete(prescriptions).where(eq(prescriptions.organizationId, orgId));
  await db.delete(salaryRecords).where(eq(salaryRecords.organizationId, orgId));

  if (patientIds.length > 0) {
    await db.delete(emergencyContacts).where(
      and(eq(emergencyContacts.entityType, "PATIENT"), inArray(emergencyContacts.entityId, patientIds))
    );
  }
  if (userIds.length > 0) {
    await db.delete(emergencyContacts).where(
      and(eq(emergencyContacts.entityType, "USER"), inArray(emergencyContacts.entityId, userIds))
    );
  }

  await db.delete(organizationPatients).where(eq(organizationPatients.organizationId, orgId));

  if (exclusivePatientIds.length > 0) {
    await db.delete(patients).where(inArray(patients.id, exclusivePatientIds));
  }

  await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgId));
  await db.delete(orgRoles).where(eq(orgRoles.organizationId, orgId));

  if (exclusiveUserIds.length > 0) {
    await db.delete(verificationTokens).where(inArray(verificationTokens.userId, exclusiveUserIds));
    await db.delete(users).where(inArray(users.id, exclusiveUserIds));
  }

  await db.delete(organizations).where(eq(organizations.id, orgId));

  return NextResponse.json({ deleted: true });
}
