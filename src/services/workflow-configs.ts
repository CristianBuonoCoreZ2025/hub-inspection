import { fetchAll, fetchById, insertRow, updateRow, deleteRow } from "@/lib/supabase/db";

// ═══════════════════════════════════════════════════════════════════
// Servicio para Workflow de Siniestros
// ═══════════════════════════════════════════════════════════════════

const WORKFLOW_CONFIG_SELECT =
  "id, name, description, country_id, business_line_id, event_id, claim_status_id, is_active, sort_order, created_at, updated_at, country:countries(id, name), business_line:business_lines(id, name, code_letter), event:events(id, name), claim_status:lookup_catalog(id, code, name)";

const WORKFLOW_STEP_SELECT =
  "id, workflow_config_id, action_template_id, depends_on_template_id, level, sort_order, is_automatic, is_required, created_at, updated_at, action_template:action_template!workflow_steps_action_template_id_fkey(id, name, code, action_features_id, line_business_id, action_feature:action_features!action_template_action_features_id_fkey(id, name, code)), depends_on_template:action_template!workflow_steps_depends_on_template_id_fkey(id, name, code)";

export interface WorkflowConfig {
  id: string;
  name: string;
  description: string | null;
  country_id: string | null;
  business_line_id: string | null;
  event_id: string | null;
  claim_status_id: string;
  is_active: boolean;
  sort_order: number;
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
    order: { column: "sort_order", ascending: true },
  });
}

export async function getWorkflowConfigById(id: string): Promise<WorkflowConfig | null> {
  return fetchById<WorkflowConfig>("workflow_configs", id, WORKFLOW_CONFIG_SELECT);
}

export async function createWorkflowConfig(input: {
  name: string;
  description?: string;
  country_id?: string | null;
  business_line_id?: string | null;
  event_id?: string | null;
  claim_status_id: string;
  sort_order?: number;
}): Promise<WorkflowConfig> {
  return insertRow<WorkflowConfig>("workflow_configs", {
    name: input.name,
    description: input.description || null,
    country_id: input.country_id || null,
    business_line_id: input.business_line_id || null,
    event_id: input.event_id || null,
    claim_status_id: input.claim_status_id,
    sort_order: input.sort_order || 0,
  }, WORKFLOW_CONFIG_SELECT);
}

export async function updateWorkflowConfig(id: string, input: Partial<{
  name: string;
  description: string | null;
  country_id: string | null;
  business_line_id: string | null;
  event_id: string | null;
  claim_status_id: string;
  is_active: boolean;
  sort_order: number;
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

// ═══ Dependencias intrinsecas conocidas ═══
// El sistema sabe que ciertas gestiones dependen de otras por defecto

export const INTRINSIC_DEPENDENCIES: Record<string, string> = {
  RES: "COB",  // Reserva depende de Coberturas
  PCA: "RES",  // Cuadro de Ajuste depende de Reserva
  RTA: "NSA",  // Recepción Total depende de Notificación
  INS: "COI",  // Inspección depende de Coordinación
};

export function getIntrinsicDependency(templateCode: string): string | null {
  return INTRINSIC_DEPENDENCIES[templateCode] || null;
}
