"use client";

import { getOfflineDB, emptyPendingChanges, getExpirationDate, type OfflineSession, type OfflineCatalogs } from "@/db/offline-db";
import { getInspectionSessionById, updateInspectionSession, type SessionDetail } from "@/services/inspections";
import type { InspectionSession } from "@/types";
import {
  getLookupCatalog,
  getPropertyClassifications,
  getHousingDestinations,
  getBuildingAges,
  getDamageSpaces,
  getContentGoodTypes,
  getContentGoodProducts,
  getContentGoodBrands,
  getDamageClassifications,
  getCurrencies,
} from "@/services/catalogs";

// Categorías de lookup_catalog que necesita el acta
const LOOKUP_CATEGORIES = [
  "interviewed_relationship",
  "materiality_walls",
  "materiality_roof",
  "materiality_flooring",
  "materiality_ceiling",
  "materiality_interior_finish",
  "materiality_exterior_finish",
  "materiality_closure",
  "materiality_other",
];

// ─────────────────────────────────────────────────────────────────────
// Descargar catálogos
// ─────────────────────────────────────────────────────────────────────

async function downloadCatalogs(): Promise<OfflineCatalogs> {
  // Lookup catalog por categoría
  const lookupEntries = await Promise.all(
    LOOKUP_CATEGORIES.map(async (cat) => {
      const items = await getLookupCatalog(cat);
      return [cat, items.map((i) => ({ id: i.id, code: i.code, name: i.name }))] as const;
    }),
  );

  // Catálogos independientes
  const [
    propertyClassifications,
    housingDestinations,
    buildingAges,
    damageSpaces,
    contentGoodTypes,
    contentGoodProducts,
    contentGoodBrands,
    damageClassifications,
    currencies,
  ] = await Promise.all([
    getPropertyClassifications(),
    getHousingDestinations(),
    getBuildingAges(),
    getDamageSpaces(),
    getContentGoodTypes(),
    getContentGoodProducts(),
    getContentGoodBrands(),
    getDamageClassifications(),
    getCurrencies(),
  ]);

  return {
    lookup_catalog: Object.fromEntries(lookupEntries) as OfflineCatalogs["lookup_catalog"],
    property_classifications: propertyClassifications.map((p) => ({
      id: p.id,
      name: p.name,
      field_config: p.field_config ?? null,
    })),
    housing_destinations: housingDestinations.map((h) => ({ id: h.id, name: h.name })),
    building_ages: buildingAges.map((b) => ({
      id: b.id,
      name: b.name,
      min_years: null,
      max_years: null,
    })),
    damage_spaces: damageSpaces.map((d) => ({
      id: d.id,
      name: d.name,
      applicable_classifications: d.applicable_classifications,
    })),
    content_good_types: contentGoodTypes.map((c) => ({
      id: c.id,
      name: c.name,
      requires_detail: c.requires_detail,
    })),
    content_good_products: contentGoodProducts.map((p) => ({
      id: p.id,
      name: p.name,
      content_good_type_id: p.content_good_type_id,
    })),
    content_good_brands: contentGoodBrands.map((b) => ({ id: b.id, name: b.name })),
    currencies: currencies.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      symbol: c.symbol,
    })),
    damage_classifications: damageClassifications.map((d) => ({
      id: d.id,
      name: d.name,
      severity: d.code || d.name,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Descargar inspección completa
// ─────────────────────────────────────────────────────────────────────

/**
 * Descarga una inspección completa para uso offline.
 *
 * 1. Obtiene el snapshot completo de la sesión + catálogos
 * 2. Marca la inspección como activa (bloqueo para otros usuarios)
 * 3. Guarda todo en IndexedDB
 *
 * @param sessionId  ID de la inspección a descargar
 * @param inspectorId  ID del profile del inspector
 * @returns La sesión offline guardada
 */
export async function downloadInspection(
  sessionId: string,
  inspectorId: string,
): Promise<OfflineSession> {
  // 1. Obtener snapshot completo
  const session = await getInspectionSessionById(sessionId);
  if (!session) throw new Error("Inspección no encontrada");

  if (session.inspection_type !== "onsite") {
    throw new Error("Solo se pueden descargar inspecciones presenciales");
  }

  // 2. Descargar catálogos
  const catalogs = await downloadCatalogs();

  // 3. Marcar como activa + registrar descarga offline
  const now = new Date().toISOString();
  await updateInspectionSession(sessionId, {
    status: "active",
    started_at: session.started_at || now,
    started_from_mobile: true,
    offline_downloaded_at: now,
    offline_downloaded_by: inspectorId,
  } as Partial<InspectionSession>);

  // Actualizar el snapshot con los campos nuevos
  session.status = "active";
  session.started_at = session.started_at || now;
  session.started_from_mobile = true;
  session.offline_downloaded_at = now;
  session.offline_downloaded_by = inspectorId;

  // 4. Guardar en IndexedDB
  const offlineSession: OfflineSession = {
    id: sessionId,
    sessionId,
    inspectorId,
    session,
    catalogs,
    pending: emptyPendingChanges(),
    syncStatus: "never",
    downloaded_at: now,
    expires_at: getExpirationDate(10),
    last_synced_at: null,
    sync_error: null,
  };

  const db = getOfflineDB();
  await db.sessions.put(offlineSession);

  return offlineSession;
}

// ─────────────────────────────────────────────────────────────────────
// Listar inspecciones descargadas
// ─────────────────────────────────────────────────────────────────────

/** Obtiene todas las inspecciones descargadas por un inspector */
export async function getDownloadedSessions(inspectorId?: string): Promise<OfflineSession[]> {
  const db = getOfflineDB();
  if (inspectorId) {
    return db.sessions.where("inspectorId").equals(inspectorId).toArray();
  }
  return db.sessions.toArray();
}

/** Obtiene una sesión descargada por ID */
export async function getDownloadedSession(sessionId: string): Promise<OfflineSession | null> {
  const db = getOfflineDB();
  const session = await db.sessions.get(sessionId);
  return session ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// Eliminar inspección descargada
// ─────────────────────────────────────────────────────────────────────

/** Elimina una inspección de la cache offline */
export async function removeDownloadedSession(sessionId: string): Promise<void> {
  const db = getOfflineDB();
  await db.sessions.delete(sessionId);
}

// ─────────────────────────────────────────────────────────────────────
// Verificar límite de descargas
// ─────────────────────────────────────────────────────────────────────

/** Máximo de inspecciones que un inspector puede tener descargadas */
export const MAX_OFFLINE_SESSIONS = 5;

/** Verifica si el inspector puede descargar más inspecciones */
export async function canDownloadMore(inspectorId: string): Promise<{ can: boolean; count: number; max: number }> {
  const sessions = await getDownloadedSessions(inspectorId);
  // Solo contar las que no han expirado
  const valid = sessions.filter((s) => new Date(s.expires_at) > new Date());
  return {
    can: valid.length < MAX_OFFLINE_SESSIONS,
    count: valid.length,
    max: MAX_OFFLINE_SESSIONS,
  };
}
