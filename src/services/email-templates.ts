import { fetchAll, fetchById, insertRow, updateRow } from "@/lib/supabase/db";

// ──────────────────────────────────────────────────────────────
// Servicios de Plantillas de E-mail
// CRUD cliente-safe (no envía e-mails, solo gestiona plantillas)
// ──────────────────────────────────────────────────────────────

export interface EmailTemplate {
  id: string;
  company_id: string;
  business_line_id: string | null;
  action_template_id: string;
  name: string;
  subject: string;
  body: string;
  detected_placeholders: string[];
  placeholder_mapping: Record<string, string>;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  action_template?: { id: string; name: string; code: string | null } | null;
  business_line?: { id: string; name: string } | null;
}

export interface EmailTemplateInput {
  company_id: string;
  business_line_id?: string | null;
  action_template_id: string;
  name: string;
  subject: string;
  body: string;
  detected_placeholders?: string[];
  placeholder_mapping?: Record<string, string>;
  is_active?: boolean;
  sort_order?: number;
  created_by?: string | null;
}

const TEMPLATE_FIELDS =
  "id, company_id, business_line_id, action_template_id, name, subject, body, detected_placeholders, placeholder_mapping, is_active, sort_order, created_by, created_at, updated_at, action_template:action_template!email_templates_action_template_id_fkey(id, name, code), business_line:business_lines!email_templates_business_line_id_fkey(id, name)";

export async function getEmailTemplates(
  filters?: {
    companyId?: string;
    actionTemplateId?: string;
    businessLineId?: string;
    includeInactive?: boolean;
  }
): Promise<EmailTemplate[]> {
  const eq: Record<string, unknown> = {};
  if (filters?.companyId) eq.company_id = filters.companyId;
  if (filters?.actionTemplateId) eq.action_template_id = filters.actionTemplateId;
  if (filters?.businessLineId) eq.business_line_id = filters.businessLineId;
  if (!filters?.includeInactive) eq.is_active = true;

  const rows = await fetchAll<EmailTemplate>("email_templates", {
    select: TEMPLATE_FIELDS,
    eq,
    order: { column: "sort_order", ascending: true },
  });

  return rows.sort((a, b) => {
    if (a.sort_order === b.sort_order) return a.name.localeCompare(b.name);
    return a.sort_order - b.sort_order;
  });
}

export async function getEmailTemplatesForAction(
  actionTemplateId: string,
  businessLineId: string | null | undefined,
  companyId: string
): Promise<EmailTemplate[]> {
  const eq: Record<string, unknown> = {
    company_id: companyId,
    action_template_id: actionTemplateId,
    is_active: true,
  };
  if (businessLineId) eq.business_line_id = businessLineId;

  const rows = await fetchAll<EmailTemplate>("email_templates", {
    select: TEMPLATE_FIELDS,
    eq,
    order: { column: "sort_order", ascending: true },
  });

  // También incluir plantillas sin línea de negocio específica como fallback
  const fallback = await fetchAll<EmailTemplate>("email_templates", {
    select: TEMPLATE_FIELDS,
    eq: {
      company_id: companyId,
      action_template_id: actionTemplateId,
      is_active: true,
      business_line_id: null,
    },
    order: { column: "sort_order", ascending: true },
  });

  const combined = new Map<string, EmailTemplate>();
  for (const t of rows) combined.set(t.id, t);
  for (const t of fallback) if (!combined.has(t.id)) combined.set(t.id, t);
  return [...combined.values()].sort((a, b) => {
    if (a.sort_order === b.sort_order) return a.name.localeCompare(b.name);
    return a.sort_order - b.sort_order;
  });
}

export async function getEmailTemplateById(id: string): Promise<EmailTemplate | null> {
  return fetchById<EmailTemplate>("email_templates", id, TEMPLATE_FIELDS);
}

export async function createEmailTemplate(input: EmailTemplateInput): Promise<EmailTemplate> {
  return insertRow<EmailTemplate>(
    "email_templates",
    {
      company_id: input.company_id,
      business_line_id: input.business_line_id ?? null,
      action_template_id: input.action_template_id,
      name: input.name,
      subject: input.subject,
      body: input.body,
      detected_placeholders: input.detected_placeholders ?? [],
      placeholder_mapping: input.placeholder_mapping ?? {},
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 0,
      created_by: input.created_by ?? null,
    },
    TEMPLATE_FIELDS
  );
}

export async function updateEmailTemplate(id: string, input: Partial<EmailTemplateInput>): Promise<EmailTemplate> {
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.subject !== undefined) set.subject = input.subject;
  if (input.body !== undefined) set.body = input.body;
  if (input.business_line_id !== undefined) set.business_line_id = input.business_line_id;
  if (input.action_template_id !== undefined) set.action_template_id = input.action_template_id;
  if (input.detected_placeholders !== undefined) set.detected_placeholders = input.detected_placeholders;
  if (input.placeholder_mapping !== undefined) set.placeholder_mapping = input.placeholder_mapping;
  if (input.is_active !== undefined) set.is_active = input.is_active;
  if (input.sort_order !== undefined) set.sort_order = input.sort_order;

  return updateRow<EmailTemplate>("email_templates", id, set, TEMPLATE_FIELDS);
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  await updateEmailTemplate(id, { is_active: false });
}
