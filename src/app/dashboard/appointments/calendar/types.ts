import type { AppointmentStatus } from "@/types";

export type ViewMode = "month" | "week" | "day";
export type ZoomLevel = 1 | 1.5 | 2;
export interface Lane { col: number; total: number }

export const HOUR_START = 8;
export const HOUR_END   = 20;
export const HOURS      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
export const WEEK_DAYS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DEFAULT_DURATION_MIN = 30;

export const STATUS_STYLE: Record<AppointmentStatus, { bg: string; text: string; border: string; bar: string; label: string }> = {
  SCHEDULED:   { bg: "bg-pk-info-fill",    text: "text-pk-info-text",    border: "border-pk-info-border",    bar: "bg-pk-info",    label: "Scheduled"    },
  CONFIRMED:   { bg: "bg-pk-teal-50",      text: "text-pk-teal-700",     border: "border-pk-teal-200",       bar: "bg-pk-teal-600", label: "Confirmed"    },
  IN_PROGRESS: { bg: "bg-pk-warning-fill", text: "text-pk-warning-text", border: "border-pk-warning-border", bar: "bg-pk-warning", label: "In Progress"  },
  COMPLETED:   { bg: "bg-pk-success-fill", text: "text-pk-success-text", border: "border-pk-success-border", bar: "bg-pk-success", label: "Completed"    },
  CANCELLED:   { bg: "bg-pk-neutral-150",  text: "text-pk-neutral-600",  border: "border-pk-neutral-300",    bar: "bg-pk-neutral-400", label: "Cancelled" },
  NO_SHOW:     { bg: "bg-pk-warning-fill", text: "text-pk-warning-text", border: "border-pk-warning-border", bar: "bg-pk-warning", label: "No Show"      },
};

export const TYPE_LABELS: Record<string, string> = {
  CONSULTATION: "Consultation",
  CHECKUP:      "Checkup",
  TREATMENT:    "Treatment",
  FOLLOWUP:     "Follow-up",
};

export const STATUS_TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  SCHEDULED:   ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED:   ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "NO_SHOW"],
};

export const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "",            label: "All"        },
  { value: "SCHEDULED",  label: "Scheduled"  },
  { value: "CONFIRMED",  label: "Confirmed"  },
  { value: "COMPLETED",  label: "Completed"  },
  { value: "CANCELLED",  label: "Cancelled"  },
  { value: "NO_SHOW",    label: "No Show"    },
];
