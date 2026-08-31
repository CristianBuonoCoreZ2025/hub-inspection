"use client";

// ═══════════════════════════════════════════════════════════════
// Store de siniestros visitados recientemente (localStorage).
// Mantiene hasta 50 entradas ordenadas del mas reciente al mas
// antiguo. Cada entrada: { id, claimNumber, insuredName, visitedAt }.
//
// IMPORTANTE: useSyncExternalStore requiere que getSnapshot devuelva
// la MISMA referencia si los datos no cambiaron. Por eso cacheamos
// el array y solo creamos uno nuevo cuando el contenido cambia.
// ═══════════════════════════════════════════════════════════════

const RECENT_KEY = "claimshub-recent-claims";
const MAX_RECENTS = 50;

export interface RecentClaimEntry {
  id: string;
  liquidationNumber: string | null;
  clientReference: string | null;
  insuredName: string | null;
  businessLineName: string | null;
  claimTypeIcon: string | null;
  countryCode: string | null;
  visitedAt: number; // epoch ms
}

const listeners = new Set<() => void>();

// ── Cache del snapshot para estabilidad referencial ──
let cachedRaw: string | null = null;
let cachedSnapshot: RecentClaimEntry[] = [];

const EMPTY: RecentClaimEntry[] = [];

function notify() {
  listeners.forEach((l) => l());
}

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(RECENT_KEY);
  } catch {
    return null;
  }
}

function parseRaw(raw: string | null): RecentClaimEntry[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.slice(0, MAX_RECENTS);
  } catch {
    return EMPTY;
  }
}

export function getRecentClaimsSnapshot(): RecentClaimEntry[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = readRaw();
  // Si el contenido de localStorage no cambio, devolver el cache
  if (raw === cachedRaw) return cachedSnapshot;
  // Cambio: parsear y cachear nueva referencia
  cachedRaw = raw;
  cachedSnapshot = parseRaw(raw);
  return cachedSnapshot;
}

export function getRecentClaimsServerSnapshot(): RecentClaimEntry[] {
  return EMPTY;
}

export function subscribeRecentClaims(callback: () => void): () => void {
  listeners.add(callback);
  const storageHandler = (e: StorageEvent) => {
    if (e.key === RECENT_KEY) callback();
  };
  window.addEventListener("storage", storageHandler);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", storageHandler);
  };
}

/**
 * Registra una visita a un siniestro. Si ya existia, lo mueve al
 * principio y actualiza sus datos. Mantiene maximo MAX_RECENTS.
 */
export function recordRecentClaim(entry: Omit<RecentClaimEntry, "visitedAt"> & { visitedAt?: number }) {
  if (typeof window === "undefined") return;
  try {
    const current = parseRaw(readRaw());
    const visitedAt = entry.visitedAt ?? Date.now();
    const without = current.filter((c) => c.id !== entry.id);
    const next = [{ ...entry, visitedAt }, ...without].slice(0, MAX_RECENTS);
    const serialized = JSON.stringify(next);
    localStorage.setItem(RECENT_KEY, serialized);
    // Actualizar cache inmediatamente para que el siguiente
    // getSnapshot devuelva la nueva referencia sin re-parsear
    cachedRaw = serialized;
    cachedSnapshot = next;
    notify();
  } catch {}
}

/**
 * Elimina un siniestro de la lista de recientes.
 */
export function removeRecentClaim(id: string) {
  if (typeof window === "undefined") return;
  try {
    const current = parseRaw(readRaw());
    const next = current.filter((c) => c.id !== id);
    const serialized = JSON.stringify(next);
    localStorage.setItem(RECENT_KEY, serialized);
    cachedRaw = serialized;
    cachedSnapshot = next;
    notify();
  } catch {}
}

/**
 * Limpia toda la lista de recientes.
 */
export function clearRecentClaims() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_KEY);
    cachedRaw = null;
    cachedSnapshot = EMPTY;
    notify();
  } catch {}
}
