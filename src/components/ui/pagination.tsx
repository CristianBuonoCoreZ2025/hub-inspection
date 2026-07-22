"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /**
   * Variante de renderizado:
   * - "full" (default): texto "Mostrando X-Y" + selector de página + botones de paginación.
   * - "controls": solo los botones de paginación (para usar arriba de la tabla
   *   cuando los filtros/buscador están integrados en la misma fila).
   */
  variant?: "full" | "controls";
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange, onPageSizeChange, variant = "full" }: PaginationProps) {
  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  // Generar números de página a mostrar (máximo 5 alrededor de la actual)
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    const startPage = Math.max(2, page - 1);
    const endPage = Math.min(totalPages - 1, page + 1);
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  // ── Botones redondos sueltos (compartidos por ambas variantes) ──
  // Botones de avance redondos (size-6, rounded-md, border individual)
  // + números de página redondos en el medio
  const controls = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onPageChange(1)}
        className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        title="Primera página"
      >
        <ChevronsLeft className="size-3.5" />
      </button>
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onPageChange(page - 1)}
        className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        title="Página anterior"
      >
        <ChevronLeft className="size-3.5" />
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={cn(
              "flex size-6 items-center justify-center rounded-md border text-[11px] font-medium transition-colors",
              p === page
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChange(page + 1)}
        className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        title="Página siguiente"
      >
        <ChevronRight className="size-3.5" />
      </button>
      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChange(totalPages)}
        className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        title="Última página"
      >
        <ChevronsRight className="size-3.5" />
      </button>
    </div>
  );

  // Variante "controls": botones redondos sueltos + contador "X registros"
  // en el CENTRO de la botonera (entre avance y retroceso), tipografía pequeña,
  // ocupando el mismo alto que la botonera sola.
  // Estructura: [⏮ ◀]  50 registros  [1 2 3 ▶ ⏭]
  if (variant === "controls") {
    // Separar los botones: primeros 2 (⏮ ◀) van a la izquierda,
    // el resto ([1 2 3] ▶ ⏭) va a la derecha.
    const prevButtons = (
      <>
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(1)}
          className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
          title="Primera página"
        >
          <ChevronsLeft className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
          title="Página anterior"
        >
          <ChevronLeft className="size-3.5" />
        </button>
      </>
    );
    const nextButtons = (
      <>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "flex size-6 items-center justify-center rounded-md border text-[11px] font-medium transition-colors",
                p === page
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
          title="Página siguiente"
        >
          <ChevronRight className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(totalPages)}
          className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
          title="Última página"
        >
          <ChevronsRight className="size-3.5" />
        </button>
      </>
    );
    return (
      <div className="inline-flex flex-col items-center gap-1 py-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          {prevButtons}
          {nextButtons}
        </div>
        <span className="w-full text-center text-[9px] text-muted-foreground/60 tabular-nums leading-none">
          {total} registro{total !== 1 ? "s" : ""}
        </span>
      </div>
    );
  }

  // Variante "full" (default): texto + selector + botones
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>
          Mostrando <span className="font-medium text-foreground">{start}-{end}</span> de{" "}
          <span className="font-medium text-foreground">{total}</span> registro{total !== 1 ? "s" : ""}
        </span>

        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-6 rounded-md border border-border bg-background px-1 text-[11px] text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary"
            title="Registros por página"
          >
            {APP_CONFIG.pagination.pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt} / pág</option>
            ))}
          </select>
        )}
      </div>

      {controls}
    </div>
  );
}
