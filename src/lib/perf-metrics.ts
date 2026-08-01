/**
 * perf-metrics.ts
 *
 * Sistema de métricas de rendimiento para consultas a Supabase.
 *
 * - Mide cada consulta (tabla, operación, duración, éxito/error) en memoria.
 * - Mantiene agregados (count, min, max, avg, p95) por (tabla, operación).
 * - Persiste en la tabla query_audit_log (Supabase) en batches para no
 *   agregar overhead por cada consulta.
 * - Expone un snapshot para que el panel flotante lo lea.
 *
 * Uso desde db.ts:
 *   const end = startMeasure("claim_actions", "select_one");
 *   try { ... } finally { end({ rowsAffected: 1 }); }
 *
 * Nota: NO se marca "use client" porque db.ts se importa desde server y client.
 * Los guards `typeof window !== "undefined"` manejan la diferencia de entorno.
 * El panel flotante (client) usa getSnapshot/subscribe; el server solo usa
 * startMeasure que es seguro en ambos contextos (performance.now existe en ambos).
 */

// ──────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────

export type DbOperation =
  | "select_one"
  | "select_all"
  | "insert"
  | "upsert"
  | "update"
  | "delete"
  | "rpc";

interface MetricEntry {
  tableName: string;
  operation: DbOperation;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  rowsAffected?: number;
  route?: string;
  timestamp: number;
}

interface Aggregate {
  key: string;                  // `${tableName}::${operation}`
  tableName: string;
  operation: DbOperation;
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  errorCount: number;
  durations: number[];          // para p95 (ring buffer de últimas 200)
}

// ──────────────────────────────────────────────────────────────────
// Estado en memoria
// ──────────────────────────────────────────────────────────────────

const SESSION_ID =
  typeof window !== "undefined"
    ? `s-${Math.random().toString(36).slice(2, 10)}`
    : "ssr";

const aggregates = new Map<string, Aggregate>();
const recentEntries: MetricEntry[] = [];
const MAX_RECENT = 200;
const MAX_DURATIONS = 200;

// Cola de logs pendientes para enviar a BD
const pendingLogs: Array<Omit<MetricEntry, "timestamp"> & { timestamp: string }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 5000;     // cada 5s
const FLUSH_BATCH_SIZE = 50;        // máximo 50 por flush

// Suscriptores (panel flotante) para re-render en vivo
type Listener = () => void;
const listeners = new Set<Listener>();
const isProduction = process.env.NODE_ENV === "production";
const SLOW_THRESHOLD_MS = 500;

// ──────────────────────────────────────────────────────────────────
// API pública
// ──────────────────────────────────────────────────────────────────

/**
 * Inicia la medición de una consulta. Retorna una función para finalizarla.
 *
 * Ejemplo:
 *   const end = startMeasure("claim_actions", "select_one");
 *   try { ... } finally { end({ rowsAffected: 1 }); }
 */
export function startMeasure(tableName: string, operation: DbOperation) {
  const start = performance.now();
  const route = typeof window !== "undefined" ? window.location.pathname : undefined;

  return function end(opts: {
    success?: boolean;
    errorMessage?: string;
    rowsAffected?: number;
  } = {}) {
    const durationMs = Math.round(performance.now() - start);
    record({
      tableName,
      operation,
      durationMs,
      success: opts.success ?? true,
      errorMessage: opts.errorMessage,
      rowsAffected: opts.rowsAffected,
      route,
      timestamp: Date.now(),
    });
  };
}

function record(entry: MetricEntry) {
  // 1. Agregar a agregados
  const key = `${entry.tableName}::${entry.operation}`;
  let agg = aggregates.get(key);
  if (!agg) {
    agg = {
      key,
      tableName: entry.tableName,
      operation: entry.operation,
      count: 0,
      totalMs: 0,
      minMs: Infinity,
      maxMs: 0,
      errorCount: 0,
      durations: [],
    };
    aggregates.set(key, agg);
  }
  agg.count++;
  agg.totalMs += entry.durationMs;
  if (entry.durationMs < agg.minMs) agg.minMs = entry.durationMs;
  if (entry.durationMs > agg.maxMs) agg.maxMs = entry.durationMs;
  if (!entry.success) agg.errorCount++;
  agg.durations.push(entry.durationMs);
  if (agg.durations.length > MAX_DURATIONS) agg.durations.shift();

  // 2. Agregar a entradas recientes
  recentEntries.unshift(entry);
  if (recentEntries.length > MAX_RECENT) recentEntries.pop();

  // 3. Encolar para persistencia en BD:
  //    - En dev/staging: todas
  //    - En producción: solo errores o queries lentas (>= 500ms)
  const shouldPersist = !isProduction || !entry.success || entry.durationMs >= SLOW_THRESHOLD_MS;
  if (shouldPersist) {
    pendingLogs.push({
      tableName: entry.tableName,
      operation: entry.operation,
      durationMs: entry.durationMs,
      success: entry.success,
      errorMessage: entry.errorMessage,
      rowsAffected: entry.rowsAffected,
      route: entry.route,
      timestamp: new Date(entry.timestamp).toISOString(),
    });
    scheduleFlush();
  }

  notifyListeners();
}

// ──────────────────────────────────────────────────────────────────
// Persistencia a BD (batched, fire-and-forget)
// ──────────────────────────────────────────────────────────────────

function scheduleFlush() {
  if (flushTimer) return;
  if (pendingLogs.length >= FLUSH_BATCH_SIZE) {
    void flushToDb();
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushToDb();
  }, FLUSH_INTERVAL_MS);
}

async function flushToDb() {
  if (pendingLogs.length === 0) return;
  if (typeof window === "undefined") return; // solo en browser

  const batch = pendingLogs.splice(0, FLUSH_BATCH_SIZE);
  if (batch.length === 0) return;

  try {
    // Import dinámico para evitar circular dep con db.ts
    const { getSupabaseClient } = await import("./supabase/client");
    const supabase = getSupabaseClient();
    const rows = batch.map((b) => ({
      table_name: b.tableName,
      operation: b.operation,
      duration_ms: b.durationMs,
      success: b.success,
      error_message: b.errorMessage ?? null,
      rows_affected: b.rowsAffected ?? null,
      session_id: SESSION_ID,
      route: b.route ?? null,
      created_at: b.timestamp,
    }));
    // Insert sin await para no bloquear — fire-and-forget real
    void supabase.from("query_audit_log").insert(rows).then(
      (res: { error: { message: string } | null }) => {
        if (res.error) {
          // Silenciar: telemetría no debe romper la app
          console.warn("[perf-metrics] flush error:", res.error.message);
        }
      },
      (err: unknown) => console.warn("[perf-metrics] flush exception:", err)
    );
  } catch (err) {
    console.warn("[perf-metrics] flush setup error:", err);
  }
}

// ──────────────────────────────────────────────────────────────────
// Lectura (para el panel flotante)
// ──────────────────────────────────────────────────────────────────

export interface PerfSnapshot {
  aggregates: Array<Aggregate & { avgMs: number; p95Ms: number }>;
  recent: MetricEntry[];
  totalQueries: number;
  totalErrors: number;
  slowestAggregates: Array<Aggregate & { avgMs: number; p95Ms: number }>;
}

export function getSnapshot(): PerfSnapshot {
  const aggs = Array.from(aggregates.values()).map((a) => {
    const avgMs = a.count > 0 ? Math.round(a.totalMs / a.count) : 0;
    const p95Ms = computeP95(a.durations);
    return { ...a, avgMs, p95Ms };
  });

  const totalQueries = aggs.reduce((s, a) => s + a.count, 0);
  const totalErrors = aggs.reduce((s, a) => s + a.errorCount, 0);

  // Top 10 más lentos por avg
  const slowest = [...aggs]
    .filter((a) => a.count >= 3) // ignorar outliers de 1-2 muestras
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 10);

  return {
    aggregates: aggs.sort((a, b) => b.count - a.count),
    recent: [...recentEntries],
    totalQueries,
    totalErrors,
    slowestAggregates: slowest,
  };
}

function computeP95(durations: number[]): number {
  if (durations.length === 0) return 0;
  const sorted = [...durations].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * 0.95)
  );
  return sorted[idx];
}

export function resetMetrics() {
  aggregates.clear();
  recentEntries.length = 0;
  pendingLogs.length = 0;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  notifyListeners();
}


// ──────────────────────────────────────────────────────────────────
// Suscripción (para re-render del panel en vivo)
// ──────────────────────────────────────────────────────────────────

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  for (const l of listeners) {
    try { l(); } catch { /* ignore */ }
  }
}

// Flush al cerrar la página
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    void flushToDb();
  });
}
