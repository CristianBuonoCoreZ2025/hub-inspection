import { fetchAll, fetchById, insertRow, updateRow, updateWhere } from "@/lib/supabase/db";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type DocumentFileType = "docx" | "xlsx" | "pptx" | "pdf";
export type DocumentSource = "template" | "upload_docx" | "upload_xlsx" | "upload_pptx" | "pdf_conversion";
export type WorkflowLevel = "issuer" | "reviewer" | "approver" | "dispatcher" | "system";

export interface ClaimActionDocument {
  id: string;
  claim_action_id: string;
  claim_id: string;
  version: number;
  source: DocumentSource;
  document_template_id: string | null;
  file_url: string;
  file_path: string;
  file_name: string;
  original_filename: string | null;
  mime_type: string;
  file_size: number | null;
  file_type: DocumentFileType;
  workflow_level: WorkflowLevel | null;
  locked_by: string | null;
  locked_at: string | null;
  lock_expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_current: boolean;
  is_active: boolean;
  // Joins
  locked_by_user?: { id: string; full_name: string; email: string } | null;
  created_by_user?: { id: string; full_name: string; email: string } | null;
  document_template?: { id: string; name: string; file_name: string } | null;
}

const DOCUMENT_FIELDS =
  "id, claim_action_id, claim_id, version, source, document_template_id, file_url, file_path, file_name, original_filename, mime_type, file_size, file_type, workflow_level, locked_by, locked_at, lock_expires_at, created_by, created_at, updated_at, is_current, is_active, locked_by_user:profiles!claim_action_documents_locked_by_fkey(id, full_name, email), created_by_user:profiles!claim_action_documents_created_by_fkey(id, full_name, email), document_template:document_templates!claim_action_documents_document_template_id_fkey(id, name, file_name)";

export interface CreateDocumentVersionInput {
  claim_action_id: string;
  claim_id: string;
  source: DocumentSource;
  document_template_id?: string | null;
  file_url: string;
  file_path: string;
  file_name: string;
  original_filename?: string | null;
  mime_type: string;
  file_size?: number | null;
  file_type: DocumentFileType;
  workflow_level?: WorkflowLevel | null;
  created_by?: string | null;
}

// ──────────────────────────────────────────────────────────────
// Lectura
// ──────────────────────────────────────────────────────────────

/** Lista todas las versiones de documentos de una gestión (ordenadas por versión descendente) */
export async function getClaimActionDocuments(actionId: string): Promise<ClaimActionDocument[]> {
  const rows = await fetchAll<ClaimActionDocument>("claim_action_documents", {
    select: DOCUMENT_FIELDS,
    eq: { claim_action_id: actionId, is_active: true },
    order: { column: "version", ascending: false },
  });
  return rows;
}

/** Obtiene el documento actual (is_current = true) de una gestión */
export async function getCurrentDocument(actionId: string): Promise<ClaimActionDocument | null> {
  const rows = await fetchAll<ClaimActionDocument>("claim_action_documents", {
    select: DOCUMENT_FIELDS,
    eq: { claim_action_id: actionId, is_current: true, is_active: true },
  });
  return rows[0] || null;
}

/** Obtiene el documento editable actual (Word/Excel/PPT, no PDF) */
export async function getCurrentEditableDocument(actionId: string): Promise<ClaimActionDocument | null> {
  const rows = await fetchAll<ClaimActionDocument>("claim_action_documents", {
    select: DOCUMENT_FIELDS,
    eq: { claim_action_id: actionId, is_current: true, is_active: true },
  });
  const doc = rows[0];
  if (!doc) return null;
  if (doc.file_type === "pdf") return null;
  return doc;
}

/** Obtiene el PDF actual de la gestión */
export async function getCurrentPdf(actionId: string): Promise<ClaimActionDocument | null> {
  const rows = await fetchAll<ClaimActionDocument>("claim_action_documents", {
    select: DOCUMENT_FIELDS,
    eq: { claim_action_id: actionId, is_current: true, is_active: true, file_type: "pdf" },
  });
  return rows[0] || null;
}

/** Verifica si la gestión tiene un documento editable (Word/Excel/PPT) */
export async function hasEditableDocument(actionId: string): Promise<boolean> {
  const doc = await getCurrentEditableDocument(actionId);
  return !!doc;
}

/** Verifica si la gestión tiene un PDF final */
export async function hasPdf(actionId: string): Promise<boolean> {
  const doc = await getCurrentPdf(actionId);
  return !!doc;
}

/** Obtiene un documento por id */
export async function getDocumentById(docId: string): Promise<ClaimActionDocument | null> {
  return fetchById<ClaimActionDocument>("claim_action_documents", docId, DOCUMENT_FIELDS);
}

// ──────────────────────────────────────────────────────────────
// Creación de versiones
// ──────────────────────────────────────────────────────────────

/**
 * Crea una nueva versión del documento.
 * - Invalida las versiones anteriores (is_current = false)
 * - Calcula el número de versión automáticamente
 * - Marca has_document en claim_actions si es un documento editable
 * - Marca has_pdf en claim_actions si es un PDF
 */
export async function createDocumentVersion(input: CreateDocumentVersionInput): Promise<ClaimActionDocument> {
  // 1. Obtener el número de versión siguiente
  const existing = await fetchAll<{ version: number }>("claim_action_documents", {
    select: "version",
    eq: { claim_action_id: input.claim_action_id, is_active: true },
    order: { column: "version", ascending: false },
  });
  const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1;

  // 2. Invalidar versiones anteriores (is_current = false)
  if (nextVersion > 1) {
    await updateWhere(
      "claim_action_documents",
      { is_current: false },
      { claim_action_id: input.claim_action_id, is_current: true }
    );
  }

  // 3. Insertar la nueva versión
  const doc = await insertRow<ClaimActionDocument>(
    "claim_action_documents",
    {
      claim_action_id: input.claim_action_id,
      claim_id: input.claim_id,
      version: nextVersion,
      source: input.source,
      document_template_id: input.document_template_id || null,
      file_url: input.file_url,
      file_path: input.file_path,
      file_name: input.file_name,
      original_filename: input.original_filename || null,
      mime_type: input.mime_type,
      file_size: input.file_size || null,
      file_type: input.file_type,
      workflow_level: input.workflow_level || null,
      created_by: input.created_by || null,
      is_current: true,
      is_active: true,
    },
    DOCUMENT_FIELDS
  );

  // 4. Marcar has_document o has_pdf en claim_actions
  const updates: Record<string, unknown> = { has_document: true };
  if (input.file_type === "pdf") {
    updates.has_pdf = true;
    updates.pdf_generated_at = new Date().toISOString();
  } else {
    // Si se sube un nuevo documento editable después de tener PDF, resetear has_pdf
    // (no debería pasar porque la acción debería estar cerrada, pero por seguridad)
    updates.has_pdf = false;
    updates.pdf_generated_at = null;
  }
  await updateRow("claim_actions", input.claim_action_id, updates);

  return doc;
}

// ──────────────────────────────────────────────────────────────
// Lock / Unlock
// ──────────────────────────────────────────────────────────────

/** Bloquea un documento para edición offline por un usuario */
export async function lockDocument(
  docId: string,
  userId: string,
  expiryHours = 24
): Promise<ClaimActionDocument> {
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
  return updateRow<ClaimActionDocument>(
    "claim_action_documents",
    docId,
    {
      locked_by: userId,
      locked_at: new Date().toISOString(),
      lock_expires_at: expiresAt,
    },
    DOCUMENT_FIELDS
  );
}

/** Desbloquea un documento (lo usa el mismo usuario que lo bloqueó) */
export async function unlockDocument(docId: string): Promise<ClaimActionDocument> {
  return updateRow<ClaimActionDocument>(
    "claim_action_documents",
    docId,
    {
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
    },
    DOCUMENT_FIELDS
  );
}

/** Fuerza el desbloqueo de un documento (admin) */
export async function forceUnlockDocument(docId: string): Promise<ClaimActionDocument> {
  return unlockDocument(docId);
}

/**
 * Verifica si un documento está locked por alguien distinto al usuario dado.
 * También verifica si el lock ya expiró (y lo libera si es así).
 */
export async function isDocumentLockedByOther(docId: string, userId: string): Promise<{
  locked: boolean;
  lockedBy?: { id: string; full_name: string; email: string } | null;
  expiresAt?: string | null;
}> {
  const doc = await getDocumentById(docId);
  if (!doc) return { locked: false };
  if (!doc.locked_by) return { locked: false };
  if (doc.locked_by === userId) return { locked: false };

  // Verificar si el lock expiró
  if (doc.lock_expires_at && new Date(doc.lock_expires_at) < new Date()) {
    await unlockDocument(docId);
    return { locked: false };
  }

  return {
    locked: true,
    lockedBy: doc.locked_by_user,
    expiresAt: doc.lock_expires_at,
  };
}

// ──────────────────────────────────────────────────────────────
// Restaurar versión anterior
// ──────────────────────────────────────────────────────────────

/**
 * Restaura una versión anterior creando una nueva versión con el mismo archivo.
 * No modifica la versión original — crea una nueva que apunta al mismo archivo en R2.
 */
export async function restoreDocumentVersion(
  docId: string,
  userId: string,
  workflowLevel: WorkflowLevel | null = null
): Promise<ClaimActionDocument> {
  const doc = await getDocumentById(docId);
  if (!doc) throw new Error("Documento no encontrado");

  return createDocumentVersion({
    claim_action_id: doc.claim_action_id,
    claim_id: doc.claim_id,
    source: doc.source,
    document_template_id: doc.document_template_id,
    file_url: doc.file_url,
    file_path: doc.file_path,
    file_name: doc.file_name,
    original_filename: doc.original_filename,
    mime_type: doc.mime_type,
    file_size: doc.file_size,
    file_type: doc.file_type,
    workflow_level: workflowLevel,
    created_by: userId,
  });
}

// ──────────────────────────────────────────────────────────────
// Utilidades
// ──────────────────────────────────────────────────────────────

/** Detecta el tipo de archivo por la extensión o mime type */
export function detectFileType(fileName: string, mimeType?: string): DocumentFileType {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  if (ext === "pptx") return "pptx";
  if (ext === "pdf") return "pdf";
  // Fallback por mime type
  if (mimeType) {
    if (mimeType.includes("wordprocessingml")) return "docx";
    if (mimeType.includes("spreadsheetml")) return "xlsx";
    if (mimeType.includes("presentationml")) return "pptx";
    if (mimeType.includes("pdf")) return "pdf";
  }
  return "pdf"; // default seguro
}

/** Mime type para un tipo de archivo */
export function mimeTypeFor(fileType: DocumentFileType): string {
  switch (fileType) {
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "pdf":
      return "application/pdf";
  }
}
