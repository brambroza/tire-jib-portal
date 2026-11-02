import { useEffect, useMemo, useState } from "react";

export function useTablePagination<T>(rows: T[], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return {
    page,
    pageSize,
    totalPages,
    totalItems: rows.length,
    paginatedRows,
    setPage,
    setPageSize: (nextSize: number) => {
      setPageSize(nextSize);
      setPage(1);
    }
  };
}
