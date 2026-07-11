import { fetchAll, fetchById, insertRow, updateRow } from "@/lib/supabase/db";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface DocumentTemplate {
  id: string;
  company_id: string | null;
  insurance_company_id: string | null;
  action_template_id: string | null;
  event_id: string | null;
  country_id: string | null;
  name: string;
  description: string | null;
  file_url: string;
  file_id: string | null;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  detected_placeholders: string[];
  placeholder_mapping: Record<string, string>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joins
  action_template?: { id: string; name: string; code: string | null } | null;
  event?: { id: string; name: string } | null;
  company?: { id: string; name: string } | null;
  insurance_company?: { id: string; name: string } | null;
  country?: { id: string; name: string } | null;
}

export interface DocumentTemplateInput {
  company_id?: string | null;
  insurance_company_id?: string | null;
  action_template_id?: string | null;
  event_id?: string | null;
  country_id?: string | null;
  name: string;
  description?: string | null;
  file_url: string;
  file_id?: string | null;
  file_name: string;
  file_size?: number | null;
  mime_type?: string;
  detected_placeholders?: string[];
  placeholder_mapping?: Record<string, string>;
  is_active?: boolean;
  sort_order?: number;
  created_by?: string | null;
}

const TEMPLATE_FIELDS =
  "id, company_id, insurance_company_id, action_template_id, event_id, country_id, name, description, file_url, file_id, file_name, file_size, mime_type, detected_placeholders, placeholder_mapping, is_active, sort_order, created_at, updated_at";

// ──────────────────────────────────────────────────────────────
// CRUD (cliente-safe — no usa pizzip/docxtemplater)
// ──────────────────────────────────────────────────────────────

export async function getDocumentTemplates(
  filters?: { actionTemplateId?: string; companyId?: string; eventId?: string }
): Promise<DocumentTemplate[]> {
  const options: Parameters<typeof fetchAll>[1] = {
    select: TEMPLATE_FIELDS,
    eq: { is_active: true },
  };
  if (filters?.actionTemplateId) {
    options.eq = { ...options.eq, action_template_id: filters.actionTemplateId };
  }
  if (filters?.companyId) {
    options.eq = { ...options.eq, company_id: filters.companyId };
  }
  if (filters?.eventId) {
    options.eq = { ...options.eq, event_id: filters.eventId };
  }
  // fetchAll supports single order; sort by sort_order then name in JS
  const rows = await fetchAll<DocumentTemplate>("document_templates", {
    ...options,
    order: { column: "sort_order", ascending: true },
  });
  return rows.sort((a, b) => {
    if (a.sort_order === b.sort_order) return a.name.localeCompare(b.name);
    return a.sort_order - b.sort_order;
  });
}

export async function getDocumentTemplateById(id: string): Promise<DocumentTemplate | null> {
  return fetchById<DocumentTemplate>("document_templates", id, TEMPLATE_FIELDS);
}

export async function createDocumentTemplate(input: DocumentTemplateInput): Promise<DocumentTemplate> {
  return insertRow<DocumentTemplate>("document_templates", {
    company_id: input.company_id ?? null,
    insurance_company_id: input.insurance_company_id ?? null,
    action_template_id: input.action_template_id ?? null,
    event_id: input.event_id ?? null,
    country_id: input.country_id ?? null,
    name: input.name,
    description: input.description ?? null,
    file_url: input.file_url,
    file_id: input.file_id ?? null,
    file_name: input.file_name,
    file_size: input.file_size ?? null,
    mime_type: input.mime_type ?? "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    detected_placeholders: input.detected_placeholders ?? [],
    placeholder_mapping: input.placeholder_mapping ?? {},
    is_active: input.is_active ?? true,
    sort_order: input.sort_order ?? 0,
    created_by: input.created_by ?? null,
  }, TEMPLATE_FIELDS);
}

export async function updateDocumentTemplate(
  id: string,
  input: Partial<DocumentTemplateInput>
): Promise<DocumentTemplate> {
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description;
  if (input.company_id !== undefined) set.company_id = input.company_id;
  if (input.insurance_company_id !== undefined) set.insurance_company_id = input.insurance_company_id;
  if (input.action_template_id !== undefined) set.action_template_id = input.action_template_id;
  if (input.event_id !== undefined) set.event_id = input.event_id;
  if (input.country_id !== undefined) set.country_id = input.country_id;
  if (input.detected_placeholders !== undefined) set.detected_placeholders = input.detected_placeholders;
  if (input.placeholder_mapping !== undefined) set.placeholder_mapping = input.placeholder_mapping;
  if (input.is_active !== undefined) set.is_active = input.is_active;
  if (input.sort_order !== undefined) set.sort_order = input.sort_order;
  if (input.file_url !== undefined) set.file_url = input.file_url;
  if (input.file_id !== undefined) set.file_id = input.file_id;
  if (input.file_name !== undefined) set.file_name = input.file_name;
  if (input.file_size !== undefined) set.file_size = input.file_size;

  return updateRow<DocumentTemplate>("document_templates", id, set, TEMPLATE_FIELDS);
}

export async function deleteDocumentTemplate(id: string): Promise<void> {
  // Soft delete: marcar inactivo
  await updateDocumentTemplate(id, { is_active: false });
}
