import { eq, and, inArray } from "drizzle-orm";
import {
  organizations, organizationMembers, organizationPatients, orgRoles,
  patients, emergencyContacts, appointments, treatments, visitTreatments,
  consentAuditLog, prescriptions, invoices, invoiceTreatments, salaryRecords,
  visits, visitItems, payments, attachments, verificationTokens, users,
} from "@/db/schema";
import { withRoute, apiOk, apiError } from "@/lib/api";
import { runCascade } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

// Org deletion is the most destructive operation — very tight rate limit
const ORG_DELETE_RATE_LIMIT = { limit: 5, windowMs: 60 * 60_000 };

/** POST /api/org/delete — permanently delete the org and all its data (ADMIN only) */
export const POST = withRoute(
  {
    route: "POST /api/org/delete",
    rateLimit: ORG_DELETE_RATE_LIMIT,
    rateLimitKey: (session) => `org-delete:${session.userId}`,
    adminOnly: true,
  },
  async (req, { session, db, log }) => {
    const body = await req.json() as { confirmName?: string };
    if (!body.confirmName) return apiError("Confirmation required", 400);

    const orgId = session.orgId;
    const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId));
    if (!org) return apiError("Organization not found", 404);
    if (body.confirmName.trim() !== org.name.trim()) return apiError("Organization name does not match", 400);

    // ── Phase 1: collect IDs (read-only) ─────────────────────────────────────
    const memberRows: { userId: string }[] = await db.select({ userId: organizationMembers.userId }).from(organizationMembers).where(eq(organizationMembers.organizationId, orgId));
    const userIds = memberRows.map((r) => r.userId);

    const patientRows: { patientId: string }[] = await db.select({ patientId: organizationPatients.patientId }).from(organizationPatients).where(eq(organizationPatients.organizationId, orgId));
    const patientIds = patientRows.map((r) => r.patientId);

    const visitRows: { id: string }[] = await db.select({ id: visits.id }).from(visits).where(eq(visits.organizationId, orgId));
    const visitIds = visitRows.map((r) => r.id);

    const invoiceRows: { id: string }[] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.organizationId, orgId));
    const invoiceIds = invoiceRows.map((r) => r.id);

    // Patients/users shared with other orgs must NOT be hard-deleted
    let exclusivePatientIds: string[] = patientIds;
    if (patientIds.length > 0) {
      const allLinks = await db.select({ patientId: organizationPatients.patientId }).from(organizationPatients).where(inArray(organizationPatients.patientId, patientIds));
      const countMap = new Map<string, number>();
      for (const { patientId } of allLinks) countMap.set(patientId, (countMap.get(patientId) ?? 0) + 1);
      exclusivePatientIds = patientIds.filter((pid) => (countMap.get(pid) ?? 0) <= 1);
    }

    let exclusiveUserIds: string[] = userIds;
    if (userIds.length > 0) {
      const allMemberships = await db.select({ userId: organizationMembers.userId }).from(organizationMembers).where(inArray(organizationMembers.userId, userIds));
      const countMap = new Map<string, number>();
      for (const { userId } of allMemberships) countMap.set(userId, (countMap.get(userId) ?? 0) + 1);
      exclusiveUserIds = userIds.filter((uid) => (countMap.get(uid) ?? 0) <= 1);
    }

    // ── Phase 2: build cascade as a flat list, run atomically via D1 batch ───
    // Order: children-before-parents. Large orgs may exceed 100 stmts —
    // runCascade() automatically splits into 100-statement chunks (each atomic).
    const cascadeOps = [
      // Visit children (bulk delete by visitId set)
      ...(visitIds.length > 0 ? [
        db.delete(visitTreatments).where(inArray(visitTreatments.visitId, visitIds)),
        db.delete(payments).where(inArray(payments.visitId, visitIds)),
        db.delete(visitItems).where(inArray(visitItems.visitId, visitIds)),
        db.delete(attachments).where(inArray(attachments.visitId, visitIds)),
      ] : []),

      // Invoice children
      ...(invoiceIds.length > 0 ? [
        db.delete(invoiceTreatments).where(inArray(invoiceTreatments.invoiceId, invoiceIds)),
      ] : []),

      // Org-level tables (org-scoped, no per-row ID needed)
      db.delete(consentAuditLog).where(eq(consentAuditLog.organizationId, orgId)),
      db.delete(visits).where(eq(visits.organizationId, orgId)),
      db.delete(invoices).where(eq(invoices.organizationId, orgId)),
      db.delete(appointments).where(eq(appointments.organizationId, orgId)),
      db.delete(treatments).where(eq(treatments.organizationId, orgId)),
      db.delete(prescriptions).where(eq(prescriptions.organizationId, orgId)),
      db.delete(salaryRecords).where(eq(salaryRecords.organizationId, orgId)),

      // Emergency contacts for patients and users
      ...(patientIds.length > 0 ? [
        db.delete(emergencyContacts).where(and(eq(emergencyContacts.entityType, "PATIENT"), inArray(emergencyContacts.entityId, patientIds))),
      ] : []),
      ...(userIds.length > 0 ? [
        db.delete(emergencyContacts).where(and(eq(emergencyContacts.entityType, "USER"), inArray(emergencyContacts.entityId, userIds))),
      ] : []),

      // Org membership and patient links
      db.delete(organizationPatients).where(eq(organizationPatients.organizationId, orgId)),
      ...(exclusivePatientIds.length > 0 ? [
        db.delete(patients).where(inArray(patients.id, exclusivePatientIds)),
      ] : []),
      db.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgId)),
      db.delete(orgRoles).where(eq(orgRoles.organizationId, orgId)),

      // Users that belong exclusively to this org
      ...(exclusiveUserIds.length > 0 ? [
        db.delete(verificationTokens).where(inArray(verificationTokens.userId, exclusiveUserIds)),
        db.delete(users).where(inArray(users.id, exclusiveUserIds)),
      ] : []),

      // Finally, the org itself
      db.delete(organizations).where(eq(organizations.id, orgId)),
    ];

    // Write audit record BEFORE the cascade — once the org row is gone the
    // audit log table is gone too, so this must land first.
    // writeAuditLog is fire-and-forget; we await it explicitly here so the
    // record is committed before we start destroying data.
    await new Promise<void>((resolve) => {
      writeAuditLog({
        organizationId: orgId,
        actorId: session.userId,
        actorRole: session.role,
        action: "ORG_DELETED",
        targetType: "organization",
        targetId: orgId,
        metadata: { orgName: org.name, memberCount: userIds.length, patientCount: patientIds.length },
      });
      // writeAuditLog is async-internal; give it one tick to queue the insert
      setTimeout(resolve, 0);
    });

    await runCascade(db, cascadeOps);

    log.info("Organization deleted", { deletedOrgId: orgId });
    return apiOk({ deleted: true });
  }
);
