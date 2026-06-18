"use client";

/**
 * DashboardClientSection
 *
 * Replaces the stat strip + today's schedule on the dashboard with a live,
 * location-aware version. Re-fetches whenever the branch selector changes.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatCard } from "@/components/stat-card";
import { Badge, getStatusBadgeVariant } from "@/components/ui/badge";
import { formatCurrency, formatDoctorName } from "@/lib/utils";
import { useLocation } from "@/context/location-context";
import { apiFetch } from "@/api/_client";

interface Stats {
  totalPatients: number;
  todayAppointments: number;
  pendingVisits: number;
  monthlyRevenue: number;
  todayRevenue: number;
  outstandingDues: number;
  todayAppointmentVisits: number;
  todayWalkInVisits: number;
}

interface ScheduleRow {
  id: string | null;
  patientId: string | null;
  doctorId: string | null;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  type: string | null;
  patientName: string | null;
  doctorName: string | null;
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const EMPTY_STATS: Stats = {
  totalPatients: 0, todayAppointments: 0, pendingVisits: 0,
  monthlyRevenue: 0, todayRevenue: 0, outstandingDues: 0,
  todayAppointmentVisits: 0, todayWalkInVisits: 0,
};

export function DashboardClientSection() {
  const { selectedLocationId, selectedLocation, isMultiBranch } = useLocation();
  const [stats, setStats]             = useState<Stats>(EMPTY_STATS);
  const [schedule, setSchedule]       = useState<ScheduleRow[]>([]);
  const [loading, setLoading]         = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const qs = selectedLocationId ? `?locationId=${selectedLocationId}` : "";
      const res = await apiFetch<{ stats: Stats; todaySchedule: ScheduleRow[] }>(
        `/api/dashboard/stats${qs}`
      );
      setStats(res.stats);
      setSchedule(res.todaySchedule);
    } catch {
      // silently degrade — skeleton stays until next successful fetch
    } finally {
      setLoading(false);
    }
  }, [selectedLocationId]);

  useEffect(() => { fetch(); }, [fetch]);

  const todayDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  // Derive doctor availability rail
  const doctorMap = new Map<string, { name: string; apts: ScheduleRow[] }>();
  for (const apt of schedule) {
    const key = apt.doctorId ?? "__unknown__";
    if (!doctorMap.has(key)) doctorMap.set(key, { name: apt.doctorName ?? "Doctor", apts: [] });
    doctorMap.get(key)!.apts.push(apt);
  }
  const doctorRail = Array.from(doctorMap.values()).map(({ name, apts }) => {
    const inChair       = apts.find((a) => a.status === "IN_PROGRESS");
    const nextScheduled = apts.find((a) => a.status === "SCHEDULED");
    const allDone       = apts.every((a) => a.status === "COMPLETED" || a.status === "CANCELLED");
    return {
      name,
      status:        inChair ? "In chair" : allDone ? "Done" : "Free",
      currentPatient: inChair?.patientName ?? null,
      nextTime:      !inChair && nextScheduled ? formatTime(nextScheduled.appointmentTime) : null,
      total:         apts.filter((a) => a.status !== "CANCELLED").length,
      done:          apts.filter((a) => a.status === "COMPLETED").length,
    };
  });

  const skeletonPulse = "animate-pulse bg-pk-surface-raised rounded";

  return (
    <>
      {/* Branch context banner (multi-branch only) */}
      {isMultiBranch && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-pk-sm bg-pk-teal-50 border border-pk-teal-200 text-xs text-pk-teal-800 font-medium">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {selectedLocation ? `Showing data for ${selectedLocation.name}` : "Showing data for all branches"}
        </div>
      )}

      {/* ── Today's schedule hero ─────────────────────────────────────────── */}
      <section aria-labelledby="schedule-heading">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] rounded-pk-lg border border-pk-border shadow-pk-e1 overflow-hidden">
          <div className="bg-pk-surface">
            <div className="px-6 py-4 border-b border-pk-border flex items-center justify-between">
              <div>
                <h2 id="schedule-heading" className="font-semibold text-pk-text">Today&apos;s Schedule</h2>
                <p className="text-xs text-pk-text-muted mt-0.5">{todayDate}</p>
              </div>
              <Link href="/dashboard/appointments/calendar" className="text-xs text-pk-teal-600 hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-pk-border">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-3">
                    <div className={`w-16 h-4 ${skeletonPulse}`} />
                    <div className="flex-1 space-y-1.5">
                      <div className={`w-32 h-3.5 ${skeletonPulse}`} />
                      <div className={`w-24 h-3 ${skeletonPulse}`} />
                    </div>
                    <div className={`w-20 h-5 ${skeletonPulse}`} />
                  </div>
                ))
              ) : schedule.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-pk-text-muted text-sm mb-3">No appointments scheduled for today</p>
                  <Link href="/dashboard/appointments/new" className="inline-flex items-center gap-1.5 text-xs font-medium text-pk-teal-600 hover:text-pk-teal-700">
                    Book an appointment →
                  </Link>
                </div>
              ) : (
                schedule.map((apt) => {
                  const isInChair = apt.status === "IN_PROGRESS";
                  const isDone    = apt.status === "COMPLETED" || apt.status === "CANCELLED";
                  return (
                    <div
                      key={apt.id}
                      className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-pk-surface-raised"
                      style={{
                        borderLeft: isInChair ? "3px solid var(--pk-accent)" : "3px solid transparent",
                        opacity: isDone ? 0.6 : 1,
                      }}
                    >
                      <span className="w-16 flex-shrink-0 text-xs font-medium text-pk-text-secondary tabular-nums">
                        {formatTime(apt.appointmentTime)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-pk-text truncate">{apt.patientName || "Patient"}</p>
                        <p className="text-xs text-pk-text-muted">{formatDoctorName(apt.doctorName)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant={getStatusBadgeVariant(apt.status)}>
                          {apt.status.replace("_", " ")}
                        </Badge>
                        {(apt.status === "SCHEDULED" || apt.status === "IN_PROGRESS") && apt.patientId && (
                          <Link
                            href={`/dashboard/visits/new?patientId=${apt.patientId}&appointmentId=${apt.id}&doctorId=${apt.doctorId ?? ""}`}
                            className="text-xs font-medium text-white bg-pk-teal-600 hover:bg-pk-teal-700 px-2.5 py-1 rounded-pk-xs transition"
                          >
                            {isInChair ? "View Visit" : "Start Visit"}
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Doctor rail */}
          <div className="bg-pk-surface-raised border-t lg:border-t-0 lg:border-l border-pk-border">
            <div className="px-4 py-4 border-b border-pk-border">
              <h3 className="text-sm font-semibold text-pk-text">Doctors today</h3>
            </div>
            <div className="p-4 space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full ${skeletonPulse}`} />
                    <div className="flex-1 space-y-1.5">
                      <div className={`w-24 h-3.5 ${skeletonPulse}`} />
                      <div className={`w-32 h-3 ${skeletonPulse}`} />
                    </div>
                  </div>
                ))
              ) : doctorRail.length === 0 ? (
                <p className="text-xs text-pk-text-muted">No doctors on today&apos;s schedule.</p>
              ) : (
                doctorRail.map((doc) => (
                  <div key={doc.name} className="flex items-start gap-3">
                    <div
                      className="mt-1 w-2 h-2 rounded-pk-full flex-shrink-0"
                      style={{
                        background: doc.status === "In chair"
                          ? "var(--pk-accent)"
                          : doc.status === "Done"
                          ? "var(--pk-success-solid)"
                          : "var(--pk-border-strong)",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-pk-text truncate">{doc.name}</p>
                      <p className="text-xs text-pk-text-muted">
                        {doc.status === "In chair" && doc.currentPatient
                          ? `In chair · ${doc.currentPatient}`
                          : doc.status === "Free" && doc.nextTime
                          ? `Free · next ${doc.nextTime}`
                          : doc.status === "Done"
                          ? `Done · ${doc.done}/${doc.total} seen`
                          : doc.status}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat strip ──────────────────────────────────────────────────────── */}
      <section aria-label="Today's metrics">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`h-24 rounded-pk-lg border border-pk-border ${skeletonPulse}`} />
            ))
          ) : (
            <>
              <StatCard label="Total Patients" value={stats.totalPatients} iconBg="bg-pk-teal-100"
                icon={<svg className="w-6 h-6 text-pk-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              />
              <StatCard label="Today's Appts" value={stats.todayAppointments} iconBg="bg-pk-success-fill"
                icon={<svg className="w-6 h-6 text-pk-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              />
              <StatCard label="Open Visits" value={stats.pendingVisits} iconBg="bg-pk-warning-fill"
                icon={<svg className="w-6 h-6 text-pk-warning-text" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>}
              />
              <StatCard label="Monthly Revenue" value={formatCurrency(stats.monthlyRevenue)} iconBg="bg-pk-neutral-100"
                icon={<svg className="w-6 h-6 text-pk-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <StatCard label="Today's Revenue" value={formatCurrency(stats.todayRevenue)} iconBg="bg-pk-success-fill"
                icon={<svg className="w-6 h-6 text-pk-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <StatCard label="Outstanding" value={formatCurrency(stats.outstandingDues)} iconBg="bg-pk-danger-fill"
                icon={<svg className="w-6 h-6 text-pk-danger-text" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
            </>
          )}
        </div>
      </section>
    </>
  );
}
