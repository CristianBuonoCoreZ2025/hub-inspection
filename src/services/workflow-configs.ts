import { fetchAll, fetchById, insertRow, updateRow, deleteRow, getSupabaseClient } from "@/lib/supabase/db";

// ═══════════════════════════════════════════════════════════════════
// Servicio para Workflow de Siniestros
// ═══════════════════════════════════════════════════════════════════

const WORKFLOW_CONFIG_SELECT =
  "id, country_id, business_line_id, event_id, claim_status_id, is_active, created_at, updated_at, country:countries!workflow_configs_country_id_fkey(id, name), business_line:business_lines!workflow_configs_business_line_id_fkey(id, name, code_letter), event:events!workflow_configs_event_id_fkey(id, name), claim_status:lookup_catalog!workflow_configs_claim_status_id_fkey(id, code, name)";

const WORKFLOW_STEP_SELECT =
  "id, workflow_config_id, action_template_id, depends_on_template_id, level, sort_order, is_automatic, is_required, created_at, updated_at, action_template:action_template!workflow_steps_action_template_id_fkey(id, name, code, action_features_id, line_business_id, action_feature:action_features!action_template_action_features_id_fkey(id, name, code)), depends_on_template:action_template!workflow_steps_depends_on_template_id_fkey(id, name, code)";

export interface WorkflowConfig {
  id: string;
  country_id: string;
  business_line_id: string;
  event_id: string;
  claim_status_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  country?: { id: string; name: string } | null;
  business_line?: { id: string; name: string; code_letter: string } | null;
  event?: { id: string; name: string } | null;
  claim_status?: { id: string; code: string; name: string } | null;
}

export interface WorkflowStep {
  id: string;
  workflow_config_id: string;
  action_template_id: string;
  depends_on_template_id: string | null;
  level: number;
  sort_order: number;
  is_automatic: boolean;
  is_required: boolean;
  created_at: string;
  updated_at: string;
  action_template?: {
    id: string;
    name: string;
    code: string;
    action_features_id: string;
    line_business_id: string | null;
    action_feature?: { id: string; name: string; code: string };
  };
  depends_on_template?: { id: string; name: string; code: string } | null;
}

// ═══ Workflow Configs ═══

export async function getWorkflowConfigs(): Promise<WorkflowConfig[]> {
  return fetchAll<WorkflowConfig>("workflow_configs", {
    select: WORKFLOW_CONFIG_SELECT,
  });
}

export async function getWorkflowConfigById(id: string): Promise<WorkflowConfig | null> {
  return fetchById<WorkflowConfig>("workflow_configs", id, WORKFLOW_CONFIG_SELECT);
}

export async function createWorkflowConfig(input: {
  country_id: string;
  business_line_id: string;
  event_id: string;
  claim_status_id: string;
}): Promise<WorkflowConfig> {
  return insertRow<WorkflowConfig>("workflow_configs", {
    country_id: input.country_id,
    business_line_id: input.business_line_id,
    event_id: input.event_id,
    claim_status_id: input.claim_status_id,
  }, WORKFLOW_CONFIG_SELECT);
}

export async function updateWorkflowConfig(id: string, input: Partial<{
  is_active: boolean;
}>): Promise<WorkflowConfig> {
  return updateRow<WorkflowConfig>("workflow_configs", id, input, WORKFLOW_CONFIG_SELECT);
}

export async function deleteWorkflowConfig(id: string): Promise<void> {
  await deleteRow("workflow_configs", id);
}

// ═══ Workflow Steps ═══

export async function getWorkflowSteps(configId: string): Promise<WorkflowStep[]> {
  return fetchAll<WorkflowStep>("workflow_steps", {
    select: WORKFLOW_STEP_SELECT,
    eq: { workflow_config_id: configId },
    order: { column: "level", ascending: true },
  });
}

export async function createWorkflowStep(input: {
  workflow_config_id: string;
  action_template_id: string;
  level: number;
  depends_on_template_id?: string | null;
  sort_order?: number;
  is_automatic?: boolean;
  is_required?: boolean;
}): Promise<WorkflowStep> {
  return insertRow<WorkflowStep>("workflow_steps", {
    workflow_config_id: input.workflow_config_id,
    action_template_id: input.action_template_id,
    level: input.level,
    depends_on_template_id: input.depends_on_template_id || null,
    sort_order: input.sort_order || 0,
    is_automatic: input.is_automatic ?? true,
    is_required: input.is_required ?? true,
  }, WORKFLOW_STEP_SELECT);
}

export async function updateWorkflowStep(id: string, input: Partial<{
  level: number;
  sort_order: number;
  depends_on_template_id: string | null;
  is_automatic: boolean;
  is_required: boolean;
}>): Promise<WorkflowStep> {
  return updateRow<WorkflowStep>("workflow_steps", id, input, WORKFLOW_STEP_SELECT);
}

export async function deleteWorkflowStep(id: string): Promise<void> {
  await deleteRow("workflow_steps", id);
}

// ═══ Validacion: template en uso en workflow ═══

export async function isTemplateInWorkflow(templateId: string): Promise<boolean> {
  const rows = await fetchAll<{ id: string }>("workflow_steps", {
    select: "id",
    eq: { action_template_id: templateId },
  });
  return rows.length > 0;
}

// ═══ Cascading: obtener paises/eventos/lineas que tienen gestiones ═══
// Los templates tienen line_business_id (con country_id) pero NO event_id.
// El evento es una dimension del workflow, no un filtro de templates.
// Cascada: Estado > Pais (filtra por templates) > Evento (TODOS) > Linea (filtra por templates)

async function fetchTemplatesWithLine(claimStatusId: string): Promise<{
  line_id: string;
  line_name: string;
  line_code_letter: string;
  country_id: string;
}[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("action_template_claim_status")
    .select(`
      action_template:action_template!inner(
        id,
        line_business_id,
        is_active,
        business_line:business_lines(
          id, name, code_letter, country_id
        )
      )
    `)
    .eq("claim_status_id", claimStatusId)
    .eq("is_active", true)
    .eq("action_template.is_active", true);

  if (error) throw new Error(error.message);

  const rows = (data as any[]) || [];
  const lines = new Map<string, { line_id: string; line_name: string; line_code_letter: string; country_id: string }>();
  for (const row of rows) {
    const bl = row.action_template?.business_line;
    if (bl?.id && bl?.country_id) {
      lines.set(bl.id, {
        line_id: bl.id,
        line_name: bl.name,
        line_code_letter: bl.code_letter || "",
        country_id: bl.country_id,
      });
    }
  }
  return Array.from(lines.values());
}

export async function getAvailableCountriesForStatus(claimStatusId: string): Promise<{ id: string; name: string }[]> {
  const supabase = getSupabaseClient();
  const templates = await fetchTemplatesWithLine(claimStatusId);
  const countryIds = new Set(templates.map(t => t.country_id));
  if (countryIds.size === 0) return [];

  const { data, error } = await supabase
    .from("countries")
    .select("id, name")
    .in("id", Array.from(countryIds));

  if (error) throw new Error(error.message);
  return ((data as any[]) || []).map(c => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAvailableEventsForStatusAndCountry(claimStatusId: string, countryId: string): Promise<{ id: string; name: string }[]> {
  // Los eventos no estan vinculados a templates. Mostrar todos los eventos.
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, name");

  if (error) throw new Error(error.message);
  return ((data as any[]) || []).map(e => ({ id: e.id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAvailableLinesForStatusCountryEvent(claimStatusId: string, countryId: string, eventId: string): Promise<{ id: string; name: string; code_letter: string }[]> {
  // Las lineas se filtran por estado + pais (via templates), no por evento
  const templates = await fetchTemplatesWithLine(claimStatusId);
  const lines = templates
    .filter(t => t.country_id === countryId)
    .map(t => ({ id: t.line_id, name: t.line_name, code_letter: t.line_code_letter }));

  // Deduplicar
  const unique = new Map<string, { id: string; name: string; code_letter: string }>();
  for (const l of lines) unique.set(l.id, l);
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ═══ Dependencias intrinsecas conocidas ═══

export const INTRINSIC_DEPENDENCIES: Record<string, string> = {
  RES: "COB",
  PCA: "RES",
  RTA: "NSA",
  INS: "COI",
};

export function getIntrinsicDependency(templateCode: string): string | null {
  return INTRINSIC_DEPENDENCIES[templateCode] || null;
}
