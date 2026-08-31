import { fetchAll, insertRow, deleteRow, getSupabaseClient } from "@/lib/supabase/db";

export interface TemplateDependency {
  id: string;
  parent_code: string;
  child_code: string;
  condition_field?: string | null;
  condition_value?: string | null;
  created_at: string;
}

const DEPENDENCY_SELECT = "id, parent_code, child_code, condition_field, condition_value, created_at";

export async function getDependencies(): Promise<TemplateDependency[]> {
  return fetchAll<TemplateDependency>("action_template_dependencies", {
    select: DEPENDENCY_SELECT,
    order: { column: "parent_code", ascending: true },
  });
}

export async function createDependency(
  parentCode: string,
  childCode: string,
  condition?: { field?: string | null; value?: string | null }
): Promise<TemplateDependency> {
  const payload: Record<string, unknown> = { parent_code: parentCode, child_code: childCode };
  if (condition?.field && condition?.value) {
    payload.condition_field = condition.field;
    payload.condition_value = condition.value;
  }
  return insertRow<TemplateDependency>(
    "action_template_dependencies",
    payload,
    DEPENDENCY_SELECT
  );
}

export async function deleteDependency(id: string): Promise<void> {
  await deleteRow("action_template_dependencies", id);
}

/**
 * Obtiene los codigos de templates que son hijos (dependientes) de otros.
 * Sirve para filtrar en el workflow builder: solo mostrar templates raiz.
 */
export async function getChildTemplateCodes(): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("action_template_dependencies")
    .select("child_code");
  if (error) throw new Error(error.message);
  return new Set(((data as { child_code: string }[]) || []).map(r => r.child_code));
}

/**
 * Obtiene toda la cadena de dependencias de un template por su codigo.
 * Retorna array ordenado por profundidad: [hijo, nieto, ...]
 */
export async function getDependencyChainByCode(rootCode: string): Promise<{ code: string; parent_code: string; level: number }[]> {
  const supabase = getSupabaseClient();
  const result: { code: string; parent_code: string; level: number }[] = [];

  async function traverse(parentCode: string, level: number) {
    const { data, error } = await supabase
      .from("action_template_dependencies")
      .select("child_code")
      .eq("parent_code", parentCode);
    if (error) throw new Error(error.message);
    for (const row of (data as { child_code: string }[]) || []) {
      result.push({ code: row.child_code, parent_code: parentCode, level });
      await traverse(row.child_code, level + 1);
    }
  }

  await traverse(rootCode, 1);
  return result;
}
