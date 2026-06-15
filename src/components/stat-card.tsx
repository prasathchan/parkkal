import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  className?: string;
  iconBg?: string;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  className,
  iconBg = "bg-pk-teal-100",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-pk-surface rounded-pk-lg border border-pk-border shadow-pk-e1 p-6 flex items-start gap-4",
        className
      )}
    >
      <div className={cn("p-3 rounded-pk-sm flex-shrink-0", iconBg)}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-pk-text-muted mb-1">{label}</p>
        <p className="text-2xl font-bold text-pk-text">{value}</p>
        {trend && (
          <p
            className={cn(
              "text-xs mt-1",
              trend.value >= 0 ? "text-pk-success-text" : "text-pk-danger-text"
            )}
          >
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}
