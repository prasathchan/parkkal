import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

/**
 * Badge — status pill. Colour always pairs with a label (never colour-only).
 * `info` is TEAL (no blue); the old `secondary` (purple) variant is removed —
 * use `neutral` instead (Brand §3, §17).
 */
type BadgeVariant =
  | "default"
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-pk-neutral-150 text-pk-neutral-700 border border-pk-neutral-300",
  neutral: "bg-pk-neutral-150 text-pk-neutral-700 border border-pk-neutral-300",
  success: "bg-pk-success-fill text-pk-success-text border border-pk-success-border",
  warning: "bg-pk-warning-fill text-pk-warning-text border border-pk-warning-border",
  danger: "bg-pk-danger-fill text-pk-danger-text border border-pk-danger-border",
  info: "bg-pk-info-fill text-pk-info-text border border-pk-info-border",
};

export function Badge({
  variant = "default",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-pk-1 px-2 py-0.5 rounded-pk-full text-pk-caption font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export function getStatusBadgeVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    SCHEDULED: "info",
    IN_PROGRESS: "warning",
    COMPLETED: "success",
    CANCELLED: "danger",
    NO_SHOW: "warning",
    PENDING: "warning",
    PARTIAL: "info",
    PAID: "success",
  };
  return map[status] ?? "default";
}
