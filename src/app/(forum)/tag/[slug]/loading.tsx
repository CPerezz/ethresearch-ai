export default function Loading() {
  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
