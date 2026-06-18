/**
 * Skeleton — animated placeholder shown while data loads.
 * Usage: <Skeleton className="h-4 w-32" /> | <SkeletonCard /> | <SkeletonTable rows={5} cols={4} /> | <SkeletonDetailPage />
 */

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-pk-md border border-pk-border bg-pk-surface p-5 shadow-pk-e1" aria-hidden="true">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function SkeletonDetailPage() {
  return (
    <div className="flex-1 flex flex-col" role="status" aria-label="Loading" aria-hidden="true">
      <div className="border-b border-pk-border bg-pk-surface px-6 py-4 flex items-center gap-3 h-14">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-4 opacity-30" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="flex-1 p-6 space-y-5">
        <div className="rounded-pk-lg border border-pk-border bg-pk-surface p-5 shadow-pk-e1 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-24 rounded-pk-sm" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </div>
        <SkeletonTable rows={6} cols={5} />
      </div>
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
}

export function SkeletonTable({ rows = 5, cols = 4 }: SkeletonTableProps) {
  return (
    <div className="overflow-hidden rounded-pk-sm border border-pk-border" role="status" aria-label="Loading" aria-hidden="true">
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
