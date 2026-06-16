import type { RefObject } from "react";
import type { Appointment } from "@/types";
import { HOURS, WEEK_DAYS, type Lane, type ViewMode } from "./types";
import { computeLanes, formatHourLabel, parseHour, parseMinute, toDateStr } from "./date-utils";
import { AppointmentBlock, CompactChip } from "./chips";

export function TimeGrid({
  scrollRef,
  view,
  gridCols,
  getAppts,
  today,
  selectedDateStr,
  nowDateStr,
  now,
  hourHeight,
  chipHeight,
  loading,
  onDayHeaderClick,
  onCellClick,
  onAppointmentClick,
}: {
  scrollRef:           RefObject<HTMLDivElement>;
  view:                ViewMode;
  gridCols:            Date[];
  getAppts:            (ds: string) => Appointment[];
  today:               string;
  selectedDateStr:     string;
  nowDateStr:          string;
  now:                 Date;
  hourHeight:          number;
  chipHeight:          number;
  loading:             boolean;
  onDayHeaderClick:    (d: Date) => void;
  onCellClick:         (dateStr: string, hour: number) => void;
  onAppointmentClick:  (appt: Appointment) => void;
}) {
  const nowLineTop = (now.getHours() - HOURS[0]) * hourHeight + (now.getMinutes() / 60) * hourHeight;
  const nowVisible = now.getHours() >= HOURS[0] && now.getHours() < HOURS[HOURS.length - 1] + 1;

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto">
      <div style={{ minWidth: view === "week" ? 720 : 360 }}>

        {/* Day headers — sticky */}
        <div
          className="grid sticky top-0 z-20 border-b"
          style={{
            gridTemplateColumns: `64px repeat(${gridCols.length}, 1fr)`,
            background: "var(--pk-surface)",
            borderColor: "var(--pk-border)",
          }}
        >
          <div /> {/* gutter placeholder */}
          {gridCols.map((d, i) => {
            const ds         = toDateStr(d);
            const isToday    = ds === today;
            const isSelected = ds === selectedDateStr;
            const count      = getAppts(ds).filter(a => a.appointmentTime).length;
            return (
              <div
                key={i}
                className={`py-2 text-center border-l select-none ${view === "week" ? "cursor-pointer hover:bg-pk-teal-50/60" : ""}`}
                style={{
                  borderColor: "var(--pk-border)",
                  background: isToday ? "var(--pk-teal-50)" : undefined,
                  boxShadow: isSelected && !isToday ? "inset 0 0 0 1px var(--pk-teal-300)" : undefined,
                }}
                onClick={() => { if (view === "week") onDayHeaderClick(d); }}
              >
                <div className="text-[11px] font-medium uppercase" style={{ color: isToday ? "var(--pk-primary)" : "var(--pk-text-muted)" }}>
                  {view === "week" ? WEEK_DAYS[i] : d.toLocaleDateString("en-IN", { weekday: "short" })}
                </div>
                <div className="text-xl font-bold leading-tight" style={{ color: isToday ? "var(--pk-primary)" : "var(--pk-text)" }}>
                  {d.getDate()}
                </div>
                {count > 0 && (
                  <div className="text-[10px] font-medium" style={{ color: "var(--pk-primary)" }}>
                    {count} {count === 1 ? "appt" : "appts"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Unscheduled strip */}
        {gridCols.some(d => getAppts(toDateStr(d)).some(a => !a.appointmentTime)) && (
          <div
            className="grid border-b"
            style={{
              gridTemplateColumns: `64px repeat(${gridCols.length}, 1fr)`,
              borderColor: "var(--pk-border)",
              background: "var(--pk-warning-fill)",
            }}
          >
            <div className="py-1 px-2 text-[10px] font-medium self-center" style={{ color: "var(--pk-warning-text)" }}>No time</div>
            {gridCols.map((d, i) => {
              const unscheduled = getAppts(toDateStr(d)).filter(a => !a.appointmentTime);
              return (
                <div key={i} className="border-l py-1 px-1 space-y-0.5 min-h-[28px]" style={{ borderColor: "var(--pk-border)" }}>
                  {unscheduled.map(appt => (
                    <CompactChip key={appt.id} appt={appt} onClick={() => onAppointmentClick(appt)} />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Time grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48 text-sm" style={{ color: "var(--pk-text-muted)" }}>Loading…</div>
        ) : (
          <div className="relative">

            {/* Current-time red line */}
            {nowVisible && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                style={{ top: nowLineTop }}
              >
                <div className="w-16 flex justify-end pr-1 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                </div>
                <div className="flex-1 border-t border-red-500" />
              </div>
            )}

            {HOURS.map(hour => {
              // Compute per-day lane assignments once per day (not per hour)
              const dayLaneMap = new Map(
                gridCols.map(d => {
                  const ds = toDateStr(d);
                  return [ds, computeLanes(getAppts(ds).filter(a => a.appointmentTime))] as [string, Map<string, Lane>];
                })
              );

              return (
                <div
                  key={hour}
                  className="grid border-b"
                  style={{
                    gridTemplateColumns: `64px repeat(${gridCols.length}, 1fr)`,
                    height: hourHeight,
                    borderColor: "var(--pk-border)",
                  }}
                >
                  {/* Hour label */}
                  <div className="px-2 pt-1 text-[11px] text-right leading-none flex-shrink-0" style={{ color: "var(--pk-text-muted)" }}>
                    {formatHourLabel(hour)}
                  </div>

                  {/* Day columns */}
                  {gridCols.map((d, i) => {
                    const ds        = toDateStr(d);
                    const isToday   = ds === today;
                    const isNowCol  = ds === nowDateStr;
                    const hourAppts = getAppts(ds).filter(a => parseHour(a.appointmentTime) === hour);
                    const lanes     = dayLaneMap.get(ds)!;

                    return (
                      <div
                        key={i}
                        className="relative border-l cursor-pointer group"
                        style={{
                          borderColor: "var(--pk-border)",
                          background: isToday ? "rgba(13,148,136,0.025)" : undefined,
                        }}
                        onClick={() => onCellClick(ds, hour)}
                        title={`Book at ${formatHourLabel(hour)} on ${ds}`}
                      >
                        {/* Half-hour dashed line */}
                        <div
                          className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
                          style={{ top: "50%", borderColor: "var(--pk-border)" }}
                        />

                        {/* Hover booking hint */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity flex items-center justify-center">
                          <span className="text-[10px] font-medium" style={{ color: "var(--pk-text-muted)" }}>+ Book</span>
                        </div>

                        {/* Now-column subtle marker */}
                        {isNowCol && nowVisible && Math.floor((now.getHours() - HOURS[0]) * hourHeight) === Math.floor((hour - HOURS[0]) * hourHeight) && (
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-400 opacity-20 pointer-events-none" />
                        )}

                        {/* Appointment blocks */}
                        {hourAppts.map(appt => {
                          const lane      = lanes.get(appt.id) ?? { col: 0, total: 1 };
                          const minuteTop = (parseMinute(appt.appointmentTime) / 60) * hourHeight;
                          const widthPct  = 100 / lane.total;
                          const leftPct   = lane.col * widthPct;

                          return (
                            <div
                              key={appt.id}
                              className="absolute"
                              style={{
                                top:    minuteTop,
                                left:   `calc(${leftPct}% + 2px)`,
                                width:  `calc(${widthPct}% - 4px)`,
                                height: chipHeight,
                                zIndex: 10,
                              }}
                              onClick={e => { e.stopPropagation(); onAppointmentClick(appt); }}
                            >
                              <AppointmentBlock appt={appt} chipHeight={chipHeight} />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
