/**
 * POST /api/recalls/notify
 *
 * Send recall reminder emails to selected patients.
 * Body: { visitIds: string[] }  (list of visit IDs whose recall reminders to send)
 *
 * Returns counts of sent/failed/skipped.
 */
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { visits, patients, users, organizations } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, apiError, RATE_LIMITS } from "@/lib/api";
import { sendRecallReminderEmail } from "@/lib/email";
import { z } from "zod";

const bodySchema = z.object({
  visitIds: z.array(z.string().min(1)).min(1).max(50),
});

export const POST = withRoute(
  { route: "POST /api/recalls/notify", rateLimit: RATE_LIMITS.WRITE, permission: PERMISSIONS.VISITS_EDIT },
  async (req, { session, db, log }) => {
    let body: unknown;
    try { body = await req.json(); } catch { return apiError("Invalid JSON", 400); }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400);

    const { visitIds } = parsed.data;

    // Fetch org name for the email template
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, session.orgId));

    const orgName = org?.name ?? "Your clinic";

    // Fetch the recall visits with patient + doctor info
    const rows = await db
      .select({
        visitId:     visits.id,
        recallDate:  visits.recallDate,
        recallNotes: visits.recallNotes,
        patientId:   visits.patientId,
        patientName: patients.name,
        patientEmail: patients.email,
        doctorName:  users.name,
      })
      .from(visits)
      .leftJoin(patients, eq(visits.patientId, patients.id))
      .leftJoin(users,    eq(visits.doctorId, users.id))
      .where(
        and(
          eq(visits.organizationId, session.orgId),
          isNotNull(visits.recallDate),
          inArray(visits.id, visitIds),
        )
      );

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      if (!row.patientEmail || !row.recallDate) {
        skipped++;
        continue;
      }
      try {
        await sendRecallReminderEmail({
          to: row.patientEmail,
          patientName: row.patientName ?? "Patient",
          clinicName: orgName,
          recallDate: row.recallDate,
          doctorName: row.doctorName,
          recallNotes: row.recallNotes,
        });
        sent++;
      } catch {
        failed++;
      }
    }

    log.info("Recall reminders sent", { orgId: session.orgId, sent, skipped, failed, total: rows.length });
    return apiOk({ sent, skipped, failed });
  }
);
