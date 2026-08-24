"use client";

import { getOfflineDB, emptyPendingChanges, getExpirationDate, mergeInspectionDamages, type OfflineSession, type OfflineCatalogs, setGlobalCatalogs, hasGlobalCatalogs, areGlobalCatalogsStale } from "@/db/offline-db";
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
  getContentGoodTypeBrands,
  getDamageClassifications,
  getCurrencies,
  getClassificationDestinations,
  getCountryCurrencies,
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
  // Tipos de daño / detalles para el acta y daños
  "building_damage_category",
  "content_damage_category",
  "currency",
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
    contentGoodTypeBrands,
    damageClassifications,
    currencies,
    classificationDestinations,
    countryCurrencies,
  ] = await Promise.all([
    getPropertyClassifications(),
    getHousingDestinations(),
    getBuildingAges(),
    getDamageSpaces(),
    getContentGoodTypes(),
    getContentGoodProducts(),
    getContentGoodBrands(),
    getContentGoodTypeBrands(),
    getDamageClassifications(),
    getCurrencies(),
    getClassificationDestinations(),
    getCountryCurrencies(null),
  ]);

  return {
    lookup_catalog: Object.fromEntries(lookupEntries) as OfflineCatalogs["lookup_catalog"],
    property_classifications: propertyClassifications.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      is_active: p.is_active,
      field_config: p.field_config ?? undefined,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
    housing_destinations: housingDestinations.map((h) => ({
      id: h.id,
      name: h.name,
      description: h.description ?? null,
      is_active: h.is_active,
      field_config: h.field_config ?? undefined,
      destination_type: h.destination_type,
      created_at: h.created_at,
      updated_at: h.updated_at,
    })),
    building_ages: buildingAges.map((b) => ({
      id: b.id,
      name: b.name,
      is_active: b.is_active,
      created_at: b.created_at,
      updated_at: b.updated_at,
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
    content_good_type_brands: contentGoodTypeBrands.map((tb) => ({
      id: tb.id,
      content_good_type_id: tb.content_good_type_id,
      brand_id: tb.brand_id,
      brand: tb.brand ? { id: tb.brand.id, name: tb.brand.name } : null,
    })),
    currencies: currencies.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      symbol: c.symbol,
    })),
    damage_classifications: damageClassifications.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code || d.name,
    })),
    classification_destinations: classificationDestinations.map((cd) => ({
      id: cd.id,
      classification_id: cd.classification_id,
      destination_id: cd.destination_id,
      created_at: cd.created_at,
    })),
    country_currencies: countryCurrencies.map((cc) => {
      const c = cc as { id: string; code: string; name: string; symbol?: string | null };
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        symbol: c.symbol ?? null,
      };
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Descargar inspección completa
// ─────────────────────────────────────────────────────────────────────

/** Etapas de la descarga, para reportar progreso a la UI */
export type DownloadStep =
  | "profile"        // Sincronizando perfil y PIN
  | "session"        // Obteniendo snapshot de la inspección
  | "catalogs"       // Descargando catálogos globales (solo primera vez)
  | "saving"         // Guardando en dispositivo
  | "activating"     // Activando inspección en servidor
  | "done";

export interface DownloadProgress {
  step: DownloadStep;
  label: string;
  percent: number;
}

/**
 * Descarga una inspección completa para uso offline.
 *
 * 1. Obtiene el snapshot completo de la sesión
 * 2. Catálogos globales: solo los descarga si es la primera vez (no existen
 *    en IndexedDB). Si ya están cacheados, los reutiliza — son globales,
 *    no cambian entre inspecciones.
 * 3. Marca la inspección como activa (bloqueo para otros usuarios)
 * 4. Guarda todo en IndexedDB
 *
 * @param sessionId  ID de la inspección a descargar
 * @param inspectorId  ID del profile del inspector
 * @param onProgress  Callback para reportar progreso a la UI
 * @returns La sesión offline guardada
 */
export async function downloadInspection(
  sessionId: string,
  inspectorId: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<OfflineSession> {
  // 1. Obtener snapshot completo
  onProgress?.({ step: "session", label: "Obteniendo datos de la inspección...", percent: 15 });
  const session = await getInspectionSessionById(sessionId);
  if (!session) throw new Error("Inspección no encontrada");

  if (session.inspection_type !== "onsite") {
    throw new Error("Solo se pueden descargar inspecciones presenciales");
  }

  // 2. Catálogos globales: descargar si no existen O si tienen más de 24h
  const catalogsExist = await hasGlobalCatalogs();
  const catalogsStale = await areGlobalCatalogsStale(24);
  if (!catalogsExist) {
    onProgress?.({ step: "catalogs", label: "Descargando catálogos (primera vez, puede tardar)...", percent: 35 });
    const catalogs = await downloadCatalogs();
    onProgress?.({ step: "catalogs", label: "Guardando catálogos en dispositivo...", percent: 60 });
    await setGlobalCatalogs(catalogs);
  } else if (catalogsStale) {
    onProgress?.({ step: "catalogs", label: "Actualizando catálogos (versión anterior)...", percent: 35 });
    const catalogs = await downloadCatalogs();
    onProgress?.({ step: "catalogs", label: "Guardando catálogos actualizados...", percent: 60 });
    await setGlobalCatalogs(catalogs);
  } else {
    onProgress?.({ step: "catalogs", label: "Catálogos al día, reutilizando...", percent: 60 });
  }

  // 3. Marcar como activa + registrar descarga offline
  onProgress?.({ step: "activating", label: "Activando inspección en servidor...", percent: 75 });
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

  // 4. Guardar en IndexedDB (sin catálogos — son globales)
  onProgress?.({ step: "saving", label: "Guardando en dispositivo...", percent: 85 });

  // 4a. Descargar blobs de evidencias (fotos/videos) para offline
  const evidences = session.inspection_evidences || [];
  if (evidences.length > 0) {
    onProgress?.({ step: "saving", label: `Descargando ${evidences.length} evidencias...`, percent: 86 });
    const db = getOfflineDB();
    for (const ev of evidences) {
      if (!ev.url) continue;
      try {
        const proxyUrl = `/api/storage/proxy?url=${encodeURIComponent(ev.url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) continue;
        const blob = await res.blob();
        await db.evidenceBlobs.put({ id: ev.id, blob });
      } catch (e) {
        console.warn(`[downloadInspection] No se pudo descargar evidencia ${ev.id}:`, e);
      }
    }
  }

  // 4b. Descargar blobs de croquis (sketches) para offline
  const sketches = session.damage_sketches || [];
  if (sketches.length > 0) {
    onProgress?.({ step: "saving", label: `Descargando ${sketches.length} croquis...`, percent: 90 });
    const db = getOfflineDB();
    for (const sk of sketches) {
      if (!sk.sketch_url) continue;
      try {
        const proxyUrl = `/api/storage/proxy?url=${encodeURIComponent(sk.sketch_url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) continue;
        const blob = await res.blob();
        await db.evidenceBlobs.put({ id: `sketch-${sk.id}`, blob });
      } catch (e) {
        console.warn(`[downloadInspection] No se pudo descargar croquis ${sk.id}:`, e);
      }
    }
  }

  // 4c. Descargar blobs de firmas para offline
  const signatures = session.inspection_signatures || [];
  if (signatures.length > 0) {
    const db = getOfflineDB();
    for (const sig of signatures) {
      if (!sig.signature_url) continue;
      try {
        const proxyUrl = `/api/storage/proxy?url=${encodeURIComponent(sig.signature_url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) continue;
        const blob = await res.blob();
        await db.evidenceBlobs.put({ id: `sig-${sig.id}`, blob });
      } catch (e) {
        console.warn(`[downloadInspection] No se pudo descargar firma ${sig.id}:`, e);
      }
    }
  }

  onProgress?.({ step: "saving", label: "Guardando en dispositivo...", percent: 92 });
  const offlineSession: OfflineSession = {
    id: sessionId,
    sessionId,
    inspectorId,
    session,
    pending: emptyPendingChanges(),
    syncStatus: "never",
    downloaded_at: now,
    expires_at: getExpirationDate(10),
    last_synced_at: null,
    sync_error: null,
  };

  const db = getOfflineDB();
  await db.sessions.put(offlineSession);

  onProgress?.({ step: "done", label: "Descarga completa", percent: 100 });
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

/** Obtiene una sesión descargada por ID, con los cambios pending aplicados en memoria */
export async function getDownloadedSession(sessionId: string): Promise<OfflineSession | null> {
  const db = getOfflineDB();
  const offline = await db.sessions.get(sessionId);
  if (!offline) return null;

  // Mergear pending en session en memoria (no guardar en DB)
  const mergedSession = { ...offline.session } as SessionDetail;

  if (offline.pending.acta) {
    const acta = offline.pending.acta;
    Object.assign(mergedSession, acta);
    if (acta.property_risk) mergedSession.property_risk = { ...mergedSession.property_risk, ...acta.property_risk };
    if (acta.property_materiality) mergedSession.property_materiality = { ...mergedSession.property_materiality, ...acta.property_materiality };
    if (acta.security_measures) mergedSession.security_measures = { ...mergedSession.security_measures, ...acta.security_measures };
    if (acta.insured_statement) mergedSession.insured_statement = { ...mergedSession.insured_statement, ...acta.insured_statement };
    if (acta.third_parties) mergedSession.third_parties = acta.third_parties;
  }

  mergedSession.inspection_damages = mergeInspectionDamages(
    [mergedSession.inspection_damages],
    offline.pending,
  );

  return { ...offline, session: mergedSession };
}

// ─────────────────────────────────────────────────────────────────────
// Eliminar inspección descargada
// ─────────────────────────────────────────────────────────────────────

/** Elimina una inspección de la cache offline */
export async function removeDownloadedSession(sessionId: string): Promise<void> {
  const db = getOfflineDB();
  // Eliminar blobs de evidencias y croquis asociados
  const offline = await db.sessions.get(sessionId);
  if (offline) {
    const evidences = (offline.session as SessionDetail).inspection_evidences || [];
    for (const ev of evidences) {
      await db.evidenceBlobs.delete(ev.id).catch(() => {});
    }
    const sketches = (offline.session as SessionDetail).damage_sketches || [];
    for (const sk of sketches) {
      await db.evidenceBlobs.delete(`sketch-${sk.id}`).catch(() => {});
    }
    const signatures = (offline.session as SessionDetail).inspection_signatures || [];
    for (const sig of signatures) {
      await db.evidenceBlobs.delete(`sig-${sig.id}`).catch(() => {});
    }
  }
  await db.sessions.delete(sessionId);
}

/**
 * Libera una inspección descargada: limpia offline_downloaded_by en Supabase
 * y elimina la sesión de IndexedDB. Requiere conexión a internet.
 */
export async function releaseDownloadedSession(sessionId: string): Promise<void> {
  // 1. Limpiar en Supabase
  const { updateInspectionSession } = await import("@/services/inspections");
  await updateInspectionSession(sessionId, {
    offline_downloaded_by: null,
    offline_downloaded_at: null,
  } as Record<string, unknown>);

  // 2. Eliminar de IndexedDB
  await removeDownloadedSession(sessionId);
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
