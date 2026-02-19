export default function Loading() {
  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-4 h-8 w-2/3 animate-pulse rounded-lg bg-muted" />
      <div className="mb-6 h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
