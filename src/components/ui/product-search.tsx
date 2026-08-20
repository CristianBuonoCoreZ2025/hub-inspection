"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Search, X, Package } from "lucide-react";

export interface ProductSearchItem {
  id: string;
  name: string;
  content_good_type_id: string;
  content_good_type?: { id: string; name: string } | null;
}

interface ProductSearchProps {
  products: ProductSearchItem[];
  selectedProductId?: string;
  selectedLabel?: string;
  onSelect: (product: ProductSearchItem) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

// Normaliza string: minúsculas, sin acentos, sin espacios extra
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Resalta las ocurrencias del query dentro del texto
function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const normText = normalize(text);
  const normQuery = normalize(query);
  const idx = normText.indexOf(normQuery);
  if (idx === -1) return text;
  // Mapear índice normalizado al texto original (longitudes coinciden tras normalize NFD solo si no había acentos)
  // Para simplicidad, usar el índice del texto original (funciona en la mayoría de casos)
  const realIdx = text.toLowerCase().indexOf(normQuery);
  if (realIdx === -1) return text;
  return (
    <>
      {text.slice(0, realIdx)}
      <mark className="bg-yellow-200/80 text-foreground rounded px-0.5">
        {text.slice(realIdx, realIdx + normQuery.length)}
      </mark>
      {text.slice(realIdx + normQuery.length)}
    </>
  );
}

export function ProductSearch({
  products,
  selectedProductId,
  selectedLabel,
  onSelect,
  onClear,
  placeholder = "Buscar producto... (ej: com, ref, lav)",
  disabled = false,
  autoFocus = false,
}: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Si hay un producto seleccionado, mostrar su label
  const displayValue = selectedProductId ? (selectedLabel || "") : query;

  // Filtrar productos por query (busca en nombre de producto Y nombre del tipo)
  const filtered = useMemo(() => {
    if (!query.trim() || selectedProductId) return [];
    const q = normalize(query);
    if (q.length < 2) return []; // Requiere al menos 2 caracteres

    const scored = products
      .map((p) => {
        const pName = normalize(p.name);
        const tName = normalize(p.content_good_type?.name || "");
        // Score: match al inicio del producto > match en medio del producto > match en tipo
        let score = 0;
        const pIdx = pName.indexOf(q);
        if (pIdx === 0) score = 100;
        else if (pIdx > 0) score = 50;
        else if (tName.includes(q)) score = 20;
        return { item: p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    return scored.map((x) => x.item);
  }, [products, query, selectedProductId]);

  // Reset active index cuando cambia el query (en el handler, no en effect)
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    setActiveIndex(0);
    setOpen(true);
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Scroll al item activo
  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector(`[data-idx="${activeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const handleSelect = useCallback(
    (product: ProductSearchItem) => {
      onSelect(product);
      setQuery("");
      setOpen(false);
      setActiveIndex(0);
    },
    [onSelect]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) {
      if (e.key === "ArrowDown" && query.trim().length >= 2) {
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) handleSelect(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setOpen(false);
    onClear?.();
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Modo "seleccionado": muestra el label + botón X
  if (selectedProductId) {
    return (
      <div ref={wrapRef} className="relative w-full">
        <div className="app-input h-7 w-full flex items-center gap-2 px-2 bg-muted/30">
          <Package className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-[11px] flex-1 truncate">{displayValue}</span>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 rounded p-0.5 hover:bg-muted"
              aria-label="Limpiar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Modo "buscando": input + dropdown
  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          autoFocus={autoFocus}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="app-input ps-input-with-icon h-7 w-full"
        />
      </div>

      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-9999 mt-1 w-full max-h-70 overflow-y-auto rounded-md border border-border bg-popover shadow-md"
          style={{ position: "fixed" }}
        >
          {filtered.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              data-idx={idx}
              onClick={() => handleSelect(p)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`w-full text-left px-2.5 py-1.5 flex items-start gap-2 border-b border-border/50 last:border-0 ${
                idx === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              }`}
            >
              <Package className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium leading-tight">
                  {highlight(p.name, query)}
                </div>
                {p.content_good_type?.name && (
                  <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                    {highlight(p.content_good_type.name, query)}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && filtered.length === 0 && (
        <div
          className="absolute z-9999 mt-1 w-full rounded-md border border-border bg-popover shadow-md px-3 py-2 text-[11px] text-muted-foreground"
          style={{ position: "fixed" }}
        >
          Sin resultados. Probá con otras letras.
        </div>
      )}
    </div>
  );
}
