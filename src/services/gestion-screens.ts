import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabase/db";
import type { GestionScreen, CharacteristicScreen, ClaimAction } from "@/types";

const SCREEN_FIELDS =
  "id, code, name, description, icon, form_schema, is_active, sort_order";

// ═══════════════════════════════════════════════════════════════════
// Servicio para el catálogo de pantallas de gestión y su relación
// con las características (many-to-many).
// ═══════════════════════════════════════════════════════════════════

export async function getGestionScreens(): Promise<GestionScreen[]> {
  return fetchAll<GestionScreen>("gestion_screens", {
    select: SCREEN_FIELDS,
    eq: { is_active: true },
    order: { column: "sort_order", ascending: true },
  }).then((rows) =>
    rows.sort((a, b) => {
      if (a.sort_order === b.sort_order) return a.name.localeCompare(b.name);
      return a.sort_order - b.sort_order;
    })
  );
}

export async function getGestionScreenByCode(code: string): Promise<GestionScreen | null> {
  const rows = await fetchAll<GestionScreen>("gestion_screens", {
    select: SCREEN_FIELDS,
    eq: { code, is_active: true },
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function getCharacteristicScreens(characteristicId: string): Promise<CharacteristicScreen[]> {
  return fetchAll<CharacteristicScreen>("characteristic_screens", {
    select: "id, characteristic_id, screen_id, is_default, screen(id, code, name, description, icon, form_schema)",
    eq: { characteristic_id: characteristicId },
    order: { column: "is_default", ascending: false },
  });
}

/**
 * Dado un claim_action, retorna la pantalla asociada al action_feature.
 * Cada action_feature (característica) apunta a una sola pantalla (screen_id).
 * Si es null, se usa la pantalla genérica por defecto.
 */
export async function getGestionScreensForClaimAction(action: ClaimAction): Promise<GestionScreen[]> {
  const feature = action.action_feature;
  if (!feature) return [];

  const genericScreen = await getGestionScreenByCode("generica");
  const screen = feature.screen || genericScreen;

  return screen ? [screen] : [];
}

/**
 * Asociar una pantalla a una característica.
 */
export async function associateScreenToCharacteristic(
  characteristicId: string,
  screenId: string,
  isDefault = false
): Promise<CharacteristicScreen> {
  return insertRow<CharacteristicScreen>("characteristic_screens", {
    characteristic_id: characteristicId,
    screen_id: screenId,
    is_default: isDefault,
  }, "id, characteristic_id, screen_id, is_default, screen(id, code, name)");
}

/**
 * Actualizar el form_schema de una pantalla.
 * Usa API route con admin secret para evitar problemas de permisos de Hasura.
 */
export async function updateGestionScreen(id: string, formSchema: Record<string, unknown>): Promise<{ id: string; code: string; name: string; form_schema: unknown }> {
  const res = await fetch("/api/gestion-screens/update-schema", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, form_schema: formSchema }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al actualizar pantalla" }));
    throw new Error(err.error || "Error al actualizar pantalla");
  }
  return res.json();
}

/**
 * Crear una nueva pantalla de gestión.
 */
export async function createGestionScreen(input: {
  code: string;
  name: string;
  description?: string;
  icon?: string;
  form_schema?: Record<string, unknown>;
  sort_order?: number;
}): Promise<GestionScreen> {
  return insertRow<GestionScreen>("gestion_screens", {
    code: input.code,
    name: input.name,
    description: input.description || null,
    icon: input.icon || null,
    form_schema: input.form_schema || { fields: [] },
    sort_order: input.sort_order ?? 0,
  }, SCREEN_FIELDS);
}

/**
 * Actualizar datos básicos de una pantalla (sin form_schema).
 */
export async function updateGestionScreenBase(id: string, input: {
  name?: string;
  description?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}): Promise<GestionScreen> {
  const set: Record<string, unknown> = {};
  Object.entries(input).forEach(([k, v]) => { if (v !== undefined) set[k] = v; });

  return updateRow<GestionScreen>("gestion_screens", id, set, SCREEN_FIELDS);
}

/**
 * Desactivar una pantalla.
 */
export async function deactivateGestionScreen(id: string): Promise<GestionScreen> {
  return updateGestionScreenBase(id, { is_active: false });
}

/**
 * Remover una asociación característica-pantalla.
 */
export async function removeCharacteristicScreen(id: string): Promise<void> {
  await deleteRow("characteristic_screens", id);
}
