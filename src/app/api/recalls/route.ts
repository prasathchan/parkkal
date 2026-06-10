/**
 * API Route: /api/recalls
 *
 * GET — List visits with a recall date set.
 *       Joins to appointments so the UI shows whether the recall has been
 *       booked, attended, or lapsed.
 *
 * Query params:
 *   status = "unscheduled" | "scheduled" | "fulfilled" | "lapsed" | "all"
 *            (default: "all")
 *   limit, offset
 *
 * ─── RECALL STATUS (computed) ────────────────────────────────────────────────
 *   UNSCHEDULED  — no appointment booked, recall date still in the future
 *   LAPSED       — no appointment booked AND recall date has passed, OR
 *                  the linked appointment was cancelled
 *   SCHEDULED    — appointment booked and not yet attended
 *   FULFILLED    — linked appointment was COMPLETED (patient came in)
 */
import { eq, and, desc, count, isNotNull } from "drizzle-orm";
import { visits, patients, users, appointments } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { withRoute, apiOk, RATE_LIMITS } from "@/lib/api";
import type { RecallStatus } from "@/types";

export const GET = withRoute(
  { route: "GET /api/recalls", rateLimit: RATE_LIMITS.READ, permission: PERMISSIONS.VISITS_VIEW },
  async (req, { session, db }) => {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") ?? "all";
    const limit  = Math.min(Number(searchParams.get("limit")  ?? 50), 200);
    const offset = Number(searchParams.get("offset") ?? 0);
    const today  = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const where = and(
      eq(visits.organizationId, session.orgId),
      isNotNull(visits.recallDate),
    );

    const [{ total }] = await db.select({ total: count() }).from(visits).where(where);

    const rows = await db
      .select({
        id:          visits.id,
        visitCode:   visits.visitCode,
        visitDate:   visits.visitDate,
        recallDate:  visits.recallDate,
        recallNotes: visits.recallNotes,
        status:      visits.status,
        patientId:   visits.patientId,
        recallAppointmentId:     visits.recallAppointmentId,
        patientName:             patients.name,
        patientCode:             patients.patientCode,
        patientPhone:            patients.phone,
        doctorName:              users.name,
        recallAppointmentDate:   appointments.appointmentDate,
        recallAppointmentTime:   appointments.appointmentTime,
        recallAppointmentStatus: appointments.status,
      })
      .from(visits)
      .leftJoin(patients,     eq(visits.patientId, patients.id))
      .leftJoin(users,        eq(visits.doctorId, users.id))
      .leftJoin(appointments, eq(visits.recallAppointmentId, appointments.id))
      .where(where)
      .orderBy(desc(visits.recallDate))
      .limit(limit)
      .offset(offset);

    type Row = (typeof rows)[number];

    function computeRecallStatus(r: Row): RecallStatus {
      if (r.recallAppointmentId) {
        if (r.recallAppointmentStatus === "COMPLETED") return "FULFILLED";
        if (r.recallAppointmentStatus === "CANCELLED") return "LAPSED";
        return "SCHEDULED";
      }
      if (r.recallDate && r.recallDate < today) return "LAPSED";
      return "UNSCHEDULED";
    }

    const tagged = rows.map((r: Row) => ({
      ...r,
      recallStatus:    computeRecallStatus(r),
      isOverdue:       r.recallDate !== null && r.recallDate < today,
      daysUntilRecall: r.recallDate
        ? Math.round((new Date(r.recallDate).getTime() - new Date(today).getTime()) / 86_400_000)
        : null,
    }));

    // Apply recall-status filter (done in-process — batch is max 200 rows)
    type TaggedRow = (typeof tagged)[number];
    const filtered =
      statusFilter === "all"
        ? tagged
        : tagged.filter((r: TaggedRow) => r.recallStatus.toLowerCase() === statusFilter.toLowerCase());

    return apiOk({ recalls: filtered, total, hasMore: offset + rows.length < total });
  }
);
