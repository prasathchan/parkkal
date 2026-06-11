/**
 * lib/backup-engine.ts
 *
 * Core snapshot and restore logic used by both the API routes and the nightly cron.
 *
 * Snapshot format (stored as gzipped JSON):
 *   { version: 1, orgId, createdAt, tables: { patients: [...], visits: [...], ... } }
 *
 * Restore strategy: overwrite.
 *   All covered tables for the org are cleared (in FK-safe order) and
 *   re-inserted from the snapshot.
 */

import { eq, and, inArray, gte } from "drizzle-orm";
import { gzip, gunzip } from "zlib";
import { promisify } from "util";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { storeBackup, getBackup, deleteBackup } from "@/lib/backup-storage";
import { writeAuditLog } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit";

const gzipAsync   = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export const SNAPSHOT_VERSION = 1;

export interface SnapshotPayload {
  version: number;
  orgId: string;
  createdAt: number;
  tables: Record<string, unknown[]>;
}

type DB = DrizzleD1Database<typeof schema>;

// ── Create a snapshot ─────────────────────────────────────────────────────────

export async function createSnapshot(
  db: DB,
  orgId: string,
  type: "auto" | "manual",
  createdBy: string | null,
): Promise<string> {
  const id  = crypto.randomUUID();
  const now = Date.now();
  const timestamp = new Date(now).toISOString().replace(/[:.]/g, "-");
  const r2Key = `backups/${orgId}/${timestamp}_${type}.json.gz`;

  await db.insert(schema.orgBackups).values({
    id, organizationId: orgId, type, status: "pending", createdBy, createdAt: now,
  });

  try {
    // Get all visit IDs and appointment IDs for join-based tables
    const visitRows  = await db.select({ id: schema.visits.id }).from(schema.visits).where(eq(schema.visits.organizationId, orgId));
    const visitIds   = visitRows.map((v) => v.id);
    const apptRows   = await db.select({ id: schema.appointments.id }).from(schema.appointments).where(eq(schema.appointments.organizationId, orgId));
    const apptIds    = apptRows.map((a) => a.id);
    const invoiceRows = await db.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.organizationId, orgId));
    const invoiceIds  = invoiceRows.map((i) => i.id);
    const orgPatRows  = await db.select({ patientId: schema.organizationPatients.patientId }).from(schema.organizationPatients).where(eq(schema.organizationPatients.organizationId, orgId));
    const patientIds  = orgPatRows.map((p) => p.patientId);

    const [
      patientData, orgPatientData, emergencyContactData,
      orgRoleData, memberData,
      apptData, reminderData,
      visitData, visitItemData, visitTreatmentData, paymentData, attachmentData, prescriptionData,
      treatmentData, invoiceData, invoiceTreatmentData,
      salaryData, toothChartData, consentAuditData,
    ] = await Promise.all([
      patientIds.length  ? db.select().from(schema.patients).where(inArray(schema.patients.id, patientIds)) : [],
      db.select().from(schema.organizationPatients).where(eq(schema.organizationPatients.organizationId, orgId)),
      patientIds.length  ? db.select().from(schema.emergencyContacts).where(and(inArray(schema.emergencyContacts.entityId, patientIds), eq(schema.emergencyContacts.entityType, "PATIENT"))) : [],
      db.select().from(schema.orgRoles).where(eq(schema.orgRoles.organizationId, orgId)),
      db.select().from(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, orgId)),
      db.select().from(schema.appointments).where(eq(schema.appointments.organizationId, orgId)),
      apptIds.length     ? db.select().from(schema.appointmentReminders).where(inArray(schema.appointmentReminders.appointmentId, apptIds)) : [],
      db.select().from(schema.visits).where(eq(schema.visits.organizationId, orgId)),
      visitIds.length    ? db.select().from(schema.visitItems).where(inArray(schema.visitItems.visitId, visitIds)) : [],
      visitIds.length    ? db.select().from(schema.visitTreatments).where(inArray(schema.visitTreatments.visitId, visitIds)) : [],
      visitIds.length    ? db.select().from(schema.payments).where(inArray(schema.payments.visitId, visitIds)) : [],
      visitIds.length    ? db.select().from(schema.attachments).where(inArray(schema.attachments.visitId, visitIds)) : [],
      visitIds.length    ? db.select().from(schema.prescriptions).where(inArray(schema.prescriptions.visitId, visitIds)) : [],
      db.select().from(schema.treatments).where(eq(schema.treatments.organizationId, orgId)),
      db.select().from(schema.invoices).where(eq(schema.invoices.organizationId, orgId)),
      invoiceIds.length  ? db.select().from(schema.invoiceTreatments).where(inArray(schema.invoiceTreatments.invoiceId, invoiceIds)) : [],
      db.select().from(schema.salaryRecords).where(eq(schema.salaryRecords.organizationId, orgId)),
      db.select().from(schema.toothChart).where(eq(schema.toothChart.organizationId, orgId)),
      db.select().from(schema.consentAuditLog).where(eq(schema.consentAuditLog.organizationId, orgId)),
    ]);

    const tables: Record<string, unknown[]> = {
      patients: patientData, organizationPatients: orgPatientData,
      emergencyContacts: emergencyContactData, orgRoles: orgRoleData,
      organizationMembers: memberData, appointments: apptData,
      appointmentReminders: reminderData, visits: visitData,
      visitItems: visitItemData, visitTreatments: visitTreatmentData,
      payments: paymentData, attachments: attachmentData,
      prescriptions: prescriptionData, treatments: treatmentData,
      invoices: invoiceData, invoiceTreatments: invoiceTreatmentData,
      salaryRecords: salaryData, toothChart: toothChartData,
      consentAuditLog: consentAuditData,
    };

    const rowCounts: Record<string, number> = {};
    for (const [k, v] of Object.entries(tables)) rowCounts[k] = v.length;

    const payload: SnapshotPayload = { version: SNAPSHOT_VERSION, orgId, createdAt: now, tables };
    const compressed = await gzipAsync(Buffer.from(JSON.stringify(payload), "utf8"));

    await storeBackup(r2Key, new Uint8Array(compressed));

    await db.update(schema.orgBackups).set({
      status: "completed", r2Key,
      sizeBytes: compressed.length,
      rowCounts: JSON.stringify(rowCounts),
    }).where(eq(schema.orgBackups.id, id));

    await pruneSnapshots(db, orgId);
    return id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(schema.orgBackups).set({ status: "failed", errorMessage: msg.slice(0, 500) })
      .where(eq(schema.orgBackups.id, id));
    throw err;
  }
}

// ── Restore from a snapshot ───────────────────────────────────────────────────

export async function restoreSnapshot(
  db: DB,
  snapshotId: string,
  orgId: string,
  restoredBy: string,
): Promise<void> {
  const [snap] = await db.select().from(schema.orgBackups)
    .where(and(eq(schema.orgBackups.id, snapshotId), eq(schema.orgBackups.organizationId, orgId)));

  if (!snap || snap.status !== "completed" || !snap.r2Key) {
    throw new Error("Snapshot not found or not ready");
  }

  const compressed = await getBackup(snap.r2Key);
  if (!compressed) throw new Error("Snapshot file missing from storage");

  const json    = (await gunzipAsync(Buffer.from(compressed))).toString("utf8");
  const payload = JSON.parse(json) as SnapshotPayload;
  if (payload.orgId !== orgId) throw new Error("Snapshot belongs to a different organisation");

  // Collect IDs needed for child-table deletes
  const visitRows    = await db.select({ id: schema.visits.id }).from(schema.visits).where(eq(schema.visits.organizationId, orgId));
  const visitIds     = visitRows.map((v) => v.id);
  const apptRows     = await db.select({ id: schema.appointments.id }).from(schema.appointments).where(eq(schema.appointments.organizationId, orgId));
  const apptIds      = apptRows.map((a) => a.id);
  const invoiceRows  = await db.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.organizationId, orgId));
  const invoiceIds   = invoiceRows.map((i) => i.id);
  const orgPatRows   = await db.select({ patientId: schema.organizationPatients.patientId }).from(schema.organizationPatients).where(eq(schema.organizationPatients.organizationId, orgId));
  const patientIds   = orgPatRows.map((p) => p.patientId);

  // Delete in reverse FK order (children first)
  if (patientIds.length)  await db.delete(schema.consentAuditLog).where(eq(schema.consentAuditLog.organizationId, orgId));
  await db.delete(schema.toothChart).where(eq(schema.toothChart.organizationId, orgId));
  await db.delete(schema.salaryRecords).where(eq(schema.salaryRecords.organizationId, orgId));
  if (invoiceIds.length)  await db.delete(schema.invoiceTreatments).where(inArray(schema.invoiceTreatments.invoiceId, invoiceIds));
  await db.delete(schema.invoices).where(eq(schema.invoices.organizationId, orgId));
  if (visitIds.length) {
    await db.delete(schema.prescriptions).where(inArray(schema.prescriptions.visitId, visitIds));
    await db.delete(schema.attachments).where(inArray(schema.attachments.visitId, visitIds));
    await db.delete(schema.payments).where(inArray(schema.payments.visitId, visitIds));
    await db.delete(schema.visitTreatments).where(inArray(schema.visitTreatments.visitId, visitIds));
    await db.delete(schema.visitItems).where(inArray(schema.visitItems.visitId, visitIds));
  }
  await db.delete(schema.treatments).where(eq(schema.treatments.organizationId, orgId));
  await db.delete(schema.visits).where(eq(schema.visits.organizationId, orgId));
  if (apptIds.length)     await db.delete(schema.appointmentReminders).where(inArray(schema.appointmentReminders.appointmentId, apptIds));
  await db.delete(schema.appointments).where(eq(schema.appointments.organizationId, orgId));
  await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, orgId));
  await db.delete(schema.orgRoles).where(eq(schema.orgRoles.organizationId, orgId));
  if (patientIds.length)  await db.delete(schema.emergencyContacts).where(and(inArray(schema.emergencyContacts.entityId, patientIds), eq(schema.emergencyContacts.entityType, "PATIENT")));
  await db.delete(schema.organizationPatients).where(eq(schema.organizationPatients.organizationId, orgId));

  // Re-insert in FK order (parents first), 50 rows per batch to stay inside D1 limits
  const t = payload.tables;
  const ins = async <T extends object>(tbl: Parameters<typeof db.insert>[0], rows: T[]) => {
    if (!rows.length) return;
    for (let i = 0; i < rows.length; i += 50) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.insert(tbl) as any).values(rows.slice(i, i + 50)).onConflictDoNothing();
    }
  };

  await ins(schema.patients,             t.patients             as object[]);
  await ins(schema.organizationPatients, t.organizationPatients as object[]);
  await ins(schema.emergencyContacts,    t.emergencyContacts    as object[]);
  await ins(schema.orgRoles,             t.orgRoles             as object[]);
  await ins(schema.organizationMembers,  t.organizationMembers  as object[]);
  await ins(schema.appointments,         t.appointments         as object[]);
  await ins(schema.appointmentReminders, t.appointmentReminders as object[]);
  await ins(schema.visits,               t.visits               as object[]);
  await ins(schema.visitItems,           t.visitItems           as object[]);
  await ins(schema.visitTreatments,      t.visitTreatments      as object[]);
  await ins(schema.payments,             t.payments             as object[]);
  await ins(schema.attachments,          t.attachments          as object[]);
  await ins(schema.prescriptions,        t.prescriptions        as object[]);
  await ins(schema.treatments,           t.treatments           as object[]);
  await ins(schema.invoices,             t.invoices             as object[]);
  await ins(schema.invoiceTreatments,    t.invoiceTreatments    as object[]);
  await ins(schema.salaryRecords,        t.salaryRecords        as object[]);
  await ins(schema.toothChart,           t.toothChart           as object[]);
  await ins(schema.consentAuditLog,      t.consentAuditLog      as object[]);

  writeAuditLog({
    organizationId: orgId,
    actorId:        restoredBy,
    actorRole:      "ADMIN",
    action:         "BACKUP_RESTORE" as AuditAction,
    targetType:     "org",
    targetId:       snapshotId,
    metadata:       { r2Key: snap.r2Key, snapshotCreatedAt: new Date(snap.createdAt).toISOString() },
  });
}

// ── Retention pruning ─────────────────────────────────────────────────────────
// Keep the last 30 completed daily snapshots + 1 per calendar month for 12 months.

async function pruneSnapshots(db: DB, orgId: string): Promise<void> {
  const all = await db
    .select({ id: schema.orgBackups.id, r2Key: schema.orgBackups.r2Key, createdAt: schema.orgBackups.createdAt })
    .from(schema.orgBackups)
    .where(and(eq(schema.orgBackups.organizationId, orgId), eq(schema.orgBackups.status, "completed")))
    .orderBy(schema.orgBackups.createdAt);

  const keep = new Set<string>();

  // Most recent 30
  for (const s of all.slice(-30)) keep.add(s.id);

  // One per calendar month for the past 12 months
  const cutoff   = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const monthMap = new Map<string, string>();
  for (const s of all) {
    if (s.createdAt < cutoff) continue;
    const month = new Date(s.createdAt).toISOString().slice(0, 7);
    if (!monthMap.has(month)) { monthMap.set(month, s.id); keep.add(s.id); }
  }

  for (const s of all.filter((s) => !keep.has(s.id))) {
    if (s.r2Key) await deleteBackup(s.r2Key);
    await db.delete(schema.orgBackups).where(eq(schema.orgBackups.id, s.id));
  }
}

// ── Nightly snapshot gate ─────────────────────────────────────────────────────
// Returns true when no completed auto snapshot exists since midnight today.

export async function autoSnapshotNeeded(db: DB, orgId: string): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [existing] = await db
    .select({ id: schema.orgBackups.id })
    .from(schema.orgBackups)
    .where(
      and(
        eq(schema.orgBackups.organizationId, orgId),
        eq(schema.orgBackups.type, "auto"),
        eq(schema.orgBackups.status, "completed"),
        gte(schema.orgBackups.createdAt, todayStart.getTime()),
      ),
    )
    .limit(1);

  return !existing;
}
