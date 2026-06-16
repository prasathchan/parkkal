import type { Appointment } from "@/types";
import { TYPE_LABELS } from "./types";

const TYPE_DOT: Record<string, string> = {
  CONSULTATION: "bg-pk-teal-400",
  CHECKUP:      "bg-pk-success",
  TREATMENT:    "bg-pk-neutral-400",
  FOLLOWUP:     "bg-pk-warning",
};

/**
 * Sidebar queue for whichever date is currently selected on the calendar.
 * "In Chair Now" / "Up Next" highlight cards only make sense relative to the
 * live clock, so they only render when the selected date is actually today.
 */
export function DayQueue({
  date,
  isToday,
  appointments,
  onAppointmentClick,
}: {
  date:                Date;
  isToday:             boolean;
  appointments:        Appointment[];
  onAppointmentClick:  (a: Appointment) => void;
}) {
  const sorted = [...appointments].sort((a, b) =>
    (a.appointmentTime ?? "").localeCompare(b.appointmentTime ?? ""),
  );

  const inProgress = isToday ? sorted.find((a) => a.status === "IN_PROGRESS") : undefined;
  const nowHHMM    = new Date().toTimeString().slice(0, 5);
  const nextUp     = isToday
    ? sorted.find((a) => a.status === "SCHEDULED" && (a.appointmentTime ?? "00:00") >= nowHHMM)
    : undefined;

  const title = isToday
    ? "Today's Queue"
    : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="w-72 flex-shrink-0 border-l border-pk-border flex flex-col bg-pk-surface-raised">
      <div className="px-4 py-3 border-b border-pk-border bg-pk-surface">
        <h2 className="text-sm font-semibold text-pk-text">{title}</h2>
        <p className="text-xs text-pk-text-muted mt-0.5">{sorted.length} appointment{sorted.length !== 1 ? "s" : ""}</p>
      </div>

      {/* In chair now */}
      {inProgress && (
        <div className="mx-3 mt-3 rounded-pk-lg bg-pk-teal-50 border border-pk-teal-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-pk-teal-500 animate-pulse" />
            <span className="text-xs font-semibold text-pk-teal-700 uppercase tracking-wide">In Chair Now</span>
          </div>
          <p className="text-sm font-bold text-pk-teal-900">{inProgress.patientName}</p>
          <p className="text-xs text-pk-teal-600">{inProgress.appointmentTime} · {TYPE_LABELS[inProgress.type]}</p>
          <p className="text-xs text-pk-teal-500 mt-0.5">{inProgress.doctorName}</p>
        </div>
      )}

      {/* Next up */}
      {nextUp && nextUp.id !== inProgress?.id && (
        <div className="mx-3 mt-2 rounded-pk-lg bg-pk-warning-fill border border-pk-warning-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-pk-warning" />
            <span className="text-xs font-semibold text-pk-warning-text uppercase tracking-wide">Up Next</span>
          </div>
          <p className="text-sm font-bold text-pk-warning-text">{nextUp.patientName}</p>
          <p className="text-xs text-pk-warning-text">{nextUp.appointmentTime} · {TYPE_LABELS[nextUp.type]}</p>
          <p className="text-xs text-pk-warning-text mt-0.5">{nextUp.doctorName}</p>
        </div>
      )}

      {/* Full list */}
      <div className="flex-1 overflow-y-auto mt-2 px-3 pb-3 space-y-1.5">
        {sorted.map((apt) => {
          const isNext = apt.id === nextUp?.id;
          const isNow  = apt.id === inProgress?.id;
          return (
            <button
              key={apt.id}
              type="button"
              onClick={() => onAppointmentClick(apt)}
              className={`
                w-full text-left rounded-pk-sm p-2.5 transition border
                ${isNow   ? "bg-pk-teal-50 border-pk-teal-200"   :
                  isNext  ? "bg-pk-warning-fill border-pk-warning-border"  :
                  apt.status === "COMPLETED"  ? "bg-pk-surface border-pk-border opacity-50" :
                  apt.status === "CANCELLED"  ? "bg-pk-surface border-pk-border opacity-30" :
                  apt.status === "NO_SHOW"    ? "bg-pk-danger-fill border-pk-danger-border opacity-40" :
                  "bg-pk-surface border-pk-border hover:border-pk-border hover:bg-pk-surface-raised"}
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-pk-text truncate">{apt.patientName}</p>
                  <p className="text-xs text-pk-text-muted truncate">{apt.doctorName}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs font-medium text-pk-text-secondary">{apt.appointmentTime ?? "—"}</p>
                  <span className={`
                    inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium mt-0.5
                    ${apt.status === "SCHEDULED"   ? "bg-pk-surface-sunken text-pk-text-secondary"   :
                      apt.status === "IN_PROGRESS" ? "bg-pk-teal-100 text-pk-teal-700"   :
                      apt.status === "COMPLETED"   ? "bg-pk-success-fill text-pk-success-text" :
                      apt.status === "CANCELLED"   ? "bg-pk-danger-fill text-pk-danger-text"     :
                      "bg-pk-surface-sunken text-pk-text-muted"}
                  `}>
                    {apt.status === "IN_PROGRESS" ? "In Chair" :
                     apt.status === "NO_SHOW"     ? "No Show"  :
                     apt.status.charAt(0) + apt.status.slice(1).toLowerCase()}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-center text-xs text-pk-text-muted py-8">No appointments on this date</p>
        )}
      </div>

      {/* Legend */}
      <div className="border-t border-pk-border bg-pk-surface px-4 py-3">
        <p className="text-xs font-medium text-pk-text-muted mb-2">Appointment types</p>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(TYPE_DOT).map(([type, dot]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              <span className="text-xs text-pk-text-muted">{TYPE_LABELS[type]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
