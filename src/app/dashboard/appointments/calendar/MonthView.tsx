import type { Appointment } from "@/types";
import { STATUS_STYLE, WEEK_DAYS } from "./types";
import { toDateStr } from "./date-utils";

export function MonthView({
  monthStart,
  monthGridDates,
  getAppts,
  today,
  selectedDateStr,
  loading,
  onDayClick,
}: {
  monthStart:      Date;
  monthGridDates:  Date[];
  getAppts:        (ds: string) => Appointment[];
  today:           string;
  selectedDateStr: string;
  loading:         boolean;
  onDayClick:      (d: Date) => void;
}) {
  const currentMonth = monthStart.getMonth();
  const weeks        = monthGridDates.length / 7;

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium py-1 uppercase" style={{ color: "var(--pk-text-muted)" }}>{d}</div>
        ))}
      </div>

      {/* Weeks */}
      {Array.from({ length: weeks }, (_, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
          {monthGridDates.slice(wi * 7, wi * 7 + 7).map((d, di) => {
            const ds             = toDateStr(d);
            const isToday        = ds === today;
            const isSelected     = ds === selectedDateStr;
            const inCurrentMonth = d.getMonth() === currentMonth;
            const appts          = getAppts(ds).filter(a => a.appointmentTime);

            return (
              <div
                key={di}
                onClick={() => onDayClick(d)}
                className="rounded-pk-sm border p-1.5 cursor-pointer transition-colors hover:shadow-sm min-h-[80px]"
                style={{
                  borderColor: isToday ? "var(--pk-primary)" : isSelected ? "var(--pk-teal-300)" : "var(--pk-border)",
                  boxShadow:   isSelected && !isToday ? "inset 0 0 0 1px var(--pk-teal-300)" : undefined,
                  background:  isToday
                    ? "var(--pk-teal-50)"
                    : inCurrentMonth
                    ? "var(--pk-surface)"
                    : "var(--pk-surface-sunken)",
                  opacity: inCurrentMonth ? 1 : 0.45,
                }}
              >
                {/* Date number */}
                <div
                  className="text-sm font-bold mb-1"
                  style={{ color: isToday ? "var(--pk-primary)" : "var(--pk-text)" }}
                >
                  {d.getDate()}
                </div>

                {/* Appointment previews */}
                {loading ? (
                  <div className="h-2.5 w-10 rounded animate-pulse" style={{ background: "var(--pk-border)" }} />
                ) : (
                  <div className="space-y-0.5">
                    {appts.slice(0, 3).map(a => {
                      const s = STATUS_STYLE[a.status];
                      return (
                        <div
                          key={a.id}
                          className={`text-[10px] truncate rounded px-1 py-px leading-snug ${s.bg} ${s.text}`}
                        >
                          {a.appointmentTime} {a.patientName ?? ""}
                        </div>
                      );
                    })}
                    {appts.length > 3 && (
                      <div className="text-[10px]" style={{ color: "var(--pk-text-muted)" }}>
                        +{appts.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
