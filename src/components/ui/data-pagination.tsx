import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function usePagination<T>(items: T[], defaultPageSize = 5) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  function setPageSize(nextSize: number) {
    setPageSizeState(nextSize);
    setPage(1);
  }

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,
    startItem,
    endItem,
    paginatedItems,
  };
}

type DataPaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  startItem: number;
  endItem: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  compact?: boolean;
  className?: string;
};

function getPageNumbers(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }
  const pages: (number | "...")[] = [1];
  if (page > 3) pages.push("...");
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i += 1) {
    pages.push(i);
  }
  if (page < totalPages - 2) pages.push("...");
  pages.push(totalPages);
  return pages;
}

export function DataPagination({
  page,
  totalPages,
  totalItems,
  startItem,
  endItem,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20],
  compact = false,
  className,
}: DataPaginationProps) {
  if (totalItems === 0) return null;

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <nav
      aria-label="Navigasi halaman data"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
        <span className="font-mono tabular-nums">
          Menampilkan <span className="font-semibold text-foreground">{startItem}</span>–
          <span className="font-semibold text-foreground">{endItem}</span> dari{" "}
          <span className="font-semibold text-foreground">{totalItems}</span>
        </span>

        {onPageSizeChange && !compact && (
          <label className="inline-flex items-center gap-1.5">
            <span>Baris:</span>
            <select
              aria-label="Jumlah baris per halaman"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-md border border-border bg-background px-2 font-mono text-xs font-semibold text-foreground"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Halaman sebelumnya"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" />
          {!compact && <span className="hidden sm:inline">Sebelumnya</span>}
        </button>

        {pageNumbers.map((item, idx) =>
          item === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-1.5 font-mono text-xs text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                "inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 font-mono text-xs font-semibold tabular-nums transition-colors",
                item === page
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Halaman berikutnya"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {!compact && <span className="hidden sm:inline">Berikutnya</span>}
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </nav>
  );
}
