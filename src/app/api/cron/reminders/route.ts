/**
 * GET /api/cron/reminders
 *
 * Cron job: send all pending appointment reminders that are due now.
 * Runs every 15 minutes via Cloudflare Workers Cron Triggers.
 *
 * ─── TRIGGER ─────────────────────────────────────────────────────────────────
 *
 *   Configured in wrangler.jsonc:
 *     [triggers]
 *     crons = ["*\/15 * * * *"]
 *
 *   Cloudflare delivers cron triggers as a GET request to this route
 *   with the header  x-cloudflare-cron: <cron-expression>
 *
 * ─── SECURITY ────────────────────────────────────────────────────────────────
 *
 *   - Must be called with header  Authorization: Bearer <CRON_SECRET>
 *     OR from Cloudflare's internal cron delivery (x-cloudflare-cron present).
 *   - Set CRON_SECRET in your .dev.vars / Cloudflare Workers Secrets for testing.
 *   - Never expose this route to unauthenticated traffic.
 *
 * ─── BATCH SIZE ──────────────────────────────────────────────────────────────
 *
 *   Processes up to BATCH_LIMIT reminders per run (default: 50).
 *   If the queue grows beyond that, the next cron tick will catch the remainder.
 *   This prevents a single cron run from exhausting Cloudflare's CPU limits.
 *
 * ─── ERROR HANDLING ──────────────────────────────────────────────────────────
 *
 *   Per-reminder errors (e.g. Twilio delivery failure) are caught individually:
 *     - The reminder row is marked FAILED with the error message stored.
 *     - Other reminders in the same batch continue unaffected.
 *   Unrecoverable errors (DB read failure) bubble up and return 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, lte, inArray } from "drizzle-orm";
import { appointmentReminders, patients, organizations } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sendNotification } from "@/lib/notifications";
import env from "@/lib/env";
import type { NotificationChannel } from "@/lib/notifications";
import { createSnapshot, autoSnapshotNeeded } from "@/lib/backup-engine";

type ReminderRow = InferSelectModel<typeof appointmentReminders>;
type PatientContact = Pick<InferSelectModel<typeof patients>, "id" | "name" | "phone" | "email">;

// Maximum reminders to process per cron invocation.
const BATCH_LIMIT = 50;

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth: Cloudflare cron OR explicit Bearer token ─────────────────────────
  const isCronDelivery = req.headers.get("x-cloudflare-cron") !== null;
  const authHeader     = req.headers.get("authorization") ?? "";
  const cronSecret     = env.CRON_SECRET;

  if (!isCronDelivery) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const db  = getDb();
  const now = Date.now();

  // ── Fetch due reminders ────────────────────────────────────────────────────
  const due: ReminderRow[] = await db
    .select()
    .from(appointmentReminders)
    .where(
      and(
        eq(appointmentReminders.status, "PENDING"),
        lte(appointmentReminders.scheduledAt, now),
      ),
    )
    .limit(BATCH_LIMIT);

  if (due.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, message: "No reminders due" });
  }

  // ── Fetch patient contact info in one query (avoids N+1) ─────────────────
  const patientIds = [...new Set(due.map((r: ReminderRow) => r.patientId))];

  // BATCH_LIMIT=50 → at most 50 unique patients per run — single query is fine.
  const patientRows: PatientContact[] = await db
    .select({ id: patients.id, name: patients.name, phone: patients.phone, email: patients.email })
    .from(patients)
    .where(inArray(patients.id, patientIds));

  const patientMap = new Map<string, PatientContact>(
    patientRows.map((p: PatientContact) => [p.id, p]),
  );

  // ── Send each reminder ─────────────────────────────────────────────────────
  let sent   = 0;
  let failed = 0;

  await Promise.allSettled(
    due.map(async (reminder: ReminderRow) => {
      const patient  = patientMap.get(reminder.patientId);
      const channel  = reminder.channel as NotificationChannel;

      // Resolve the "to" address for this channel
      const to =
        channel === "EMAIL"
          ? patient?.email ?? null
          : patient?.phone ?? null;

      if (!to) {
        // Contact info missing for this channel — fail without retry
        const missingField = channel === "EMAIL" ? "email address" : "phone number";
        await db
          .update(appointmentReminders)
          .set({ status: "FAILED", errorMessage: `Patient has no ${missingField} on record` })
          .where(eq(appointmentReminders.id, reminder.id));
        failed++;
        return;
      }

      try {
        await sendNotification({
          channel,
          to,
          message:     reminder.message,
          patientName: patient?.name,
        });

        await db
          .update(appointmentReminders)
          .set({ status: "SENT", sentAt: Date.now() })
          .where(eq(appointmentReminders.id, reminder.id));

        sent++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[CRON] Reminder ${reminder.id} failed:`, errorMessage);

        await db
          .update(appointmentReminders)
          .set({
            status:       "FAILED",
            errorMessage: errorMessage.slice(0, 500), // column limit
          })
          .where(eq(appointmentReminders.id, reminder.id));

        failed++;
      }
    }),
  );

  console.info(`[CRON] Reminders: sent=${sent} failed=${failed} total=${due.length}`);

  // ── Nightly backup at 2 AM ─────────────────────────────────────────────────
  // The cron fires every 15 minutes; we only snapshot once per org per day.
  const hour = new Date().getUTCHours();
  let backupsDone = 0;
  if (hour === 2) {
    const orgs = await db.select({ id: organizations.id }).from(organizations);
    for (const org of orgs) {
      try {
        if (await autoSnapshotNeeded(db, org.id)) {
          await createSnapshot(db, org.id, "auto", null);
          backupsDone++;
        }
      } catch (err) {
        console.error(`[CRON] Auto-backup failed for org ${org.id}:`, err instanceof Error ? err.message : err);
      }
    }
    if (backupsDone > 0) console.info(`[CRON] Auto-backups created: ${backupsDone}`);
  }

  return NextResponse.json({ sent, failed, total: due.length, backupsDone });
}
