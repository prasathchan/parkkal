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

/** Top accent bar / legend dot colour per appointment type — mirrors the calendar's own legend. */
export const TYPE_BAR_COLOR: Record<string, string> = {
  CONSULTATION: "bg-pk-teal-400",
  CHECKUP:      "bg-pk-success",
  TREATMENT:    "bg-pk-neutral-400",
  FOLLOWUP:     "bg-pk-warning",
};

export const STATUS_TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  SCHEDULED:   ["CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "NO_SHOW"],
};

/**
 * Action-button styling for status transitions — distinct from STATUS_STYLE,
 * which colours the *resting* badge/chip once a status is applied. The
 * action that *causes* the transition uses semantic intent colours instead
 * (e.g. Cancel is danger/red even though a resting "Cancelled" chip is
 * neutral grey, so the destructive action reads clearly in the moment).
 */
export const ACTION_BUTTON_STYLE: Record<AppointmentStatus, { text: string; border: string; hoverBg: string; label: string }> = {
  SCHEDULED:   { text: "text-pk-info-text",    border: "border-pk-info-border",    hoverBg: "hover:bg-pk-info-fill",    label: "Mark Scheduled" },
  CONFIRMED:   { text: "text-pk-teal-700",     border: "border-pk-teal-300",       hoverBg: "hover:bg-pk-teal-50",      label: "Confirm"         },
  IN_PROGRESS: { text: "text-pk-teal-700",     border: "border-pk-teal-300",       hoverBg: "hover:bg-pk-teal-50",      label: "Start"           },
  COMPLETED:   { text: "text-pk-success-text", border: "border-pk-success-border", hoverBg: "hover:bg-pk-success-fill", label: "Complete"        },
  CANCELLED:   { text: "text-pk-danger-text",  border: "border-pk-danger-border",  hoverBg: "hover:bg-pk-danger-fill",  label: "Cancel"          },
  NO_SHOW:     { text: "text-pk-warning-text", border: "border-pk-warning-border", hoverBg: "hover:bg-pk-warning-fill", label: "No Show"         },
};

export const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "",            label: "All"        },
  { value: "SCHEDULED",  label: "Scheduled"  },
  { value: "COMPLETED",  label: "Completed"  },
  { value: "CANCELLED",  label: "Cancelled"  },
  { value: "NO_SHOW",    label: "No Show"    },
];
