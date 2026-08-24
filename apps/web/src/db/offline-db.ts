"use client";

import Dexie, { type Table } from "dexie";
import type {
  InspectionSession,
  InspectionDamage,
  UserRole,
} from "@/types";
import type { SessionDetail } from "@/services/inspections";

// ─────────────────────────────────────────────────────────────────────
// Tipos para almacenamiento offline
// ─────────────────────────────────────────────────────────────────────

/** Profile mínimo guardado offline para autenticación sin conexión */
export interface OfflineProfile {
  id: string; // = profile.id
  user_id: string; // = supabase user id
  email: string;
  full_name: string;
  role: UserRole;
  company_id: string | null;
  company_name: string | null;
  company_logo_url: string | null;
  mobile_enabled: boolean;
  /** Hash bcrypt del PIN para validar login offline */
  pin_hash: string;
  /** Fecha de expiración del cache (10 días) */
  expires_at: string;
  downloaded_at: string;
}

/** Catálogos necesarios para el acta y daños offline */
export interface OfflineCatalogs {
  // lookup_catalog items agrupados por categoría
  lookup_catalog: Record<string, { id: string; code: string; name: string }[]>;
  // Catálogos independientes
  property_classifications: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    field_config?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }[];
  housing_destinations: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    field_config?: Record<string, unknown>;
    destination_type?: "residential" | "commercial" | null;
    created_at: string;
    updated_at: string;
  }[];
  building_ages: {
    id: string;
    name: string;
    min_years?: number | null;
    max_years?: number | null;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  }[];
  damage_spaces: { id: string; name: string; applicable_classifications: string[] | null }[];
  content_good_types: { id: string; name: string; requires_detail: boolean }[];
  content_good_products: { id: string; name: string; content_good_type_id: string }[];
  content_good_brands: { id: string; name: string }[];
  content_good_type_brands: { id: string; content_good_type_id: string; brand_id: string; brand?: { id: string; name: string } | null }[];
  currencies: { id: string; code: string; name: string; symbol: string | null }[];
  damage_classifications: { id: string; name: string; code: string }[];
  classification_destinations: { id: string; classification_id: string; destination_id: string; created_at: string }[];
  country_currencies: { id: string; code: string; name: string; symbol: string | null }[];
}

/** Foto/evidencia pendiente de subir */
export interface PendingEvidence {
  localId: string; // ID temporal generado offline
  blob: Blob; // Archivo binario
  type: "photo" | "video" | "document";
  source: string;
  damageId: string | null;
  documentType: string | null;
  description: string | null;
  capturedAt: string;
  lat: number | null;
  lng: number | null;
}

/** Firma pendiente de subir */
export interface PendingSignature {
  localId: string;
  blob: Blob;
  role: "insured" | "adjuster";
  capturedAt: string;
}

/** Croquis pendiente de subir */
export interface PendingSketch {
  localId: string;
  blob: Blob;
  label: string | null;
  capturedAt: string;
}

/** Cambios pendientes de sincronizar */
export interface PendingChanges {
  /** Campos del acta modificados offline */
  acta: Partial<InspectionSession> | null;
  /** Daños creados offline (sin ID de DB todavía) */
  damagesCreated: InspectionDamage[];
  /** Daños modificados offline */
  damagesUpdated: InspectionDamage[];
  /** IDs de daños eliminados offline */
  damagesDeleted: string[];
  /** Evidencias pendientes de subir */
  evidences: PendingEvidence[];
  /** IDs de evidencias existentes eliminadas offline */
  evidencesDeleted: string[];
  /** Firmas pendientes de subir */
  signatures: PendingSignature[];
  /** IDs de firmas existentes eliminadas offline */
  signaturesDeleted: string[];
  /** Croquis pendientes de subir */
  sketches: PendingSketch[];
}

/** Sesión descargada para uso offline */
export interface OfflineSession {
  id: string; // = session.id
  sessionId: string;
  inspectorId: string;
  /** Snapshot completo de la sesión al momento de descargar */
  session: SessionDetail;
  /** Cambios pendientes de sincronizar */
  pending: PendingChanges;
  /** Estado de sincronización */
  syncStatus: "pending" | "syncing" | "synced" | "error" | "never";
  /** Fecha de descarga */
  downloaded_at: string;
  /** Fecha de expiración (10 días) */
  expires_at: string;
  /** Última sincronización */
  last_synced_at: string | null;
  /** Error de sincronización si falló */
  sync_error: string | null;
}

/** Registro global de catálogos (una sola fila en IndexedDB) */
export interface GlobalCatalogs {
  id: "global"; // siempre "global"
  catalogs: OfflineCatalogs;
  downloaded_at: string;
}

// ─────────────────────────────────────────────────────────────────────
// Esquema de la DB
// ─────────────────────────────────────────────────────────────────────

class OfflineDB extends Dexie {
  sessions!: Table<OfflineSession, string>;
  profiles!: Table<OfflineProfile, string>;
  catalogs!: Table<GlobalCatalogs, string>;
  evidenceBlobs!: Table<{ id: string; blob: Blob }, string>;

  constructor() {
    super("claimshub-offline");
    this.version(1).stores({
      sessions: "id, sessionId, inspectorId, syncStatus, expires_at",
      profiles: "id, email, expires_at",
    });
    // v2: agregar tabla global de catálogos + remover catalogs de sessions
    this.version(2).stores({
      sessions: "id, sessionId, inspectorId, syncStatus, expires_at",
      profiles: "id, email, expires_at",
      catalogs: "id",
    });
    // v3: agregar tabla de blobs de evidencias para offline
    this.version(3).stores({
      sessions: "id, sessionId, inspectorId, syncStatus, expires_at",
      profiles: "id, email, expires_at",
      catalogs: "id",
      evidenceBlobs: "id",
    });
  }
}

// Singleton — una sola instancia en todo el cliente
let dbInstance: OfflineDB | null = null;

export function getOfflineDB(): OfflineDB {
  if (typeof window === "undefined") {
    throw new Error("OfflineDB solo está disponible en el cliente");
  }
  if (!dbInstance) {
    dbInstance = new OfflineDB();
  }
  return dbInstance;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/** Crea la estructura vacía de cambios pendientes */
export function emptyPendingChanges(): PendingChanges {
  return {
    acta: null,
    damagesCreated: [],
    damagesUpdated: [],
    damagesDeleted: [],
    evidences: [],
    evidencesDeleted: [],
    signatures: [],
    signaturesDeleted: [],
    sketches: [],
  };
}

export function mergeInspectionDamages(
  sources: readonly (readonly InspectionDamage[] | null | undefined)[],
  pending?: Pick<PendingChanges, "damagesCreated" | "damagesUpdated" | "damagesDeleted"> | null,
): InspectionDamage[] {
  const merged = new Map<string, InspectionDamage>();

  const upsertNewest = (damage: InspectionDamage, preferIncoming = false) => {
    const current = merged.get(damage.id);
    if (!current) {
      merged.set(damage.id, damage);
      return;
    }

    const currentTime = Date.parse(current.updated_at || current.created_at || "") || 0;
    const incomingTime = Date.parse(damage.updated_at || damage.created_at || "") || 0;
    if (preferIncoming || incomingTime >= currentTime) {
      merged.set(damage.id, { ...current, ...damage });
    }
  };

  for (const source of sources) {
    for (const damage of source ?? []) upsertNewest(damage);
  }
  for (const damage of pending?.damagesCreated ?? []) upsertNewest(damage, true);
  for (const damage of pending?.damagesUpdated ?? []) upsertNewest(damage, true);
  for (const id of pending?.damagesDeleted ?? []) merged.delete(id);

  return [...merged.values()].sort((a, b) => {
    const aTime = Date.parse(a.updated_at || a.created_at || "") || 0;
    const bTime = Date.parse(b.updated_at || b.created_at || "") || 0;
    return bTime - aTime;
  });
}

/** Verifica si hay cambios pendientes en una sesión */
export function hasPendingChanges(pending: PendingChanges): boolean {
  return (
    pending.acta !== null ||
    pending.damagesCreated.length > 0 ||
    pending.damagesUpdated.length > 0 ||
    pending.damagesDeleted.length > 0 ||
    pending.evidences.length > 0 ||
    pending.evidencesDeleted.length > 0 ||
    pending.signatures.length > 0 ||
    pending.signaturesDeleted.length > 0 ||
    pending.sketches.length > 0
  );
}

/** Cuenta total de cambios pendientes (para mostrar badge) */
export function countPendingChanges(pending: PendingChanges): number {
  return (
    (pending.acta ? 1 : 0) +
    pending.damagesCreated.length +
    pending.damagesUpdated.length +
    pending.damagesDeleted.length +
    pending.evidences.length +
    pending.evidencesDeleted.length +
    pending.signatures.length +
    pending.signaturesDeleted.length +
    pending.sketches.length
  );
}

/** Fecha de expiración: 10 días desde ahora */
export function getExpirationDate(days = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Verifica si una sesión descargada ha expirado */
export function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

/** Días restantes antes de expirar */
export function daysUntilExpiration(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// ─────────────────────────────────────────────────────────────────────
// Catálogos globales (compartidos entre todas las inspecciones)
// ─────────────────────────────────────────────────────────────────────

/** Obtiene los catálogos globales de IndexedDB (null si no existen) */
export async function getGlobalCatalogs(): Promise<OfflineCatalogs | null> {
  const db = getOfflineDB();
  const row = await db.catalogs.get("global");
  return row?.catalogs ?? null;
}

/** Obtiene la fecha de descarga de los catálogos globales (null si no existen) */
export async function getGlobalCatalogsDate(): Promise<string | null> {
  const db = getOfflineDB();
  const row = await db.catalogs.get("global");
  return row?.downloaded_at ?? null;
}

/** Guarda los catálogos globales en IndexedDB (una sola fila) */
export async function setGlobalCatalogs(catalogs: OfflineCatalogs): Promise<void> {
  const db = getOfflineDB();
  await db.catalogs.put({
    id: "global",
    catalogs,
    downloaded_at: new Date().toISOString(),
  });
}

/** Verifica si los catálogos globales ya están cacheados */
export async function hasGlobalCatalogs(): Promise<boolean> {
  const db = getOfflineDB();
  const row = await db.catalogs.get("global");
  return !!row && row.catalogs.property_classifications.length > 0;
}

/** Verifica si los catálogos globales son mayores a maxHours horas */
export async function areGlobalCatalogsStale(maxHours = 24): Promise<boolean> {
  const db = getOfflineDB();
  const row = await db.catalogs.get("global");
  if (!row) return true;
  const ageMs = Date.now() - new Date(row.downloaded_at).getTime();
  return ageMs > maxHours * 60 * 60 * 1000;
}
