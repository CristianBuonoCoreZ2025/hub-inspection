import { fetchAll, insertRow } from "@/lib/supabase/db";

export interface ClaimActionHistoryEntry {
  id: string;
  claim_action_id: string;
  event_type: string;
  from_status_code: string | null;
  to_status_code: string | null;
  performed_by: string | null;
  performed_by_name: string | null;
  level: string | null;
  comment: string | null;
  previous_responsible: string | null;
  previous_responsible_name: string | null;
  new_responsible: string | null;
  new_responsible_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  performed_by_profile?: { id: string; full_name: string; email: string } | null;
}

const HISTORY_FIELDS =
  "id, claim_action_id, event_type, from_status_code, to_status_code, performed_by, performed_by_name, level, comment, previous_responsible, previous_responsible_name, new_responsible, new_responsible_name, metadata, created_at, performed_by_profile:profiles!claim_action_history_performed_by_fkey(id, full_name, email)";

/**
 * Registra un evento en el historial de una gestión.
 * Función interna — no exportar.
 */
export async function logActionHistory(input: {
  claim_action_id: string;
  event_type: string;
  from_status_code?: string | null;
  to_status_code?: string | null;
  performed_by?: string | null;
  performed_by_name?: string | null;
  level?: string | null;
  comment?: string | null;
  previous_responsible?: string | null;
  previous_responsible_name?: string | null;
  new_responsible?: string | null;
  new_responsible_name?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await insertRow("claim_action_history", {
      claim_action_id: input.claim_action_id,
      event_type: input.event_type,
      from_status_code: input.from_status_code || null,
      to_status_code: input.to_status_code || null,
      performed_by: input.performed_by || null,
      performed_by_name: input.performed_by_name || null,
      level: input.level || null,
      comment: input.comment || null,
      previous_responsible: input.previous_responsible || null,
      previous_responsible_name: input.previous_responsible_name || null,
      new_responsible: input.new_responsible || null,
      new_responsible_name: input.new_responsible_name || null,
      metadata: input.metadata || null,
    });
  } catch (err) {
    // No lanzar error — el historial es best-effort, no debe bloquear la operación principal
    console.error("Error logging action history:", err);
  }
}

/**
 * Obtiene el historial completo de una gestión, ordenado del más reciente al más antiguo.
 */
export async function getActionHistory(actionId: string): Promise<ClaimActionHistoryEntry[]> {
  return fetchAll<ClaimActionHistoryEntry>("claim_action_history", {
    select: HISTORY_FIELDS,
    eq: { claim_action_id: actionId },
    order: { column: "created_at", ascending: false },
  });
}
