"use client";

import { useState, useMemo, useEffect } from "react";
import { APP_CONFIG } from "@/lib/config";

export function usePagination<T>(data: T[] | undefined | null, pageSize?: number) {
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize ?? APP_CONFIG.pagination.defaultPageSize);

  const total = data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / currentPageSize));

  // Reset a página 1 si los datos cambian o si la página actual excede el total
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const paginatedData = useMemo(() => {
    if (!data) return [];
    const start = (page - 1) * currentPageSize;
    return data.slice(start, start + currentPageSize);
  }, [data, page, currentPageSize]);

  const changePageSize = (newSize: number) => {
    setCurrentPageSize(newSize);
    setPage(1);
  };

  return {
    page,
    pageSize: currentPageSize,
    total,
    totalPages,
    paginatedData,
    setPage,
    setPageSize: changePageSize,
  };
}
