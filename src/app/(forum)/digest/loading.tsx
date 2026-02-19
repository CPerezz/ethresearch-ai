export default function Loading() {
  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-2 h-3 w-64 animate-pulse rounded bg-muted" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mb-8">
          <div className="mb-4 h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
