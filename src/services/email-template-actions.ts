import { fetchAll, insertRow, deleteRow, getSupabaseClient } from "@/lib/supabase/db";
import type { EmailTemplate } from "./email-templates";

// ──────────────────────────────────────────────────────────────
// Servicios de la junction email_template_actions
//
// Vincula plantillas de e-mail a action_templates (relación N:M).
// Una plantilla se crea sin acción (ver email-templates.ts) y se
// vincula después desde la ficha de la gestión.
//
// is_default: marca la plantilla por defecto por acción+línea.
// Solo una plantilla puede ser default por (action_template_id,
// business_line_id de la plantilla) — garantizado por índice único
// parcial en la migración 234.
// ──────────────────────────────────────────────────────────────

export interface EmailTemplateAction {
  id: string;
  email_template_id: string;
  action_template_id: string;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  // Joins opcionales
  email_template?: Pick<
    EmailTemplate,
    "id" | "name" | "subject" | "body" | "body_format" | "business_line_id" | "is_active"
  > | null;
  action_template?: { id: string; name: string; code: string | null } | null;
}

const JUNCTION_FIELDS =
  "id, email_template_id, action_template_id, is_default, created_by, created_at, " +
  "email_template:email_templates!email_template_actions_email_template_id_fkey(id, name, subject, body, body_format, business_line_id, is_active), " +
  "action_template:action_template!email_template_actions_action_template_id_fkey(id, name, code)";

export interface LinkInput {
  email_template_id: string;
  action_template_id: string;
  is_default?: boolean;
  created_by?: string | null;
}

/**
 * Vincula una plantilla a una acción. Si is_default = true, quita el default
 * anterior de esa acción+línea (vía unique parcial en DB, pero hacemos el
 * cleanup previo para que el error de constraint no llegue al usuario).
 */
export async function linkTemplateToAction(input: LinkInput): Promise<EmailTemplateAction> {
  if (input.is_default) {
    await clearDefaultForAction(input.action_template_id, input.email_template_id);
  }
  return insertRow<EmailTemplateAction>(
    "email_template_actions",
    {
      email_template_id: input.email_template_id,
      action_template_id: input.action_template_id,
      is_default: input.is_default ?? false,
      created_by: input.created_by ?? null,
    },
    JUNCTION_FIELDS
  );
}

/**
 * Vincula varias plantillas a una acción en lote.
 */
export async function linkTemplatesToAction(
  actionTemplateId: string,
  templateIds: string[],
  createdBy?: string | null
): Promise<EmailTemplateAction[]> {
  if (templateIds.length === 0) return [];
  // Filtrar las que ya están vinculadas para no duplicar
  const existing = await getActionsForTemplates(templateIds);
  const alreadyLinked = new Set(
    existing
      .filter((eta) => eta.action_template_id === actionTemplateId)
      .map((eta) => eta.email_template_id)
  );
  const toInsert = templateIds
    .filter((id) => !alreadyLinked.has(id))
    .map((id) => ({
      email_template_id: id,
      action_template_id: actionTemplateId,
      is_default: false,
      created_by: createdBy ?? null,
    }));
  if (toInsert.length === 0) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("email_template_actions")
    .insert(toInsert)
    .select(JUNCTION_FIELDS);
  if (error) throw new Error(error.message);
  return (data as EmailTemplateAction[]) ?? [];
}

/**
 * Desvincula una plantilla de una acción (borra la fila de la junction).
 * NO borra la plantilla.
 */
export async function unlinkTemplateFromAction(
  emailTemplateId: string,
  actionTemplateId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("email_template_actions")
    .delete()
    .eq("email_template_id", emailTemplateId)
    .eq("action_template_id", actionTemplateId);
  if (error) throw new Error(error.message);
}

export async function unlinkById(id: string): Promise<void> {
  await deleteRow("email_template_actions", id);
}

/**
 * Marca una plantilla como default para una acción.
 * Limpia el default anterior de esa acción (para cualquier plantilla de la
 * misma línea de negocio — el unique parcial lo exige).
 */
export async function setDefaultTemplate(
  emailTemplateId: string,
  actionTemplateId: string
): Promise<void> {
  // Quitar default de otras plantillas vinculadas a esta acción
  // (el unique parcial es por action_template_id + email_template_id WHERE is_default,
  //  así que solo puede haber una fila default por acción en la junction).
  const supabase = getSupabaseClient();
  const { error: clearErr } = await supabase
    .from("email_template_actions")
    .update({ is_default: false })
    .eq("action_template_id", actionTemplateId)
    .eq("is_default", true)
    .neq("email_template_id", emailTemplateId);
  if (clearErr) throw new Error(clearErr.message);

  const { error: setErr } = await supabase
    .from("email_template_actions")
    .update({ is_default: true })
    .eq("email_template_id", emailTemplateId)
    .eq("action_template_id", actionTemplateId);
  if (setErr) throw new Error(setErr.message);
}

/**
 * Quita el flag default de todas las filas de una acción (excepto la indicada).
 */
export async function clearDefaultForAction(
  actionTemplateId: string,
  exceptTemplateId?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("email_template_actions")
    .update({ is_default: false })
    .eq("action_template_id", actionTemplateId)
    .eq("is_default", true);
  if (exceptTemplateId) {
    query = query.neq("email_template_id", exceptTemplateId);
  }
  const { error } = await query;
  if (error) throw new Error(error.message);
}

/**
 * Devuelve todas las plantillas vinculadas a una acción (con su info completa).
 * Filtra por línea de negocio de la acción si se pasa businessLineId.
 */
export async function getEmailTemplatesForAction(
  actionTemplateId: string,
  opts?: { companyId?: string; businessLineId?: string; includeInactive?: boolean }
): Promise<EmailTemplate[]> {
  // Traer filas de la junction para esa acción
  const etaRows = await fetchAll<Pick<EmailTemplateAction, "email_template_id">>(
    "email_template_actions",
    {
      select: "email_template_id",
      eq: { action_template_id: actionTemplateId },
    }
  );
  if (etaRows.length === 0) return [];
  const templateIds = etaRows.map((r) => r.email_template_id);

  // Cargar plantillas con sus acciones y línea
  const supabase = getSupabaseClient();
  let q = supabase
    .from("email_templates")
    .select(
      "id, company_id, business_line_id, action_template_id, name, description, body_format, subject, body, logo_url, header_color, logo_position, detected_placeholders, placeholder_mapping, is_active, sort_order, created_by, created_at, updated_at, business_line:business_lines!email_templates_business_line_id_fkey(id, name), actions:email_template_actions(id, action_template_id, is_default, action_template:action_template!email_template_actions_action_template_id_fkey(id, name, code))"
    )
    .in("id", templateIds);
  if (opts?.companyId) q = q.eq("company_id", opts.companyId);
  if (opts?.businessLineId) q = q.eq("business_line_id", opts.businessLineId);
  if (!opts?.includeInactive) q = q.eq("is_active", true);
  q = q.order("sort_order", { ascending: true });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data as EmailTemplate[]) ?? [];
  return rows.sort((a, b) => {
    // Default primero
    const aDefault = a.actions?.some((x) => x.is_default) ? 0 : 1;
    const bDefault = b.actions?.some((x) => x.is_default) ? 0 : 1;
    if (aDefault !== bDefault) return aDefault - bDefault;
    if (a.sort_order === b.sort_order) return a.name.localeCompare(b.name);
    return a.sort_order - b.sort_order;
  });
}

/**
 * Devuelve todas las acciones vinculadas a una plantilla.
 */
export async function getActionsForTemplate(
  emailTemplateId: string
): Promise<EmailTemplateAction[]> {
  return fetchAll<EmailTemplateAction>("email_template_actions", {
    select: JUNCTION_FIELDS,
    eq: { email_template_id: emailTemplateId },
    order: { column: "created_at", ascending: true },
  });
}

/**
 * Devuelve las acciones vinculadas a un conjunto de plantillas (batch).
 */
export async function getActionsForTemplates(
  emailTemplateIds: string[]
): Promise<EmailTemplateAction[]> {
  if (emailTemplateIds.length === 0) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("email_template_actions")
    .select(JUNCTION_FIELDS)
    .in("email_template_id", emailTemplateIds);
  if (error) throw new Error(error.message);
  return (data as EmailTemplateAction[]) ?? [];
}

/**
 * Devuelve la plantilla por defecto de una acción (o null si no hay).
 */
export async function getDefaultTemplateForAction(
  actionTemplateId: string
): Promise<EmailTemplate | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("email_template_actions")
    .select(
      "email_template:email_templates!email_template_actions_email_template_id_fkey(id, company_id, business_line_id, action_template_id, name, description, body_format, subject, body, logo_url, header_color, detected_placeholders, placeholder_mapping, is_active, sort_order, created_by, created_at, updated_at, business_line:business_lines!email_templates_business_line_id_fkey(id, name))"
    )
    .eq("action_template_id", actionTemplateId)
    .eq("is_default", true)
    .eq("email_template.is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as { email_template: EmailTemplate } | null)?.email_template ?? null;
}
