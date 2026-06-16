import type { Appointment } from "@/types";
import { STATUS_STYLE, TYPE_LABELS } from "./types";

/** Small pill used in the "no time set" strip. */
export function CompactChip({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  const s = STATUS_STYLE[appt.status];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-[11px] font-medium px-1.5 py-0.5 rounded border truncate ${s.bg} ${s.text} ${s.border} hover:opacity-80 transition-opacity`}
      title={`${appt.patientName ?? appt.patientId}`}
    >
      {appt.patientName ?? appt.patientId}
    </button>
  );
}

/** Positioned block rendered inside an hour cell of the time grid. */
export function AppointmentBlock({ appt, chipHeight }: { appt: Appointment; chipHeight: number }) {
  const s       = STATUS_STYLE[appt.status];
  const compact = chipHeight < 38;

  return (
    <div
      className={`h-full rounded-pk-sm border overflow-hidden flex flex-row cursor-pointer hover:brightness-95 transition-all ${s.bg} ${s.border}`}
      title={`${appt.patientName ?? appt.patientId} · ${appt.appointmentTime} · ${TYPE_LABELS[appt.type] ?? appt.type}`}
    >
      <div className={`w-1 flex-shrink-0 ${s.bar}`} />
      <div className="flex-1 px-1 py-0.5 overflow-hidden min-w-0">
        <div className={`font-semibold truncate leading-tight ${s.text} ${compact ? "text-[10px]" : "text-[11px]"}`}>
          {appt.patientName ?? appt.patientId}
        </div>
        {!compact && (
          <>
            <div className={`truncate text-[10px] leading-tight ${s.text} opacity-70`}>
              {appt.appointmentTime} &middot; {TYPE_LABELS[appt.type] ?? appt.type}
            </div>
            {appt.doctorName && (
              <div className={`truncate text-[10px] leading-tight ${s.text} opacity-55`}>
                {appt.doctorName}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
