import Link from "next/link";
import { AddToCalendar } from "@/components/ui/add-to-calendar";
import type { Appointment, AppointmentStatus } from "@/types";
import { STATUS_STYLE, STATUS_TRANSITIONS, TYPE_LABELS } from "./types";

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

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/30"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md max-h-[90vh] z-50 flex flex-col rounded-pk-lg shadow-pk-e3 overflow-y-auto"
        style={{ background: "var(--pk-surface)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--pk-border)" }}>
          <h2 className="font-semibold" style={{ color: "var(--pk-text)" }}>Appointment</h2>
          <button
            onClick={onClose}
            className="text-lg leading-none hover:opacity-70 transition-opacity"
            style={{ color: "var(--pk-text-muted)" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-4 py-4 space-y-4">

          {/* Status badge */}
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}>
            {s.label}
          </span>

          {/* Patient */}
          <div>
            <p className="text-xs mb-0.5" style={{ color: "var(--pk-text-muted)" }}>Patient</p>
            <p className="font-medium" style={{ color: "var(--pk-text)" }}>{appt.patientName ?? appt.patientId}</p>
            {appt.patientCode && <p className="text-xs" style={{ color: "var(--pk-text-muted)" }}>{appt.patientCode}</p>}
          </div>

          {/* Doctor */}
          {appt.doctorName && (
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--pk-text-muted)" }}>Doctor</p>
              <p className="font-medium" style={{ color: "var(--pk-text)" }}>{appt.doctorName}</p>
            </div>
          )}

          {/* Date & Time */}
          <div>
            <p className="text-xs mb-0.5" style={{ color: "var(--pk-text-muted)" }}>Date & Time</p>
            <p className="font-medium" style={{ color: "var(--pk-text)" }}>
              {new Date(`${appt.appointmentDate}T00:00`).toLocaleDateString("en-IN", {
                weekday: "long", day: "numeric", month: "short", year: "numeric",
              })}
            </p>
            <p className="text-sm" style={{ color: "var(--pk-text-secondary)" }}>
              {appt.appointmentTime ?? "No time set"}
            </p>
          </div>

          {/* Type */}
          <div>
            <p className="text-xs mb-0.5" style={{ color: "var(--pk-text-muted)" }}>Type</p>
            <p className="text-sm" style={{ color: "var(--pk-text)" }}>{TYPE_LABELS[appt.type] ?? appt.type}</p>
          </div>

          {/* Notes */}
          {appt.notes && (
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--pk-text-muted)" }}>Notes</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--pk-text-secondary)" }}>{appt.notes}</p>
            </div>
          )}

          {/* Add to calendar */}
          {appt.appointmentTime && (
            <div className="pt-1">
              <AddToCalendar
                title={`${TYPE_LABELS[appt.type] ?? appt.type} — ${appt.patientName ?? appt.patientId}`}
                date={appt.appointmentDate}
                time={appt.appointmentTime}
                duration={30}
                notes={appt.doctorName ? `Doctor: ${appt.doctorName}` : undefined}
              />
            </div>
          )}

          {/* Quick status transitions */}
          {transitions.length > 0 && (
            <div>
              <p className="text-xs mb-1.5" style={{ color: "var(--pk-text-muted)" }}>Quick Actions</p>
              <div className="flex flex-wrap gap-1.5">
                {transitions.map(newStatus => {
                  const ts = STATUS_STYLE[newStatus];
                  return (
                    <button
                      key={newStatus}
                      onClick={() => onStatusChange(newStatus)}
                      disabled={statusBusy}
                      className={`px-2.5 py-1 rounded-pk-sm text-xs font-medium border transition-colors disabled:opacity-50 ${ts.bg} ${ts.text} ${ts.border}`}
                    >
                      {statusBusy ? "…" : `Mark ${ts.label}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t space-y-2 shrink-0" style={{ borderColor: "var(--pk-border)" }}>
          {canStartVisit && (
            <Link
              href={`/dashboard/visits/new?patientId=${appt.patientId}&appointmentId=${appt.id}&doctorId=${appt.doctorId}`}
              className="flex items-center justify-center gap-1.5 w-full text-sm font-medium py-2 rounded-pk-sm bg-pk-teal-600 text-white hover:bg-pk-teal-700 transition"
              onClick={onClose}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Start Visit
            </Link>
          )}
          <Link
            href={`/dashboard/patients/${appt.patientId}`}
            className="block w-full text-center text-sm font-medium py-2 border rounded-pk-sm transition-colors hover:bg-pk-surface-sunken"
            style={{ borderColor: "var(--pk-border)", color: "var(--pk-text)" }}
            onClick={onClose}
          >
            Open Patient Record
          </Link>
        </div>
      </div>
    </div>
  );
}
