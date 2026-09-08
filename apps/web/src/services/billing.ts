import { fetchAll, fetchById, insertRow, insertMany, updateRow, getSupabaseClient, fetchAllPages } from "@/lib/supabase/db";
import type { BillingBatch, BillingBatchItem } from "@/types";

// ═══════════════════════════════════════════════════════════════
// Servicio para nóminas de facturación de inspecciones
// ═══════════════════════════════════════════════════════════════

const BATCH_SELECT = "id, company_id, name, status, cutoff_date, generated_at, sent_at, approved_at, approved_by, item_count, created_at, updated_at";
const ITEM_SELECT = "id, batch_id, session_id, claim_id, include_for_billing, billed, liquidation_number, case_code, inspection_number, client_reference, inspector_name, insured_name, claim_address, inspection_date, inspection_type, created_at";

const SESSION_SELECT = "id, company_id, claim_id, status, inspection_type, inspection_date, ended_at, inspection_number, inspector:profiles!inspection_sessions_inspector_id_fkey(full_name), claim_action:claim_actions!inspection_sessions_claim_action_id_fkey(code), claim:claims!inspection_sessions_claim_id_fkey(liquidation_number, client_reference, claim_address, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name))";

// Fin del día de corte en la zona horaria LOCAL del navegador (sin sufijo Z)
function cutoffEndOfDay(cutoffDate: string): Date {
  return new Date(`${cutoffDate}T23:59:59.999`);
}

interface SessionRow {
  id: string;
  claim_id: string;
  inspection_type: string;
  inspection_date: string | null;
  ended_at: string | null;
  inspection_number: string | null;
  inspector?: { full_name: string | null } | null;
  claim_action?: { code: string | null } | null;
  claim?: {
    liquidation_number?: string;
    client_reference?: string;
    claim_address?: string;
    claims_participants?: { type: string; full_name?: string }[];
  };
}

// ── Listar nóminas ──
export async function getBillingBatches() {
  return fetchAll<BillingBatch>("billing_batches", {
    select: BATCH_SELECT,
    order: { column: "created_at", ascending: false },
  });
}

// ── Obtener nómina por ID ──
export async function getBillingBatch(id: string) {
  return fetchById<BillingBatch>("billing_batches", id, BATCH_SELECT);
}

// ── Obtener items de una nómina ──
export async function getBillingBatchItems(batchId: string) {
  return fetchAll<BillingBatchItem>("billing_batch_items", {
    select: ITEM_SELECT,
    eq: { batch_id: batchId },
    order: { column: "case_code", ascending: true },
  });
}

// ── Generar nueva nómina ──
// Trae inspecciones completed que no estén ya facturadas (billed=true)
// cutoffDate: fecha de corte YYYY-MM-DD — solo incluye inspecciones
// con ended_at <= fin del día de corte. Si es null, no hay limite.
export async function generateBillingBatch(companyId?: string | null, cutoffDate?: string | null) {
  const supabase = getSupabaseClient();

  // 1. Traer session_ids que ya están facturadas (paginado)
  const billedItems = await fetchAllPages<{ session_id: string }>((from, to) =>
    supabase.from("billing_batch_items").select("session_id").eq("billed", true).range(from, to)
  );
  const billedSessionIds = new Set(billedItems.map((i) => i.session_id));

  // 2. Traer inspecciones completadas dentro del corte (paginado)
  const cutoffIso = cutoffDate ? cutoffEndOfDay(cutoffDate).toISOString() : null;
  const sessions = await fetchAllPages<SessionRow>((from, to) => {
    let query = supabase
      .from("inspection_sessions")
      .select(SESSION_SELECT)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .range(from, to);
    if (companyId) query = query.eq("company_id", companyId);
    if (cutoffIso) query = query.lte("ended_at", cutoffIso);
    return query;
  });

  // Filtrar las ya facturadas client-side
  const available = sessions.filter((s) => !billedSessionIds.has(s.id));

  if (available.length === 0) {
    throw new Error("No hay inspecciones completadas pendientes de facturación" + (cutoffDate ? ` hasta el ${cutoffDate}` : ""));
  }

  // 3. Crear la nómina
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const batchName = cutoffDate ? `Nómina corte ${cutoffDate}` : `Nómina ${dateStr}`;

  const batch = await insertRow<BillingBatch>("billing_batches", {
    company_id: companyId || null,
    name: batchName,
    status: "pendiente_revision",
    cutoff_date: cutoffDate || null,
    generated_at: now.toISOString(),
    item_count: available.length,
  }, BATCH_SELECT);

  // 4. Crear los items con snapshot de datos
  const items = available.map((s) => {
    const insured = s.claim?.claims_participants?.find((p) => p.type === "insured");
    return {
      batch_id: batch.id,
      session_id: s.id,
      claim_id: s.claim_id,
      include_for_billing: true,
      billed: false,
      liquidation_number: s.claim?.liquidation_number || null,
      case_code: s.claim_action?.code || null,
      inspection_number: s.inspection_number || s.claim_action?.code || null,
      client_reference: s.claim?.client_reference || null,
      inspector_name: s.inspector?.full_name || null,
      insured_name: insured?.full_name || null,
      claim_address: s.claim?.claim_address || null,
      inspection_date: s.inspection_date || s.ended_at || null,
      inspection_type: s.inspection_type || null,
    };
  });

  await insertMany("billing_batch_items", items, "id");

  return batch;
}

// ── Actualizar item (toggle include_for_billing) ──
export async function updateBillingItem(id: string, include_for_billing: boolean) {
  return updateRow<BillingBatchItem>("billing_batch_items", id, { include_for_billing }, ITEM_SELECT);
}

// ── Emitir nómina para revisión (genera Excel, cambia estado) ──
export async function sendBatchForReview(id: string) {
  const now = new Date().toISOString();
  return updateRow<BillingBatch>("billing_batches", id, {
    status: "enviada_revision",
    sent_at: now,
  }, BATCH_SELECT);
}

// ── Aprobar nómina (marca items como billed) ──
export async function approveBatch(id: string, approvedBy: string) {
  const supabase = getSupabaseClient();

  // Marcar items con include_for_billing=true como billed=true
  const { error: updateError } = await supabase
    .from("billing_batch_items")
    .update({ billed: true })
    .eq("batch_id", id)
    .eq("include_for_billing", true);

  if (updateError) throw new Error(updateError.message);

  // Actualizar la nómina
  const now = new Date().toISOString();
  return updateRow<BillingBatch>("billing_batches", id, {
    status: "aprobada",
    approved_at: now,
    approved_by: approvedBy,
  }, BATCH_SELECT);
}

// ── Contar inspecciones pendientes de facturación ──
// cutoffDate: si se pasa, cuenta solo las de ended_at <= fin del día de corte
export async function countPendingBilling(companyId?: string | null, cutoffDate?: string | null): Promise<number> {
  const supabase = getSupabaseClient();

  const billedItems = await fetchAllPages<{ session_id: string }>((from, to) =>
    supabase.from("billing_batch_items").select("session_id").eq("billed", true).range(from, to)
  );
  const billedSessionIds = new Set(billedItems.map((i) => i.session_id));

  const cutoffIso = cutoffDate ? cutoffEndOfDay(cutoffDate).toISOString() : null;
  const sessions = await fetchAllPages<{ id: string }>((from, to) => {
    let query = supabase
      .from("inspection_sessions")
      .select("id")
      .eq("status", "completed")
      .range(from, to);
    if (companyId) query = query.eq("company_id", companyId);
    if (cutoffIso) query = query.lte("ended_at", cutoffIso);
    return query;
  });

  return sessions.filter((s) => !billedSessionIds.has(s.id)).length;
}
