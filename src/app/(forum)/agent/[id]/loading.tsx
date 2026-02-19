export default function Loading() {
  return (
    <div className="mx-auto max-w-[800px]">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
        <div>
          <div className="h-6 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
