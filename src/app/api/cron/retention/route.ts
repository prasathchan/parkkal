/**
 * GET /api/cron/retention
 *
 * Daily data-retention purge job.
 * Runs at 02:00 UTC via Cloudflare Workers Cron Triggers (see wrangler.toml).
 *
 * ─── WHAT IT DOES ────────────────────────────────────────────────────────────
 *
 *   For each organisation that has set a dataRetentionYears policy:
 *   - Finds patients whose last visit is older than the policy window
 *     (or patients who were registered but never visited, if registration
 *     is also beyond the window).
 *   - Cascade-deletes all clinical data for those patients:
 *       prescriptions, visit items, payments, attachments, visit treatments,
 *       visits, treatments, appointments + reminders, invoices,
 *       emergency contacts, organisation-patient links, and finally patients.
 *   - Writes an audit log entry so the deletion is traceable.
 *
 * ─── SAFETY ──────────────────────────────────────────────────────────────────
 *
 *   - Processes at most BATCH_LIMIT patients per run to stay within D1/CPU limits.
 *     If more patients are eligible, subsequent daily runs clear the remainder.
 *   - Never deletes users (staff accounts) — only patient records.
 *   - Skips orgs with no dataRetentionYears set (uses their default of 7 years
 *     configured in the schema).
 *
 * ─── SECURITY ────────────────────────────────────────────────────────────────
 *
 *   - Requires  Authorization: Bearer <CRON_SECRET>
 *     OR Cloudflare cron delivery (x-cloudflare-cron header present).
 *
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, lt, inArray, sql } from "drizzle-orm";
import {
  organizations,
  patients,
  organizationPatients,
  emergencyContacts,
  visits,
  visitItems,
  visitTreatments,
  payments,
  attachments,
  prescriptions,
  treatments,
  appointments,
  appointmentReminders,
  invoices,
  invoiceTreatments,
  adminAuditLog,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";

const BATCH_LIMIT = 20; // patients per run (cascade per patient is many statements)

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  // x-cloudflare-cron is spoofable; verifyCronAuth only trusts it for requests
  // that did not traverse the public edge (no cf-connecting-ip).
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  const db  = getDb();
  const now = Date.now();

  // ── Load orgs with a retention policy ────────────────────────────────────
  const orgs = await db
    .select({ id: organizations.id, dataRetentionYears: organizations.dataRetentionYears })
    .from(organizations)
    .where(sql`${organizations.dataRetentionYears} IS NOT NULL`);

  let totalPurged = 0;
  const errors: string[] = [];

  for (const org of orgs) {
    const retentionMs = (org.dataRetentionYears ?? 7) * 365.25 * 24 * 60 * 60 * 1000;
    const cutoffMs    = now - retentionMs;

    try {
      // Find patients in this org whose most-recent visit predates the cutoff
      // (or who have no visits and were registered before the cutoff).
      // We do a subquery via raw SQL to find max(visit date) per patient.
      const eligible = await db
        .select({ patientId: organizationPatients.patientId })
        .from(organizationPatients)
        .innerJoin(patients, eq(organizationPatients.patientId, patients.id))
        .where(
          and(
            eq(organizationPatients.organizationId, org.id),
            lt(patients.createdAt, cutoffMs),
          )
        )
        .limit(BATCH_LIMIT);

      if (eligible.length === 0) continue;

      const patientIds = eligible.map((r: { patientId: string }) => r.patientId);

      // Exclude patients who have a visit more recent than the cutoff.
      const recentVisitRows = await db
        .select({ patientId: visits.patientId })
        .from(visits)
        .where(
          and(
            eq(visits.organizationId, org.id),
            inArray(visits.patientId, patientIds),
            sql`${visits.visitDate} >= ${new Date(cutoffMs).toISOString().slice(0, 10)}`,
          )
        );

      const excludeSet = new Set(recentVisitRows.map((r: { patientId: string }) => r.patientId));
      const toPurge = patientIds.filter((id: string) => !excludeSet.has(id));

      if (toPurge.length === 0) continue;

      // ── Cascade delete (order matters: children before parents) ───────────
      for (const patientId of toPurge) {
        // 1. Prescriptions
        await db.delete(prescriptions).where(
          and(eq(prescriptions.patientId, patientId), eq(prescriptions.organizationId, org.id))
        );

        // 2. Visit items, visit treatments, payments, attachments
        const patientVisits = await db
          .select({ id: visits.id })
          .from(visits)
          .where(and(eq(visits.patientId, patientId), eq(visits.organizationId, org.id)));
        const visitIds = patientVisits.map((v: { id: string }) => v.id);

        if (visitIds.length > 0) {
          await db.delete(visitItems).where(inArray(visitItems.visitId, visitIds));
          await db.delete(visitTreatments).where(inArray(visitTreatments.visitId, visitIds));
          await db.delete(payments).where(inArray(payments.visitId, visitIds));
          await db.delete(attachments).where(inArray(attachments.visitId, visitIds));
        }

        // 3. Visits
        await db.delete(visits).where(
          and(eq(visits.patientId, patientId), eq(visits.organizationId, org.id))
        );

        // 4. Treatment plans
        await db.delete(treatments).where(
          and(eq(treatments.patientId, patientId), eq(treatments.organizationId, org.id))
        );

        // 5. Invoice treatments + invoices
        const patientInvoices = await db
          .select({ id: invoices.id })
          .from(invoices)
          .where(and(eq(invoices.patientId, patientId), eq(invoices.organizationId, org.id)));
        const invoiceIds = patientInvoices.map((i: { id: string }) => i.id);

        if (invoiceIds.length > 0) {
          await db.delete(invoiceTreatments).where(inArray(invoiceTreatments.invoiceId, invoiceIds));
          await db.delete(invoices).where(inArray(invoices.id, invoiceIds));
        }

        // 6. Appointments + reminders
        const patientAppts = await db
          .select({ id: appointments.id })
          .from(appointments)
          .where(and(eq(appointments.patientId, patientId), eq(appointments.organizationId, org.id)));
        const apptIds = patientAppts.map((a: { id: string }) => a.id);

        if (apptIds.length > 0) {
          await db.delete(appointmentReminders).where(inArray(appointmentReminders.appointmentId, apptIds));
          await db.delete(appointments).where(inArray(appointments.id, apptIds));
        }

        // 7. Emergency contacts (uses entityId — shared with users)
        await db.delete(emergencyContacts).where(
          and(eq(emergencyContacts.entityId, patientId), eq(emergencyContacts.entityType, "PATIENT"))
        );

        // 8. Org-patient link
        await db.delete(organizationPatients).where(
          and(
            eq(organizationPatients.patientId, patientId),
            eq(organizationPatients.organizationId, org.id),
          )
        );

        // 9. Patient row (only if no other orgs reference them — they share patients table)
        const otherLinks = await db
          .select({ patientId: organizationPatients.patientId })
          .from(organizationPatients)
          .where(eq(organizationPatients.patientId, patientId))
          .limit(1) as { patientId: string }[];

        if (otherLinks.length === 0) {
          await db.delete(patients).where(eq(patients.id, patientId));
        }

        totalPurged++;
      }

      // ── Audit log entry for this org's purge ─────────────────────────────
      if (toPurge.length > 0) {
        await db.insert(adminAuditLog).values({
          id: crypto.randomUUID(),
          organizationId: org.id,
          actorId: "cron",
          actorRole: "system",
          action: "DATA_RETENTION_PURGE",
          targetType: "patient",
          targetId: null,
          metadata: JSON.stringify({
            purgedCount: toPurge.length,
            retentionYears: org.dataRetentionYears,
            cutoffDate: new Date(cutoffMs).toISOString().slice(0, 10),
          }),
          createdAt: now,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`org ${org.id}: ${msg}`);
    }
  }

  return NextResponse.json({
    purged: totalPurged,
    errors: errors.length > 0 ? errors : undefined,
    message: `Data retention run complete. ${totalPurged} patient(s) purged.`,
  });
}
