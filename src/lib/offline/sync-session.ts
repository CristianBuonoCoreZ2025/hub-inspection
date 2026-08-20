"use client";

import { getOfflineDB, hasPendingChanges, emptyPendingChanges, type OfflineSession, type PendingChanges } from "@/db/offline-db";
import { updateInspectionSession, createDamage, updateDamage, deleteDamage, type SessionDetail } from "@/services/inspections";
import type { InspectionSession, InspectionDamage, EvidenceSource } from "@/types";

// ─────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────

export interface SyncProgress {
  step: string;
  current: number;
  total: number;
  percent: number;
}

export interface SyncResult {
  success: boolean;
  synced: {
    acta: boolean;
    damages: number;
    evidences: number;
    signatures: number;
    sketches: number;
  };
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────
// Sincronizar una inspección
// ─────────────────────────────────────────────────────────────────────

/**
 * Sincroniza todos los cambios pendientes de una inspección offline.
 * Se ejecuta una inspección a la vez.
 *
 * @param sessionId  ID de la inspección a sincronizar
 * @param onProgress  Callback para reportar progreso
 */
export async function syncInspection(
  sessionId: string,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncResult> {
  const db = getOfflineDB();
  const offline = await db.sessions.get(sessionId);
  if (!offline) throw new Error("Inspección no encontrada en cache offline");

  const pending = offline.pending;
  const errors: string[] = [];
  const result: SyncResult = {
    success: true,
    synced: { acta: false, damages: 0, evidences: 0, signatures: 0, sketches: 0 },
    errors: [],
  };

  if (!hasPendingChanges(pending)) {
    // No hay cambios, marcar como sincronizada
    await db.sessions.update(sessionId, {
      syncStatus: "synced",
      last_synced_at: new Date().toISOString(),
      sync_error: null,
    });
    return result;
  }

  // Marcar como sincronizando
  await db.sessions.update(sessionId, { syncStatus: "syncing", sync_error: null });

  // Contar total de items para progreso
  const totalItems =
    (pending.acta ? 1 : 0) +
    pending.damagesCreated.length +
    pending.damagesUpdated.length +
    pending.damagesDeleted.length +
    pending.evidences.length +
    pending.signatures.length +
    pending.sketches.length;
  let currentItem = 0;

  const reportProgress = (step: string) => {
    currentItem++;
    onProgress?.({
      step,
      current: currentItem,
      total: totalItems,
      percent: Math.round((currentItem / totalItems) * 100),
    });
  };

  try {
    // 1. Sincronizar acta
    if (pending.acta) {
      try {
        await updateInspectionSession(sessionId, pending.acta as Partial<InspectionSession>);
        result.synced.acta = true;
      } catch (e) {
        errors.push(`Acta: ${(e as Error).message}`);
      }
      reportProgress("Acta");
    }

    // 2. Sincronizar daños creados
    for (const damage of pending.damagesCreated) {
      try {
        const { id: _id, created_at: _c, updated_at: _u, ...rest } = damage;
        void _id; void _c; void _u;
        await createDamage(rest as Parameters<typeof createDamage>[0]);
        result.synced.damages++;
      } catch (e) {
        errors.push(`Daño creado: ${(e as Error).message}`);
      }
      reportProgress("Daño creado");
    }

    // 3. Sincronizar daños actualizados
    for (const damage of pending.damagesUpdated) {
      try {
        await updateDamage(damage.id, damage);
        result.synced.damages++;
      } catch (e) {
        errors.push(`Daño actualizado: ${(e as Error).message}`);
      }
      reportProgress("Daño actualizado");
    }

    // 4. Sincronizar daños eliminados
    for (const damageId of pending.damagesDeleted) {
      try {
        await deleteDamage(damageId);
        result.synced.damages++;
      } catch (e) {
        errors.push(`Daño eliminado: ${(e as Error).message}`);
      }
      reportProgress("Daño eliminado");
    }

    // 5. Sincronizar evidencias (fotos)
    for (const evidence of pending.evidences) {
      try {
        const formData = new FormData();
        formData.append("file", evidence.blob, `evidence-${evidence.localId}.jpg`);
        formData.append("sessionId", sessionId);
        formData.append("source", evidence.source);
        if (evidence.damageId) formData.append("damageId", evidence.damageId);
        if (evidence.documentType) formData.append("documentType", evidence.documentType);
        if (evidence.description) formData.append("originalName", evidence.description);

        const res = await fetch("/api/inspection/evidences/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        result.synced.evidences++;
      } catch (e) {
        errors.push(`Evidencia: ${(e as Error).message}`);
      }
      reportProgress("Evidencia");
    }

    // 6. Sincronizar firmas
    for (const sig of pending.signatures) {
      try {
        const formData = new FormData();
        formData.append("file", sig.blob, `signature-${sig.localId}.png`);
        formData.append("sessionId", sessionId);
        formData.append("role", sig.role);

        const res = await fetch("/api/inspection/sign/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        result.synced.signatures++;
      } catch (e) {
        errors.push(`Firma: ${(e as Error).message}`);
      }
      reportProgress("Firma");
    }

    // 7. Sincronizar croquis
    for (const sketch of pending.sketches) {
      try {
        const formData = new FormData();
        formData.append("file", sketch.blob, `sketch-${sketch.localId}.png`);
        formData.append("sessionId", sessionId);
        if (sketch.label) formData.append("label", sketch.label);

        const res = await fetch("/api/inspection/sketch/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        result.synced.sketches++;
      } catch (e) {
        errors.push(`Croquis: ${(e as Error).message}`);
      }
      reportProgress("Croquis");
    }

    // 8. Actualizar fecha de sincronización en el servidor
    try {
      await updateInspectionSession(sessionId, {
        offline_synced_at: new Date().toISOString(),
      } as Partial<InspectionSession>);
    } catch {
      // No crítico si falla
    }

    // 9. Limpiar cambios pendientes y marcar como sincronizada
    const cleared: PendingChanges = emptyPendingChanges();
    await db.sessions.update(sessionId, {
      pending: cleared,
      syncStatus: errors.length > 0 ? "error" : "synced",
      last_synced_at: new Date().toISOString(),
      sync_error: errors.length > 0 ? errors.join("; ") : null,
    });

    result.success = errors.length === 0;
    result.errors = errors;
    return result;
  } catch (e) {
    // Error fatal — marcar como error pero mantener cambios pendientes
    await db.sessions.update(sessionId, {
      syncStatus: "error",
      sync_error: (e as Error).message,
    });
    result.success = false;
    result.errors.push((e as Error).message);
    return result;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Guardar cambios pendientes
// ─────────────────────────────────────────────────────────────────────

/** Actualiza los cambios pendientes del acta */
export async function savePendingActa(sessionId: string, acta: Partial<InspectionSession>): Promise<void> {
  const db = getOfflineDB();
  const offline = await db.sessions.get(sessionId);
  if (!offline) throw new Error("Sesión offline no encontrada");
  await db.sessions.update(sessionId, {
    pending: { ...offline.pending, acta },
    syncStatus: "pending",
  });
}

/** Agrega un daño creado offline */
export async function addPendingDamageCreated(sessionId: string, damage: InspectionDamage): Promise<void> {
  const db = getOfflineDB();
  const offline = await db.sessions.get(sessionId);
  if (!offline) throw new Error("Sesión offline no encontrada");
  await db.sessions.update(sessionId, {
    pending: {
      ...offline.pending,
      damagesCreated: [...offline.pending.damagesCreated, damage],
    },
    syncStatus: "pending",
  });
}

/** Agrega un daño actualizado offline */
export async function addPendingDamageUpdated(sessionId: string, damage: InspectionDamage): Promise<void> {
  const db = getOfflineDB();
  const offline = await db.sessions.get(sessionId);
  if (!offline) throw new Error("Sesión offline no encontrada");
  // Si el daño ya está en damagesCreated, actualizarlo ahí
  const createdIdx = offline.pending.damagesCreated.findIndex((d) => d.id === damage.id);
  if (createdIdx >= 0) {
    const newCreated = [...offline.pending.damagesCreated];
    newCreated[createdIdx] = damage;
    await db.sessions.update(sessionId, {
      pending: { ...offline.pending, damagesCreated: newCreated },
      syncStatus: "pending",
    });
    return;
  }
  // Si no, agregar a updated (reemplazando si ya existe)
  const filtered = offline.pending.damagesUpdated.filter((d) => d.id !== damage.id);
  await db.sessions.update(sessionId, {
    pending: {
      ...offline.pending,
      damagesUpdated: [...filtered, damage],
    },
    syncStatus: "pending",
  });
}

/** Agrega un daño eliminado offline */
export async function addPendingDamageDeleted(sessionId: string, damageId: string): Promise<void> {
  const db = getOfflineDB();
  const offline = await db.sessions.get(sessionId);
  if (!offline) throw new Error("Sesión offline no encontrada");
  // Si el daño estaba en damagesCreated, sacarlo de ahí (no se sincroniza)
  const newCreated = offline.pending.damagesCreated.filter((d) => d.id !== damageId);
  // Si estaba en damagesUpdated, sacarlo de ahí también
  const newUpdated = offline.pending.damagesUpdated.filter((d) => d.id !== damageId);
  // Agregar a deleted solo si no era creado offline
  const wasCreated = offline.pending.damagesCreated.some((d) => d.id === damageId);
  const newDeleted = wasCreated ? offline.pending.damagesDeleted : [...offline.pending.damagesDeleted, damageId];
  await db.sessions.update(sessionId, {
    pending: {
      ...offline.pending,
      damagesCreated: newCreated,
      damagesUpdated: newUpdated,
      damagesDeleted: newDeleted,
    },
    syncStatus: "pending",
  });
}

/** Agrega una evidencia pendiente */
export async function addPendingEvidence(
  sessionId: string,
  evidence: { localId: string; blob: Blob; type: "photo" | "video" | "document"; source: string; damageId?: string | null; documentType?: string | null; description?: string | null; lat?: number | null; lng?: number | null },
): Promise<void> {
  const db = getOfflineDB();
  const offline = await db.sessions.get(sessionId);
  if (!offline) throw new Error("Sesión offline no encontrada");
  await db.sessions.update(sessionId, {
    pending: {
      ...offline.pending,
      evidences: [
        ...offline.pending.evidences,
        {
          localId: evidence.localId,
          blob: evidence.blob,
          type: evidence.type,
          source: evidence.source,
          damageId: evidence.damageId ?? null,
          documentType: evidence.documentType ?? null,
          description: evidence.description ?? null,
          capturedAt: new Date().toISOString(),
          lat: evidence.lat ?? null,
          lng: evidence.lng ?? null,
        },
      ],
    },
    syncStatus: "pending",
  });
}

/** Alias para consistencia con daños: addPendingEvidenceCreated */
export async function addPendingEvidenceCreated(
  sessionId: string,
  evidence: { localId: string; blob: Blob; type: "photo" | "video" | "document"; metadata?: { originalName?: string; fileSize?: number; mimeType?: string } | null },
): Promise<void> {
  return addPendingEvidence(sessionId, {
    localId: evidence.localId,
    blob: evidence.blob,
    type: evidence.type,
    source: "mobile-offline",
    description: evidence.metadata?.originalName ?? null,
  });
}

/** Marca una evidencia existente para eliminación al sincronizar */
export async function addPendingEvidenceDeleted(sessionId: string, evidenceId: string): Promise<void> {
  const db = getOfflineDB();
  const offline = await db.sessions.get(sessionId);
  if (!offline) throw new Error("Sesión offline no encontrada");
  await db.sessions.update(sessionId, {
    pending: {
      ...offline.pending,
      evidencesDeleted: [...offline.pending.evidencesDeleted, evidenceId],
    },
    syncStatus: "pending",
  });
}

/** Obtiene las evidencias offline (descargadas + pendientes) con URLs blob */
export async function getOfflineEvidences(sessionId: string): Promise<Array<{
  id: string;
  type: string;
  url: string;
  description: string | null;
  created_at: string;
  metadata: { originalName?: string; fileSize?: number; mimeType?: string } | null;
  include_in_report: boolean;
  lat: number | null;
  lng: number | null;
  exif_lat: number | null;
  exif_lng: number | null;
  ai_summary: string | null;
  ai_status: string | null;
  source: string | null;
}>> {
  const db = getOfflineDB();
  const offline = await db.sessions.get(sessionId);
  if (!offline) return [];

  // Evidencias descargadas (del snapshot)
  const downloaded = (offline.session as SessionDetail).inspection_evidences || [];

  // Filtrar las que fueron eliminadas offline
  const deletedIds = new Set(offline.pending.evidencesDeleted);
  const activeDownloaded = downloaded.filter((e) => !deletedIds.has(e.id));

  // Mapear a formato unificado
  const result = activeDownloaded.map((e) => ({
    id: e.id,
    type: e.type,
    url: e.url,
    description: e.description ?? null,
    created_at: e.created_at,
    metadata: e.metadata as { originalName?: string; fileSize?: number; mimeType?: string } | null,
    include_in_report: e.include_in_report,
    lat: e.metadata?.lat ?? null,
    lng: e.metadata?.lng ?? null,
    exif_lat: null,
    exif_lng: null,
    ai_summary: null,
    ai_status: null,
    source: e.source,
  }));

  // Agregar evidencias pendientes (con blob URL)
  for (const pe of offline.pending.evidences) {
    const blobUrl = URL.createObjectURL(pe.blob);
    result.push({
      id: pe.localId,
      type: pe.type,
      url: blobUrl,
      description: pe.description ?? null,
      created_at: pe.capturedAt,
      metadata: null,
      include_in_report: false,
      lat: pe.lat,
      lng: pe.lng,
      exif_lat: null,
      exif_lng: null,
      ai_summary: null,
      ai_status: null,
      source: pe.source as EvidenceSource | null,
    });
  }

  return result;
}

/** Agrega una firma pendiente */
export async function addPendingSignature(
  sessionId: string,
  signature: { localId: string; blob: Blob; role: "insured" | "adjuster" },
): Promise<void> {
  const db = getOfflineDB();
  const offline = await db.sessions.get(sessionId);
  if (!offline) throw new Error("Sesión offline no encontrada");
  await db.sessions.update(sessionId, {
    pending: {
      ...offline.pending,
      signatures: [
        ...offline.pending.signatures,
        {
          localId: signature.localId,
          blob: signature.blob,
          role: signature.role,
          capturedAt: new Date().toISOString(),
        },
      ],
    },
    syncStatus: "pending",
  });
}

/** Marca una firma existente para eliminación al sincronizar */
export async function addPendingSignatureDeleted(sessionId: string, signatureId: string): Promise<void> {
  const db = getOfflineDB();
  const offline = await db.sessions.get(sessionId);
  if (!offline) throw new Error("Sesión offline no encontrada");
  await db.sessions.update(sessionId, {
    pending: {
      ...offline.pending,
      signaturesDeleted: [...offline.pending.signaturesDeleted, signatureId],
    },
    syncStatus: "pending",
  });
}

/** Obtiene las firmas offline (descargadas + pendientes) con URLs blob */
export async function getOfflineSignatures(sessionId: string): Promise<Array<{
  id: string;
  role: string;
  signer_name: string | null;
  signature_url: string;
  created_at: string;
}>> {
  const db = getOfflineDB();
  const offline = await db.sessions.get(sessionId);
  if (!offline) return [];

  const downloaded = (offline.session as SessionDetail).inspection_signatures || [];
  const deletedIds = new Set(offline.pending.signaturesDeleted);
  const activeDownloaded = downloaded.filter((s) => !deletedIds.has(s.id));

  const result = activeDownloaded.map((s) => ({
    id: s.id,
    role: s.role,
    signer_name: null,
    signature_url: s.signature_url,
    created_at: s.signed_at,
  }));

  for (const ps of offline.pending.signatures) {
    const blobUrl = URL.createObjectURL(ps.blob);
    result.push({
      id: ps.localId,
      role: ps.role,
      signer_name: null,
      signature_url: blobUrl,
      created_at: ps.capturedAt,
    });
  }

  return result;
}

/** Agrega un croquis pendiente */
export async function addPendingSketch(
  sessionId: string,
  sketch: { localId: string; blob: Blob; label: string | null },
): Promise<void> {
  const db = getOfflineDB();
  const offline = await db.sessions.get(sessionId);
  if (!offline) throw new Error("Sesión offline no encontrada");
  await db.sessions.update(sessionId, {
    pending: {
      ...offline.pending,
      sketches: [
        ...offline.pending.sketches,
        {
          localId: sketch.localId,
          blob: sketch.blob,
          label: sketch.label,
          capturedAt: new Date().toISOString(),
        },
      ],
    },
    syncStatus: "pending",
  });
}
