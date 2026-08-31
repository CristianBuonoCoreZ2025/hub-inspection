import { fetchAll, fetchById, insertRow, updateRow } from "@/lib/supabase/db";

// ──────────────────────────────────────────────────────────────
// Servicios de Plantillas de E-mail
// CRUD cliente-safe (no envía e-mails, solo gestiona plantillas)
//
// Modelo (migración 234):
//   email_templates: una plantilla pertenece a 1 empresa + 1 línea de negocio.
//     No tiene action_template_id obligatorio (la columna vieja quedó nullable
//     y obsoleta; el código nuevo la ignora).
//   email_template_actions: junction N:M. Una plantilla se vincula a N
//     acciones DESPUÉS de creada. Ver email-template-actions.ts.
// ──────────────────────────────────────────────────────────────

export type EmailBodyFormat = "plain" | "html";

export interface EmailTemplate {
  id: string;
  company_id: string;
  business_line_id: string;
  /** @deprecated Obsoleta (migración 234). Usar email_template_actions. */
  action_template_id: string | null;
  name: string;
  description: string | null;
  body_format: EmailBodyFormat;
  subject: string;
  body: string;
  logo_url: string | null;
  header_color: string | null;
  logo_position: "left" | "center" | "right" | null;
  detected_placeholders: string[];
  placeholder_mapping: Record<string, string>;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  business_line?: { id: string; name: string } | null;
  // Acciones vinculadas (vía junction). Solo se popula cuando se pide con actions=true.
  actions?: EmailTemplateActionLink[];
}

export interface EmailTemplateActionLink {
  id: string;
  action_template_id: string;
  is_default: boolean;
  action_template?: { id: string; name: string; code: string | null } | null;
}

export interface EmailTemplateInput {
  company_id: string;
  business_line_id: string;
  name: string;
  description?: string | null;
  body_format?: EmailBodyFormat;
  subject: string;
  body: string;
  logo_url?: string | null;
  header_color?: string | null;
  logo_position?: "left" | "center" | "right";
  detected_placeholders?: string[];
  placeholder_mapping?: Record<string, string>;
  is_active?: boolean;
  sort_order?: number;
  created_by?: string | null;
}

const TEMPLATE_FIELDS =
  "id, company_id, business_line_id, action_template_id, name, description, body_format, subject, body, logo_url, header_color, logo_position, detected_placeholders, placeholder_mapping, is_active, sort_order, created_by, created_at, updated_at, business_line:business_lines!email_templates_business_line_id_fkey(id, name)";

const TEMPLATE_FIELDS_WITH_ACTIONS =
  TEMPLATE_FIELDS +
  ", actions:email_template_actions(id, action_template_id, is_default, action_template:action_template!email_template_actions_action_template_id_fkey(id, name, code))";

export async function getEmailTemplates(
  filters?: {
    companyId?: string;
    businessLineId?: string;
    actionTemplateId?: string;
    includeInactive?: boolean;
    withActions?: boolean;
  }
): Promise<EmailTemplate[]> {
  const eq: Record<string, unknown> = {};
  if (filters?.companyId) eq.company_id = filters.companyId;
  if (filters?.businessLineId) eq.business_line_id = filters.businessLineId;
  if (!filters?.includeInactive) eq.is_active = true;

  // Si se filtra por actionTemplateId, hay que ir por la junction
  if (filters?.actionTemplateId) {
    // Traer ids de plantillas vinculadas a esa acción
    const { getEmailTemplatesForAction } = await import("./email-template-actions");
    return getEmailTemplatesForAction(filters.actionTemplateId, {
      companyId: filters.companyId,
      businessLineId: filters.businessLineId,
      includeInactive: filters.includeInactive,
    });
  }

  const rows = await fetchAll<EmailTemplate>("email_templates", {
    select: filters?.withActions ? TEMPLATE_FIELDS_WITH_ACTIONS : TEMPLATE_FIELDS,
    eq,
    order: { column: "sort_order", ascending: true },
  });

  return rows.sort((a, b) => {
    if (a.sort_order === b.sort_order) return a.name.localeCompare(b.name);
    return a.sort_order - b.sort_order;
  });
}

export async function getEmailTemplateById(
  id: string,
  opts?: { withActions?: boolean }
): Promise<EmailTemplate | null> {
  return fetchById<EmailTemplate>(
    "email_templates",
    id,
    opts?.withActions ? TEMPLATE_FIELDS_WITH_ACTIONS : TEMPLATE_FIELDS
  );
}

export async function createEmailTemplate(input: EmailTemplateInput): Promise<EmailTemplate> {
  const row: Record<string, unknown> = {
    company_id: input.company_id,
    business_line_id: input.business_line_id,
    name: input.name,
    description: input.description ?? null,
    body_format: input.body_format ?? "plain",
    subject: input.subject,
    body: input.body,
    detected_placeholders: input.detected_placeholders ?? [],
    placeholder_mapping: input.placeholder_mapping ?? {},
    is_active: input.is_active ?? true,
    sort_order: input.sort_order ?? 0,
    created_by: input.created_by ?? null,
  };
  // logo_url, header_color y logo_position: se guardan si el caller los pasa.
  if (input.logo_url !== undefined) row.logo_url = input.logo_url;
  if (input.header_color !== undefined) row.header_color = input.header_color;
  if (input.logo_position !== undefined) row.logo_position = input.logo_position;

  return insertRow<EmailTemplate>(
    "email_templates",
    row,
    TEMPLATE_FIELDS_WITH_ACTIONS
  );
}

export async function updateEmailTemplate(
  id: string,
  input: Partial<EmailTemplateInput>
): Promise<EmailTemplate> {
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description;
  if (input.body_format !== undefined) set.body_format = input.body_format;
  if (input.subject !== undefined) set.subject = input.subject;
  if (input.body !== undefined) set.body = input.body;
  if (input.business_line_id !== undefined) set.business_line_id = input.business_line_id;
  if (input.logo_url !== undefined) set.logo_url = input.logo_url;
  if (input.header_color !== undefined) set.header_color = input.header_color;
  if (input.logo_position !== undefined) set.logo_position = input.logo_position;
  if (input.detected_placeholders !== undefined) set.detected_placeholders = input.detected_placeholders;
  if (input.placeholder_mapping !== undefined) set.placeholder_mapping = input.placeholder_mapping;
  if (input.is_active !== undefined) set.is_active = input.is_active;
  if (input.sort_order !== undefined) set.sort_order = input.sort_order;

  return updateRow<EmailTemplate>("email_templates", id, set, TEMPLATE_FIELDS_WITH_ACTIONS);
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  // Soft delete: marcar inactiva. No borrar fila (REGLA #1).
  await updateEmailTemplate(id, { is_active: false });
}
