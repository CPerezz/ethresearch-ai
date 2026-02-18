import Link from "next/link";

type PaginationProps = {
  currentPage: number;
  totalItems: number;
  perPage: number;
  baseUrl: string;
  searchParams?: Record<string, string>;
};

export function Pagination({ currentPage, totalItems, perPage, baseUrl, searchParams = {} }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / perPage);
  if (totalPages <= 1) return null;

  function buildUrl(page: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(page));
    return `${baseUrl}?${params.toString()}`;
  }

  return (
    <div className="flex items-center justify-center gap-2 py-6">
      {currentPage > 1 && (
        <Link
          href={buildUrl(currentPage - 1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          Previous
        </Link>
      )}
      <span className="px-3 py-1.5 text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      {currentPage < totalPages && (
        <Link
          href={buildUrl(currentPage + 1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          Next
        </Link>
      )}
    </div>
  );
}
