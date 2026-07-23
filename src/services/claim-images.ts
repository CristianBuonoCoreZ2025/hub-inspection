import { fetchAll, insertRow } from "@/lib/supabase/db";

// ═══════════════════════════════════════════════════════════════
// Imágenes del siniestro (claim_images)
//
// Imágenes subidas directamente al siniestro (tab Imágenes).
// Distintas de claim_documents (documentos) y de
// inspection_evidences (imágenes de inspección).
// ═══════════════════════════════════════════════════════════════

export interface ClaimImage {
  id: string;
  claim_id: string;
  img_code: string;
  url: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  file_path: string | null;
  uploaded_by: string | null;
  ai_summary: string | null;
  ai_model: string | null;
  ai_status: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const IMAGE_FIELDS =
  "id, claim_id, img_code, url, original_filename, mime_type, file_size, file_path, uploaded_by, ai_summary, ai_model, ai_status, is_active, created_at, updated_at";

export async function getClaimImages(claimId: string): Promise<ClaimImage[]> {
  return fetchAll<ClaimImage>("claim_images", {
    select: IMAGE_FIELDS,
    eq: { claim_id: claimId, is_active: true },
    order: { column: "created_at", ascending: false },
  });
}

export async function createClaimImage(input: {
  claim_id: string;
  img_code: string;
  url: string;
  file_path: string;
  original_filename?: string;
  mime_type?: string;
  file_size?: number;
  uploaded_by?: string;
  ai_summary?: string | null;
  ai_model?: string | null;
}): Promise<ClaimImage> {
  return insertRow<ClaimImage>(
    "claim_images",
    {
      claim_id: input.claim_id,
      img_code: input.img_code,
      url: input.url,
      file_path: input.file_path,
      original_filename: input.original_filename || null,
      mime_type: input.mime_type || null,
      file_size: input.file_size || null,
      uploaded_by: input.uploaded_by || null,
      ai_summary: input.ai_summary || null,
      ai_model: input.ai_model || null,
      is_active: true,
    },
    IMAGE_FIELDS
  );
}

/** Elimina (soft delete) una imagen del siniestro via API. */
export async function deleteClaimImage(id: string): Promise<void> {
  const res = await fetch(`/api/claims/images/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al eliminar imagen");
  }
}

// ═══════════════════════════════════════════════════════════════
// Imágenes y croquis de inspecciones del siniestro (read-only)
// ═══════════════════════════════════════════════════════════════

export interface InspectionSessionSummary {
  id: string;
  scheduled_at: string | null;
  status: string;
  claim_action?: { code: string | null } | null;
  action_template?: { code: string | null } | null;
}

export interface InspectionImageFromSession {
  id: string;
  session_id: string;
  type: string;
  url: string;
  description: string | null;
  captured_at: string | null;
  created_at: string;
  ai_summary: string | null;
  ai_model: string | null;
  ai_status: string | null;
  metadata: { originalName?: string; mimeType?: string; fileSize?: number } | null;
  session?: InspectionSessionSummary;
}

export interface InspectionSketchFromSession {
  id: string;
  session_id: string;
  sketch_url: string;
  label: string | null;
  created_at: string;
  session?: InspectionSessionSummary;
}

const SESSION_LIGHT_SELECT =
  "id, scheduled_at, status, claim_action:claim_actions!inspection_sessions_claim_action_id_fkey(code), action_template:action_template!inspection_sessions_action_template_id_fkey(code)";

/**
 * Helper: trae las sesiones de inspección del claim (versión ligera).
 */
async function getLightSessionsByClaim(
  claimId: string
): Promise<InspectionSessionSummary[]> {
  return fetchAll<InspectionSessionSummary>("inspection_sessions", {
    select: SESSION_LIGHT_SELECT,
    eq: { claim_id: claimId },
    order: { column: "scheduled_at", ascending: false },
  });
}

/**
 * Trae todas las fotos (type=photo) de todas las inspecciones del siniestro.
 * Read-only — estas imágenes no se pueden eliminar desde aquí.
 */
export async function getInspectionPhotosByClaim(
  claimId: string
): Promise<InspectionImageFromSession[]> {
  // 1. Traer todas las sesiones del claim
  const sessions = await getLightSessionsByClaim(claimId);
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  // 2. Traer todas las evidencias tipo photo de esas sesiones
  const evidences = await fetchAll<InspectionImageFromSession>("inspection_evidences", {
    select:
      "id, session_id, type, url, description, captured_at, created_at, ai_summary, ai_model, ai_status, metadata",
    in: { session_id: sessionIds },
    eq: { type: "photo" },
    order: { column: "created_at", ascending: false },
  });

  // 3. Adjuntar la sesión a cada evidencia
  return evidences.map((ev) => ({
    ...ev,
    session: sessionMap.get(ev.session_id),
  }));
}

/**
 * Trae todos los croquis (damage_sketches) de todas las inspecciones del siniestro.
 * Read-only — estos croquis no se pueden eliminar desde aquí.
 */
export async function getInspectionSketchesByClaim(
  claimId: string
): Promise<InspectionSketchFromSession[]> {
  // 1. Traer todas las sesiones del claim
  const sessions = await getLightSessionsByClaim(claimId);
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  // 2. Traer todos los croquis de esas sesiones
  const sketches = await fetchAll<InspectionSketchFromSession>("damage_sketches", {
    select: "id, session_id, sketch_url, label, created_at",
    in: { session_id: sessionIds },
    order: { column: "created_at", ascending: false },
  });

  // 3. Adjuntar la sesión a cada croquis
  return sketches.map((sk) => ({
    ...sk,
    session: sessionMap.get(sk.session_id),
  }));
}




