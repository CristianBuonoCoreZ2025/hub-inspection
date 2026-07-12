import { fetchAll, insertRow, deleteRow, getSupabaseClient } from "@/lib/supabase/db";

export interface TemplateDependency {
  id: string;
  parent_template_id: string;
  child_template_id: string;
  parent_template?: { id: string; code: string; name: string };
  child_template?: { id: string; code: string; name: string };
  created_at: string;
}

const DEPENDENCY_SELECT = `
  id, parent_template_id, child_template_id, created_at,
  parent_template:action_template!action_template_dependencies_parent_template_id_fkey(id, code, name),
  child_template:action_template!action_template_dependencies_child_template_id_fkey(id, code, name)
`;

export async function getDependencies(): Promise<TemplateDependency[]> {
  return fetchAll<TemplateDependency>("action_template_dependencies", {
    select: DEPENDENCY_SELECT,
    order: { column: "created_at", ascending: true },
  });
}

export async function createDependency(parentTemplateId: string, childTemplateId: string): Promise<TemplateDependency> {
  return insertRow<TemplateDependency>(
    "action_template_dependencies",
    { parent_template_id: parentTemplateId, child_template_id: childTemplateId },
    DEPENDENCY_SELECT
  );
}

export async function deleteDependency(id: string): Promise<void> {
  await deleteRow("action_template_dependencies", id);
}

/**
 * Obtiene los template_ids que son hijos (dependientes) de otros.
 * Sirve para filtrar en el workflow builder: solo mostrar templates raiz.
 */
export async function getChildTemplateIds(): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("action_template_dependencies")
    .select("child_template_id");
  if (error) throw new Error(error.message);
  return new Set(((data as any[]) || []).map(r => r.child_template_id));
}

/**
 * Obtiene los hijos directos de un template.
 */
export async function getChildTemplates(parentTemplateId: string): Promise<{ id: string; code: string; name: string }[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("action_template_dependencies")
    .select(`
      child_template:action_template!action_template_dependencies_child_template_id_fkey(id, code, name)
    `)
    .eq("parent_template_id", parentTemplateId);
  if (error) throw new Error(error.message);
  return ((data as any[]) || [])
    .map(r => r.child_template)
    .filter(Boolean) as { id: string; code: string; name: string }[];
}

/**
 * Obtiene toda la cadena de dependencias de un template (hijos, nietos, etc).
 * Retorna array ordenado por profundidad: [hijo1, hijo2_de_hijo1, ...]
 */
export async function getDependencyChain(rootTemplateId: string): Promise<{ template_id: string; parent_template_id: string; level: number }[]> {
  const supabase = getSupabaseClient();
  const result: { template_id: string; parent_template_id: string; level: number }[] = [];

  async function traverse(parentId: string, level: number) {
    const { data, error } = await supabase
      .from("action_template_dependencies")
      .select("child_template_id")
      .eq("parent_template_id", parentId);
    if (error) throw new Error(error.message);
    for (const row of (data as any[]) || []) {
      result.push({ template_id: row.child_template_id, parent_template_id: parentId, level });
      await traverse(row.child_template_id, level + 1);
    }
  }

  await traverse(rootTemplateId, 1);
  return result;
}
