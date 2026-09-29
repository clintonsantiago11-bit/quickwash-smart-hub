/**
 * A single shimmering block. Kept as a component so every skeleton uses the
 * same timing and the whole page pulses in step rather than looking like a
 * broken layout.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-[var(--bg-hover)] ${className}`}
    />
  );
}

/** Full-page skeleton used while a route's data is still loading. */
export function PageSkeleton({
  label = 'Loading…',
  cards = 4,
}: {
  label?: string;
  cards?: number;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl p-3 sm:p-4 md:p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="card p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-6 h-40 w-full" />
        </div>
        <div className="card p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-6 h-40 w-full" />
        </div>
      </div>
      <p className="sr-only" role="status">
        {label}
      </p>
    </div>
  );
}
