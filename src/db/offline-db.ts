"use client";

import Dexie, { type Table } from "dexie";
import type {
  InspectionSession,
  InspectionDamage,
  InspectionEvidence,
  InspectionSignature,
  DamageSketch,
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
  /** Hash bcrypt del password para validar login offline */
  password_hash: string;
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
    field_config: Record<string, unknown> | null;
  }[];
  housing_destinations: { id: string; name: string }[];
  building_ages: { id: string; name: string; min_years: number | null; max_years: number | null }[];
  damage_spaces: { id: string; name: string; applicable_classifications: string[] | null }[];
  content_good_types: { id: string; name: string; requires_detail: boolean }[];
  content_good_products: { id: string; name: string; content_good_type_id: string }[];
  content_good_brands: { id: string; name: string }[];
  currencies: { id: string; code: string; name: string; symbol: string | null }[];
  damage_classifications: { id: string; name: string; severity: string }[];
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
  /** Catálogos cacheados */
  catalogs: OfflineCatalogs;
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

// ─────────────────────────────────────────────────────────────────────
// Esquema de la DB
// ─────────────────────────────────────────────────────────────────────

class OfflineDB extends Dexie {
  sessions!: Table<OfflineSession, string>;
  profiles!: Table<OfflineProfile, string>;

  constructor() {
    super("claimshub-offline");
    this.version(1).stores({
      sessions: "id, sessionId, inspectorId, syncStatus, expires_at",
      profiles: "id, email, expires_at",
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
