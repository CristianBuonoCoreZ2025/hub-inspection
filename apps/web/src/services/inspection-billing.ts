import { fetchAll, insertRow, insertMany, updateRow, getSupabaseClient } from "@/lib/supabase/db";
import { getGroupInspectorIds } from "./inspector-groups";
import type { InspectionBillingBatch, InspectionBillingBatchItem } from "@/types";

// ═══════════════════════════════════════════════════════════════
// Servicio para nóminas de facturación de inspecciones (por agrupación)
// ═══════════════════════════════════════════════════════════════
//
// Diferencia con billing.ts (facturación de accesos):
//   - Filtra por agrupación de inspectores
//   - Marca es distinta (inspection_billing_batch_items.billed)
//   - Una inspección puede estar en ambos procesos
// ═══════════════════════════════════════════════════════════════

const BATCH_SELECT = "id, group_id, name, status, generated_at, sent_at, approved_at, approved_by, item_count, created_at, updated_at";
const ITEM_SELECT = "id, batch_id, session_id, claim_id, inspector_id, include_for_billing, billed, liquidation_number, case_code, inspection_number, client_reference, inspector_name, insured_name, claim_address, inspection_date, inspection_type, created_at";

// ── Listar nóminas (con nombre de agrupación) ──
export async function getInspectionBillingBatches() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("inspection_billing_batches")
    .select(`${BATCH_SELECT}, group:inspector_groups!inspection_billing_batches_group_id_fkey(name)`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((b: Record<string, unknown>) => ({
    id: b.id as string,
    group_id: b.group_id as string,
    group_name: (b.group as { name: string } | null)?.name ?? null,
    name: b.name as string,
    status: b.status as InspectionBillingBatch["status"],
    generated_at: b.generated_at as string,
    sent_at: b.sent_at as string | null,
    approved_at: b.approved_at as string | null,
    approved_by: b.approved_by as string | null,
    item_count: b.item_count as number,
    created_at: b.created_at as string,
    updated_at: b.updated_at as string,
  })) as InspectionBillingBatch[];
}

// ── Obtener nómina por ID ──
export async function getInspectionBillingBatch(id: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("inspection_billing_batches")
    .select(`${BATCH_SELECT}, group:inspector_groups!inspection_billing_batches_group_id_fkey(name)`)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return {
    ...data,
    group_name: (data as unknown as { group?: { name: string } | null })?.group?.name ?? null,
  } as InspectionBillingBatch;
}

// ── Obtener items de una nómina ──
export async function getInspectionBillingBatchItems(batchId: string) {
  return fetchAll<InspectionBillingBatchItem>("inspection_billing_batch_items", {
    select: ITEM_SELECT,
    eq: { batch_id: batchId },
    order: { column: "case_code", ascending: true },
  });
}

// ── Generar nueva nómina por agrupación ──
// Trae inspecciones completadas de los inspectores de la agrupación
// que no estén ya facturadas (billed=true) en inspection_billing_batch_items
export async function generateInspectionBillingBatch(groupId: string) {
  const supabase = getSupabaseClient();

  // 1. Obtener IDs de inspectores de la agrupación
  const inspectorIds = await getGroupInspectorIds(groupId);
  if (inspectorIds.length === 0) {
    throw new Error("La agrupación no tiene inspectores");
  }

  // 2. Traer session_ids que ya están facturadas en inspection_billing
  const { data: billedItems } = await supabase
    .from("inspection_billing_batch_items")
    .select("session_id")
    .eq("billed", true);
  const billedSessionIds = (billedItems || []).map((i: { session_id: string }) => i.session_id);

  // 3. Traer inspecciones completadas de los inspectores de la agrupación
  const { data: sessions, error } = await supabase
    .from("inspection_sessions")
    .select(
      "id, claim_id, inspector_id, status, inspection_type, inspection_date, ended_at, inspection_number, inspector:profiles!inspection_sessions_inspector_id_fkey(full_name), claim_action:claim_actions!inspection_sessions_claim_action_id_fkey(code), claim:claims!inspection_sessions_claim_id_fkey(liquidation_number, client_reference, claim_address, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name))"
    )
    .eq("status", "completed")
    .in("inspector_id", inspectorIds)
    .order("ended_at", { ascending: false });

  if (error) throw new Error(error.message);

  // Filtrar las ya facturadas client-side
  const available = (sessions || []).filter(
    (s: { id: string }) => !billedSessionIds.includes(s.id)
  );

  if (available.length === 0) {
    throw new Error("No hay inspecciones completadas pendientes de facturación para esta agrupación");
  }

  // 4. Crear la nómina
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const { data: groupData } = await supabase
    .from("inspector_groups")
    .select("name")
    .eq("id", groupId)
    .single();
  const groupName = groupData?.name || "Agrupación";
  const batchName = `Nómina ${groupName} ${dateStr}`;

  const batch = await insertRow<InspectionBillingBatch>("inspection_billing_batches", {
    group_id: groupId,
    name: batchName,
    status: "pendiente_revision",
    generated_at: now.toISOString(),
    item_count: available.length,
  }, BATCH_SELECT);

  // 5. Crear los items con snapshot de datos
  const items = available.map((s: {
    id: string;
    claim_id: string;
    inspector_id: string | null;
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
  }) => {
    const insured = s.claim?.claims_participants?.find((p) => p.type === "insured");
    return {
      batch_id: batch.id,
      session_id: s.id,
      claim_id: s.claim_id,
      inspector_id: s.inspector_id,
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

  await insertMany("inspection_billing_batch_items", items, "id");

  return batch;
}

// ── Actualizar item (toggle include_for_billing) ──
export async function updateInspectionBillingItem(id: string, include_for_billing: boolean) {
  return updateRow<InspectionBillingBatchItem>("inspection_billing_batch_items", id, { include_for_billing }, ITEM_SELECT);
}

// ── Emitir nómina para revisión ──
export async function sendInspectionBatchForReview(id: string) {
  const now = new Date().toISOString();
  return updateRow<InspectionBillingBatch>("inspection_billing_batches", id, {
    status: "enviada_revision",
    sent_at: now,
  }, BATCH_SELECT);
}

// ── Aprobar nómina (marca items como billed) ──
export async function approveInspectionBatch(id: string, approvedBy: string) {
  const supabase = getSupabaseClient();

  const { error: updateError } = await supabase
    .from("inspection_billing_batch_items")
    .update({ billed: true })
    .eq("batch_id", id)
    .eq("include_for_billing", true);

  if (updateError) throw new Error(updateError.message);

  const now = new Date().toISOString();
  return updateRow<InspectionBillingBatch>("inspection_billing_batches", id, {
    status: "aprobada",
    approved_at: now,
    approved_by: approvedBy,
  }, BATCH_SELECT);
}

// ── Contar inspecciones pendientes por agrupación ──
export async function countPendingInspectionBilling(groupId: string): Promise<number> {
  const supabase = getSupabaseClient();

  const inspectorIds = await getGroupInspectorIds(groupId);
  if (inspectorIds.length === 0) return 0;

  const { data: billedItems } = await supabase
    .from("inspection_billing_batch_items")
    .select("session_id")
    .eq("billed", true);
  const billedSessionIds = (billedItems || []).map((i: { session_id: string }) => i.session_id);

  const { data: sessions } = await supabase
    .from("inspection_sessions")
    .select("id")
    .eq("status", "completed")
    .in("inspector_id", inspectorIds);

  const available = (sessions || []).filter(
    (s: { id: string }) => !billedSessionIds.includes(s.id)
  );

  return available.length;
}
