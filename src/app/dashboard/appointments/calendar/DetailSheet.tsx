import Link from "next/link";
import { AddToCalendar } from "@/components/ui/add-to-calendar";
import type { Appointment, AppointmentStatus } from "@/types";
import { ACTION_BUTTON_STYLE, STATUS_STYLE, STATUS_TRANSITIONS, TYPE_BAR_COLOR, TYPE_LABELS } from "./types";

function CalendarIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export function DetailSheet({
  appt,
  onClose,
  onStatusChange,
  statusBusy,
}: {
  appt:           Appointment;
  onClose:        () => void;
  onStatusChange: (s: AppointmentStatus) => void;
  statusBusy:     boolean;
}) {
  const s           = STATUS_STYLE[appt.status];
  const transitions = STATUS_TRANSITIONS[appt.status] ?? [];
  const canStartVisit = appt.status === "SCHEDULED" || appt.status === "IN_PROGRESS";
  const dateLabel = new Date(`${appt.appointmentDate}T00:00`).toLocaleDateString("en-IN", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/30"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md max-h-[90vh] z-50 flex flex-col rounded-pk-lg shadow-pk-e3 overflow-y-auto"
        style={{ background: "var(--pk-surface)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent bar — colour-coded by appointment type */}
        <div className={`h-1.5 rounded-t-pk-lg flex-shrink-0 ${TYPE_BAR_COLOR[appt.type] ?? "bg-pk-teal-400"}`} />

        <div className="px-6 pt-5 pb-6">
          {/* Eyebrow + close */}
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pk-text-muted)" }}>
              {TYPE_LABELS[appt.type] ?? appt.type}
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-lg leading-none hover:opacity-70 transition-opacity -mt-1 -mr-1"
              style={{ color: "var(--pk-text-muted)" }}
            >
              ✕
            </button>
          </div>

          {/* Patient name */}
          <h2 className="text-2xl font-bold mt-1" style={{ color: "var(--pk-text)" }}>
            {appt.patientName ?? appt.patientId}
          </h2>
          {appt.patientCode && (
            <p className="text-xs mt-0.5" style={{ color: "var(--pk-text-muted)" }}>{appt.patientCode}</p>
          )}

          {/* Icon rows */}
          <div className="space-y-2.5 mt-4">
            <div className="flex items-center gap-2.5 text-sm" style={{ color: "var(--pk-text-secondary)" }}>
              <CalendarIcon />
              <span>{dateLabel} &middot; {appt.appointmentTime ?? "No time set"}</span>
            </div>
            {appt.doctorName && (
              <div className="flex items-center gap-2.5 text-sm" style={{ color: "var(--pk-text-secondary)" }}>
                <PersonIcon />
                <span>{appt.doctorName}</span>
              </div>
            )}
            {appt.notes && (
              <div className="flex items-start gap-2.5 text-sm" style={{ color: "var(--pk-text-secondary)" }}>
                <span className="mt-0.5"><NoteIcon /></span>
                <span className="whitespace-pre-wrap">{appt.notes}</span>
              </div>
            )}
          </div>

          {/* Status pill */}
          <span className={`inline-block mt-4 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${s.bg} ${s.text}`}>
            {s.label}
          </span>

          <div className="my-5 border-t" style={{ borderColor: "var(--pk-border)" }} />

          {/* Add to calendar + Patient record */}
          <div className="flex items-center gap-2">
            {appt.appointmentTime && (
              <AddToCalendar
                title={`${TYPE_LABELS[appt.type] ?? appt.type} — ${appt.patientName ?? appt.patientId}`}
                date={appt.appointmentDate}
                time={appt.appointmentTime}
                duration={30}
                notes={appt.doctorName ? `Doctor: ${appt.doctorName}` : undefined}
              />
            )}
            <Link
              href={`/dashboard/patients/${appt.patientId}`}
              className="ml-auto inline-flex items-center justify-center text-sm font-medium px-4 py-2 rounded-pk-sm border transition-colors hover:bg-pk-surface-sunken"
              style={{ borderColor: "var(--pk-border)", color: "var(--pk-text)" }}
              onClick={onClose}
            >
              Patient Record
            </Link>
          </div>

          <div className="my-5 border-t" style={{ borderColor: "var(--pk-border)" }} />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {canStartVisit && (
              <Link
                href={`/dashboard/visits/new?patientId=${appt.patientId}&appointmentId=${appt.id}&doctorId=${appt.doctorId}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pk-sm bg-pk-teal-600 text-white text-sm font-medium hover:bg-pk-teal-700 transition"
                onClick={onClose}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Start Visit
              </Link>
            )}
            {transitions.map(newStatus => {
              const a = ACTION_BUTTON_STYLE[newStatus];
              return (
                <button
                  key={newStatus}
                  onClick={() => onStatusChange(newStatus)}
                  disabled={statusBusy}
                  className={`px-4 py-2 rounded-pk-sm border text-sm font-medium transition-colors disabled:opacity-50 ${a.text} ${a.border} ${a.hoverBg}`}
                >
                  {statusBusy ? "…" : a.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
