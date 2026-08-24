import { fetchAll, insertRow, insertMany, updateRow, deleteRow } from "@/lib/supabase/db";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface DocumentRequirement {
  id: string;
  business_line_id: string | null;
  document_type_code: string;
  document_name: string;
  description: string | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface ClaimDocumentRequestItem {
  id: string;
  request_id: string;
  document_type_code: string;
  document_name: string;
  status: "requested" | "received" | "not_needed";
  received_file_url: string | null;
  received_file_id: string | null;
  received_at: string | null;
  received_by: string | null;
  not_needed_by: string | null;
  not_needed_at: string | null;
  notes: string | null;
  sort_order: number;
}

export interface ClaimDocumentRequest {
  id: string;
  claim_id: string;
  claim_action_id: string | null;
  request_number: string | null;
  status: "requested" | "received" | "closed" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by: string | null;
  claim_document_request_items?: ClaimDocumentRequestItem[];
}

// ──────────────────────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────────────────────

const REQUEST_ITEM_FIELDS =
  "id, request_id, document_type_code, document_name, status, received_file_url, received_file_id, received_at, received_by, not_needed_by, not_needed_at, notes, sort_order";

const REQUEST_FIELDS =
  "id, claim_id, claim_action_id, request_number, status, notes, created_at, updated_at, closed_at, closed_by";

const REQUEST_SELECT = `${REQUEST_FIELDS}, claim_document_request_items:claim_document_request_items(${REQUEST_ITEM_FIELDS})`;

// Obtener documentos requeridos por línea de negocio
export async function getDocumentRequirements(businessLineId?: string): Promise<DocumentRequirement[]> {
  const eq: Record<string, unknown> = { is_active: true };
  if (businessLineId) eq.business_line_id = businessLineId;

  return fetchAll<DocumentRequirement>("document_requirements", {
    select: "id, business_line_id, document_type_code, document_name, description, is_required, is_active, sort_order",
    eq,
    order: { column: "sort_order", ascending: true },
  });
}

// Obtener solicitudes de documentos de un siniestro
export async function getClaimDocumentRequests(claimId: string): Promise<ClaimDocumentRequest[]> {
  return fetchAll<ClaimDocumentRequest>("claim_document_requests", {
    select: REQUEST_SELECT,
    eq: { claim_id: claimId },
    order: { column: "created_at", ascending: false },
  });
}

// Obtener solicitud por acción (la más reciente si hay varias)
export async function getClaimDocumentRequestByAction(actionId: string): Promise<ClaimDocumentRequest | null> {
  const rows = await fetchAll<ClaimDocumentRequest>("claim_document_requests", {
    select: REQUEST_SELECT,
    eq: { claim_action_id: actionId },
    order: { column: "created_at", ascending: false },
    limit: 1,
  });
  return rows[0] || null;
}

// ──────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────

export async function createClaimDocumentRequest(input: {
  claim_id: string;
  claim_action_id?: string;
  notes?: string;
  company_id?: string;
  created_by?: string;
  items: { document_type_code: string; document_name: string; sort_order: number }[];
}): Promise<ClaimDocumentRequest> {
  const request = await insertRow<ClaimDocumentRequest>("claim_document_requests", {
    claim_id: input.claim_id,
    claim_action_id: input.claim_action_id || null,
    request_number: null,
    status: "requested",
    notes: input.notes || null,
    company_id: input.company_id || null,
    created_by: input.created_by || null,
  }, REQUEST_FIELDS);

  // Insertar items
  if (input.items.length > 0) {
    await insertMany("claim_document_request_items", input.items.map((item) => ({
      request_id: request.id,
      document_type_code: item.document_type_code,
      document_name: item.document_name,
      status: "requested",
      sort_order: item.sort_order,
    })));
  }

  return request;
}

export async function updateClaimDocumentRequestItem(
  itemId: string,
  updates: {
    status?: string;
    received_file_url?: string | null;
    received_file_id?: string | null;
    received_by?: string | null;
    not_needed_by?: string | null;
    not_needed_at?: string | null;
    notes?: string | null;
  }
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (updates.status !== undefined) {
    set.status = updates.status;
    if (updates.status === "received") {
      set.received_at = new Date().toISOString();
    }
    if (updates.status === "not_needed") {
      set.not_needed_at = new Date().toISOString();
    }
    // Al revertir a pendiente, limpiar marcas
    if (updates.status === "requested") {
      set.received_at = null;
      set.received_by = null;
      set.not_needed_at = null;
      set.not_needed_by = null;
      set.notes = null;
    }
  }
  if (updates.received_file_url !== undefined) set.received_file_url = updates.received_file_url;
  if (updates.received_file_id !== undefined) set.received_file_id = updates.received_file_id;
  if (updates.received_by !== undefined) set.received_by = updates.received_by;
  if (updates.not_needed_by !== undefined) set.not_needed_by = updates.not_needed_by;
  if (updates.not_needed_at !== undefined) set.not_needed_at = updates.not_needed_at;
  if (updates.notes !== undefined) set.notes = updates.notes;

  await updateRow("claim_document_request_items", itemId, set, "id");
}

export async function closeClaimDocumentRequest(requestId: string, closedBy?: string): Promise<void> {
  await updateRow("claim_document_requests", requestId, {
    status: "closed",
    closed_at: new Date().toISOString(),
    closed_by: closedBy || null,
  }, "id");
}

export async function cancelClaimDocumentRequest(requestId: string): Promise<void> {
  await updateRow("claim_document_requests", requestId, {
    status: "cancelled",
  }, "id");
}

// Agregar items a una solicitud existente
export async function addItemsToClaimDocumentRequest(
  requestId: string,
  items: { document_type_code: string; document_name: string; sort_order: number }[]
): Promise<void> {
  if (items.length === 0) return;
  await insertMany("claim_document_request_items", items.map((item) => ({
    request_id: requestId,
    document_type_code: item.document_type_code,
    document_name: item.document_name,
    status: "requested",
    sort_order: item.sort_order,
  })));
}

// Eliminar un item de una solicitud (solo si no está recibido)
export async function removeItemFromClaimDocumentRequest(itemId: string): Promise<void> {
  await deleteRow("claim_document_request_items", itemId, "id");
}

// Actualizar notas de una solicitud
export async function updateClaimDocumentRequestNotes(requestId: string, notes: string): Promise<void> {
  await updateRow("claim_document_requests", requestId, { notes: notes || null }, "id");
}

// ──────────────────────────────────────────────────────────────
// CRUD: document_requirements (configuración por línea de negocio)
// ──────────────────────────────────────────────────────────────

export async function getDocumentRequirementsByBusinessLine(businessLineId: string): Promise<DocumentRequirement[]> {
  return fetchAll<DocumentRequirement>("document_requirements", {
    select: "id, business_line_id, document_type_code, document_name, description, is_required, is_active, sort_order",
    eq: { business_line_id: businessLineId, is_active: true },
    order: { column: "sort_order", ascending: true },
  });
}

export async function createDocumentRequirement(input: {
  business_line_id: string;
  document_type_code: string;
  description?: string | null;
  is_required: boolean;
  sort_order: number;
}): Promise<DocumentRequirement> {
  // Obtener el nombre desde document_types (no inventarlo)
  const { getSupabaseClient } = await import("@/lib/supabase/client");
  const supabase = getSupabaseClient();
  const { data: docType } = await supabase
    .from("document_types")
    .select("name")
    .eq("code", input.document_type_code)
    .maybeSingle();

  return insertRow<DocumentRequirement>("document_requirements", {
    business_line_id: input.business_line_id,
    document_type_code: input.document_type_code,
    document_name: docType?.name || input.document_type_code,
    description: input.description || null,
    is_required: input.is_required,
    is_active: true,
    sort_order: input.sort_order,
  }, "id, business_line_id, document_type_code, document_name, description, is_required, is_active, sort_order");
}

export async function updateDocumentRequirement(id: string, input: {
  is_required?: boolean;
  is_active?: boolean;
  sort_order?: number;
}): Promise<void> {
  const set: Record<string, unknown> = {};
  if (input.is_required !== undefined) set.is_required = input.is_required;
  if (input.is_active !== undefined) set.is_active = input.is_active;
  if (input.sort_order !== undefined) set.sort_order = input.sort_order;
  await updateRow("document_requirements", id, set, "id");
}

export async function deleteDocumentRequirement(id: string): Promise<void> {
  await deleteRow("document_requirements", id, "id");
}
