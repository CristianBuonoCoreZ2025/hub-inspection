"use client";

import { useEffect, useState } from "react";
import {
  getSnapshot,
  resetMetrics,
  subscribe,
  type PerfSnapshot,
} from "@/lib/perf-metrics";
import { ActivityIcon, XIcon, RotateCcwIcon, ChevronDownIcon } from "lucide-react";

/**
 * PerfPanel — panel flotante de métricas de rendimiento.
 *
 * Solo se monta en development (NODE_ENV !== "production").
 * Botón flotante abajo a la derecha; al click abre un panel con:
 *  - Total de consultas y errores
 *  - Top 10 consultas más lentas (por avg)
 *  - Lista completa de agregados (tabla, op, count, avg, p95, max, errores)
 *  - Últimas 200 consultas individuales
 *  - Botón reset
 */
export function PerfPanel() {
  // Usamos useState + useEffect + subscribe en lugar de useSyncExternalStore
  // porque getSnapshot() retorna un objeto nuevo cada vez, lo que causa
  // "Maximum update depth exceeded" con useSyncExternalStore (requiere
  // estabilidad referencial estricta). Con useState controlamos nosotros
  // cuándo re-renderizar (solo cuando el suscriptor notifica).
  const [snapshot, setSnapshot] = useState<PerfSnapshot>(() => getSnapshot());
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"slowest" | "all" | "recent">("slowest");

  useEffect(() => {
    // Suscribirse a cambios y actualizar el estado local
    const unsub = subscribe(() => setSnapshot(getSnapshot()));
    return unsub;
  }, []);

  // Atajo de teclado: Ctrl+Shift+P abre/cierra el panel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Métricas de rendimiento"
        title="Métricas (Ctrl+Shift+P)"
        className="pg-btn-platinum"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 10000,
          width: 40,
          height: 40,
          padding: 0,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <ActivityIcon className="size-4" />
        {snapshot.totalQueries > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              fontSize: 9,
              fontWeight: 600,
              borderRadius: 999,
              padding: "1px 5px",
              minWidth: 14,
              textAlign: "center",
            }}
          >
            {snapshot.totalQueries}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Métricas de rendimiento"
          className="cn-perf-panel"
          style={{
            position: "fixed",
            right: 16,
            bottom: 64,
            zIndex: 10000,
            width: "min(640px, calc(100vw - 32px))",
            maxHeight: "min(70vh, 600px)",
            display: "flex",
            flexDirection: "column",
            background: "var(--popover)",
            color: "var(--popover-foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ActivityIcon className="size-4" />
              <span className="app-section-title" style={{ textTransform: "capitalize" }}>
                Métricas De Consultas
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => resetMetrics()}
                title="Resetear métricas"
                className="pg-btn-platinum"
                style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
              >
                <RotateCcwIcon className="size-3" />
                <span style={{ textTransform: "capitalize" }}>Reset</span>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="pg-btn-platinum"
                style={{ padding: 4, display: "flex", alignItems: "center" }}
              >
                <XIcon className="size-4" />
              </button>
            </div>
          </div>

          {/* Resumen */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
              padding: "10px 14px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <Stat label="Consultas" value={snapshot.totalQueries} />
            <Stat label="Errores" value={snapshot.totalErrors} />
            <Stat
              label="Consultas lentas (>500ms)"
              value={snapshot.recent.filter((r) => r.durationMs > 500).length}
            />
            <Stat label="Tables" value={snapshot.aggregates.length} />
          </div>

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: "6px 14px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <TabBtn active={tab === "slowest"} onClick={() => setTab("slowest")}>
              Más lentas
            </TabBtn>
            <TabBtn active={tab === "all"} onClick={() => setTab("all")}>
              Todas
            </TabBtn>
            <TabBtn active={tab === "recent"} onClick={() => setTab("recent")}>
              Recientes
            </TabBtn>
          </div>

          {/* Contenido */}
          <div style={{ overflow: "auto", flex: 1, padding: "8px 14px" }}>
            {tab === "slowest" && <SlowestTable snapshot={snapshot} />}
            {tab === "all" && <AllTable snapshot={snapshot} />}
            {tab === "recent" && <RecentList snapshot={snapshot} />}
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        className="app-data-label"
        style={{ textTransform: "capitalize", color: "var(--muted-foreground)" }}
      >
        {label}
      </span>
      <span style={{ fontSize: 16, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pg-btn-platinum"
      style={{
        padding: "4px 10px",
        opacity: active ? 1 : 0.6,
        background: active ? "var(--accent)" : undefined,
        textTransform: "capitalize",
      }}
    >
      {children}
    </button>
  );
}

function SlowestTable({ snapshot }: { snapshot: PerfSnapshot }) {
  if (snapshot.slowestAggregates.length === 0) {
    return <EmptyState text="Aún no hay suficientes datos (mínimo 3 muestras por consulta)" />;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
      <thead>
        <tr style={{ textAlign: "left", color: "var(--muted-foreground)" }}>
          <Th>Tabla</Th>
          <Th>Op</Th>
          <Th align="right">Count</Th>
          <Th align="right">Avg</Th>
          <Th align="right">P95</Th>
          <Th align="right">Max</Th>
          <Th align="right">Errores</Th>
        </tr>
      </thead>
      <tbody>
        {snapshot.slowestAggregates.map((a) => (
          <tr key={a.key} style={{ borderBottom: "1px solid var(--border)" }}>
            <Td>
              <span style={{ fontWeight: 500 }}>{a.tableName}</span>
            </Td>
            <Td>
              <code style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{a.operation}</code>
            </Td>
            <Td align="right">{a.count}</Td>
            <Td align="right">
              <DurationCell ms={a.avgMs} />
            </Td>
            <Td align="right">
              <DurationCell ms={a.p95Ms} />
            </Td>
            <Td align="right">
              <DurationCell ms={a.maxMs} />
            </Td>
            <Td align="right">
              {a.errorCount > 0 ? (
                <span style={{ color: "var(--destructive)" }}>{a.errorCount}</span>
              ) : (
                <span style={{ color: "var(--muted-foreground)" }}>0</span>
              )}
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AllTable({ snapshot }: { snapshot: PerfSnapshot }) {
  if (snapshot.aggregates.length === 0) {
    return <EmptyState text="Aún no hay consultas registradas" />;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
      <thead>
        <tr style={{ textAlign: "left", color: "var(--muted-foreground)" }}>
          <Th>Tabla</Th>
          <Th>Op</Th>
          <Th align="right">Count</Th>
          <Th align="right">Avg</Th>
          <Th align="right">P95</Th>
          <Th align="right">Max</Th>
          <Th align="right">Total</Th>
          <Th align="right">Errores</Th>
        </tr>
      </thead>
      <tbody>
        {snapshot.aggregates.map((a) => (
          <tr key={a.key} style={{ borderBottom: "1px solid var(--border)" }}>
            <Td>
              <span style={{ fontWeight: 500 }}>{a.tableName}</span>
            </Td>
            <Td>
              <code style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{a.operation}</code>
            </Td>
            <Td align="right">{a.count}</Td>
            <Td align="right">
              <DurationCell ms={a.avgMs} />
            </Td>
            <Td align="right">
              <DurationCell ms={a.p95Ms} />
            </Td>
            <Td align="right">
              <DurationCell ms={a.maxMs} />
            </Td>
            <Td align="right">{a.totalMs}ms</Td>
            <Td align="right">
              {a.errorCount > 0 ? (
                <span style={{ color: "var(--destructive)" }}>{a.errorCount}</span>
              ) : (
                <span style={{ color: "var(--muted-foreground)" }}>0</span>
              )}
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RecentList({ snapshot }: { snapshot: PerfSnapshot }) {
  if (snapshot.recent.length === 0) {
    return <EmptyState text="Aún no hay consultas recientes" />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {snapshot.recent.map((r, i) => (
        <div
          key={`${r.timestamp}-${i}`}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            gap: 8,
            alignItems: "center",
            padding: "4px 0",
            borderBottom: "1px solid var(--border)",
            fontSize: 11,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.tableName}
            </span>
            <code style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{r.operation}</code>
            {r.route && (
              <span
                className="app-data-label"
                style={{ color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {r.route}
              </span>
            )}
          </div>
          <DurationCell ms={r.durationMs} />
          {r.success ? (
            <span style={{ color: "var(--muted-foreground)", fontSize: 10 }}>ok</span>
          ) : (
            <span style={{ color: "var(--destructive)", fontSize: 10 }} title={r.errorMessage}>
              err
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 20,
        textAlign: "center",
        color: "var(--muted-foreground)",
        fontSize: 11,
      }}
    >
      {text}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "4px 6px",
        fontSize: 10,
        fontWeight: 600,
        textTransform: "capitalize",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return <td style={{ textAlign: align, padding: "4px 6px" }}>{children}</td>;
}

function DurationCell({ ms }: { ms: number }) {
  const color =
    ms > 1000
      ? "var(--destructive)"
      : ms > 500
      ? "var(--warning, #f59e0b)"
      : ms > 200
      ? "var(--primary)"
      : "var(--muted-foreground)";
  return (
    <span style={{ color, fontWeight: ms > 500 ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>
      {ms}ms
    </span>
  );
}

// Silenciar warning de import no usado (ChevronDownIcon reservado para futuro colapso)
void ChevronDownIcon;
