import { fetchById, insertRow, updateRow, deleteRow, getSupabaseClient } from "@/lib/supabase/db";
import type { InspectorGroup, InspectorGroupMember } from "@/types";

// ═══════════════════════════════════════════════════════════════
// Servicio para agrupaciones de inspectores
// ═══════════════════════════════════════════════════════════════

const GROUP_SELECT = "id, name, description, created_at, updated_at";
const MEMBER_SELECT = "id, group_id, inspector_id, created_at";

// ── Listar agrupaciones (con count de miembros) ──
export async function getInspectorGroups() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("inspector_groups")
    .select(`${GROUP_SELECT}, inspector_group_members(count)`)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((g: Record<string, unknown>) => ({
    id: g.id as string,
    name: g.name as string,
    description: g.description as string | null,
    member_count: (g.inspector_group_members as { count: number }[] | undefined)?.[0]?.count ?? 0,
    created_at: g.created_at as string,
    updated_at: g.updated_at as string,
  })) as InspectorGroup[];
}

// ── Obtener agrupación por ID ──
export async function getInspectorGroup(id: string) {
  return fetchById<InspectorGroup>("inspector_groups", id, GROUP_SELECT);
}

// ── Crear agrupación ──
export async function createInspectorGroup(name: string, description?: string) {
  return insertRow<InspectorGroup>("inspector_groups", { name, description: description || null }, GROUP_SELECT);
}

// ── Actualizar agrupación ──
export async function updateInspectorGroup(id: string, name: string, description?: string) {
  return updateRow<InspectorGroup>("inspector_groups", id, { name, description: description || null }, GROUP_SELECT);
}

// ── Eliminar agrupación (cascada elimina miembros) ──
export async function deleteInspectorGroup(id: string) {
  return deleteRow("inspector_groups", id);
}

// ── Listar miembros de una agrupación (con datos del inspector) ──
export async function getGroupMembers(groupId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("inspector_group_members")
    .select(`${MEMBER_SELECT}, inspector:profiles!inspector_group_members_inspector_id_fkey(full_name, email)`)
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    group_id: m.group_id as string,
    inspector_id: m.inspector_id as string,
    inspector_name: (m.inspector as { full_name: string | null } | null)?.full_name ?? null,
    inspector_email: (m.inspector as { email: string | null } | null)?.email ?? null,
    created_at: m.created_at as string,
  })) as InspectorGroupMember[];
}

// ── Agregar inspector a agrupación ──
// Si el inspector ya está en otra agrupación, se mueve a esta (unique constraint)
export async function addGroupMember(groupId: string, inspectorId: string) {
  const supabase = getSupabaseClient();
  // Si ya está en otra agrupación, eliminarlo primero
  await supabase
    .from("inspector_group_members")
    .delete()
    .eq("inspector_id", inspectorId);
  // Insertar en la nueva agrupación
  const { data, error } = await supabase
    .from("inspector_group_members")
    .insert({ group_id: groupId, inspector_id: inspectorId })
    .select(MEMBER_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as InspectorGroupMember;
}

// ── Quitar inspector de agrupación ──
// Bloqueado si el inspector ya fue incluido en una nómina de facturación de inspecciones.
// Para sacarlo de futuras nóminas, moverlo a otra agrupación (addGroupMember).
export async function removeGroupMember(memberId: string) {
  const supabase = getSupabaseClient();

  // Verificar si el inspector tiene items en nóminas de facturación de inspecciones
  const { data: member } = await supabase
    .from("inspector_group_members")
    .select("inspector_id")
    .eq("id", memberId)
    .single();

  if (member) {
    const { count } = await supabase
      .from("inspection_billing_batch_items")
      .select("id", { count: "exact", head: true })
      .eq("inspector_id", member.inspector_id);

    if ((count || 0) > 0) {
      throw new Error("No se puede quitar el inspector porque ya fue incluido en una nómina. Muévalo a otra agrupación si desea excluirlo de futuras nóminas.");
    }
  }

  return deleteRow("inspector_group_members", memberId);
}

// ── Obtener IDs de inspectores de una agrupación ──
export async function getGroupInspectorIds(groupId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("inspector_group_members")
    .select("inspector_id")
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  return (data || []).map((m: { inspector_id: string }) => m.inspector_id);
}
