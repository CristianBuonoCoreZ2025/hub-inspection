import { fetchAll, insertRow } from "@/lib/supabase/db";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

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

async function resolveProfileId(
  raw: string | null | undefined,
  supabase?: SupabaseClient,
): Promise<{ id: string | null; full_name: string | null }> {
  if (!raw) return { id: null, full_name: null };
  const client = supabase || getSupabaseClient();
  const byId = await client.from("profiles").select("id, full_name").eq("id", raw).maybeSingle();
  const byIdData = byId.data as { id?: string; full_name?: string | null } | null;
  if (byIdData?.id) return { id: byIdData.id, full_name: byIdData.full_name ?? null };
  const byUser = await client.from("profiles").select("id, full_name").eq("user_id", raw).maybeSingle();
  const byUserData = byUser.data as { id?: string; full_name?: string | null } | null;
  if (byUserData?.id) return { id: byUserData.id, full_name: byUserData.full_name ?? null };
  return { id: null, full_name: null };
}

/**
 * Registra un evento en el historial de una gestión.
 * Si se pasa `supabase` (admin client), lo usa directamente (para API routes
 * donde no hay sesión del navegador y RLS bloquea el anon client).
 * `performed_by` puede ser un `profiles.id` o un `auth.users.id` (user_id);
 * se resuelve internamente al `profiles.id` correspondiente.
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
  supabase?: SupabaseClient;
}): Promise<void> {
  try {
    const [performer, prevResp, newResp] = await Promise.all([
      resolveProfileId(input.performed_by, input.supabase),
      resolveProfileId(input.previous_responsible, input.supabase),
      resolveProfileId(input.new_responsible, input.supabase),
    ]);

    const row = {
      claim_action_id: input.claim_action_id,
      event_type: input.event_type,
      from_status_code: input.from_status_code || null,
      to_status_code: input.to_status_code || null,
      performed_by: performer.id,
      performed_by_name: input.performed_by_name || performer.full_name || null,
      level: input.level || null,
      comment: input.comment || null,
      previous_responsible: prevResp.id,
      previous_responsible_name: input.previous_responsible_name || prevResp.full_name || null,
      new_responsible: newResp.id,
      new_responsible_name: input.new_responsible_name || newResp.full_name || null,
      metadata: input.metadata || null,
    };

    if (input.supabase) {
      // Usar el client pasado (admin client en API routes)
      const { error } = await input.supabase.from("claim_action_history").insert(row);
      if (error) throw new Error(error.message);
    } else {
      // Usar el client por defecto (anon, con sesión del navegador)
      await insertRow("claim_action_history", row);
    }
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
