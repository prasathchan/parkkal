/**
 * Skeleton — animated placeholder shown while data loads.
 * Usage: <Skeleton className="h-4 w-32" /> | <SkeletonCard /> | <SkeletonTable rows={5} cols={4} />
 */

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-pk-surface-sunken ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-pk-border bg-pk-surface p-5 shadow-sm" aria-hidden="true">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
}

export function SkeletonTable({ rows = 5, cols = 4 }: SkeletonTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-pk-border" aria-hidden="true">
      <div
        className="grid border-b border-pk-border bg-pk-surface-raised p-3 gap-4"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid border-b border-pk-border p-3 gap-4 last:border-0"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4" style={{ width: `${60 + ((r + c) % 3) * 15}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
