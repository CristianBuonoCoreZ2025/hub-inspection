"use server";

import { createServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { requirePermission, getServerUser } from "@/server/lib/session";
import {
  validateImmutableFields,
  filterAllowedFields,
} from "@/server/lib/immutable-fields";
import { filterFieldsByPermission } from "@/server/lib/field-permissions";

// Tipo mínimo del retorno
interface GestionResult {
  id: string;
  name: string;
  is_active: boolean;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────────
// Configuración de campos por operación
// ──────────────────────────────────────────────────────────────

const IMMUTABLE_ON_UPDATE = [
  "action_features_id",
  "line_business_id",
] as const;

const ALLOWED_ON_UPDATE = [
  "name",
  "description",
  "code",
  "is_blocker",
  "is_review_applicable",
  "is_approval_applicable",
  "review_levels",
  "is_dispatch_applicable",
  "days_to_issue",
  "days_to_review",
  "days_to_approve",
  "days_to_alert_to_issue",
  "days_to_alert_to_review",
  "days_to_alert_to_approve",
  "issuer_roles",
  "reviewer_roles",
  "approver_roles",
  "default_issuer_role",
  "default_reviewer_role",
  "default_approver_role",
  "is_active",
] as const;

const ALLOWED_ON_CREATE = [
  "action_type_id",
  "action_features_id",
  "line_business_id",
  "name",
  "description",
  "code",
  "is_blocker",
  "is_review_applicable",
  "is_approval_applicable",
  "review_levels",
  "is_dispatch_applicable",
  "days_to_issue",
  "days_to_review",
  "days_to_approve",
  "days_to_alert_to_issue",
  "days_to_alert_to_review",
  "days_to_alert_to_approve",
  "issuer_roles",
  "reviewer_roles",
  "approver_roles",
  "default_issuer_role",
  "default_reviewer_role",
  "default_approver_role",
  "company_id",
  "insurance_company_id",
  "event_id",
  "country_id",
] as const;

// ──────────────────────────────────────────────────────────────
// Validaciones de reglas de negocio
// ──────────────────────────────────────────────────────────────

function validateBusinessRules(data: {
  days_to_issue: number;
  days_to_review: number;
  days_to_approve: number;
  days_to_alert_to_issue: number;
  days_to_alert_to_review: number;
  days_to_alert_to_approve: number;
  review_levels: number;
  name: string;
  action_type_id: string;
  action_features_id: string;
  issuer_roles?: string[];
  reviewer_roles?: string[];
  approver_roles?: string[];
  default_issuer_role?: string | null;
  default_reviewer_role?: string | null;
  default_approver_role?: string | null;
}): string[] {
  const errors: string[] = [];

  if (!data.name?.trim()) errors.push("El nombre es requerido");
  if (!data.action_type_id) errors.push("El tipo es requerido");
  if (!data.action_features_id) errors.push("La característica es requerida");

  if (data.issuer_roles && data.issuer_roles.length > 0 && !data.default_issuer_role) {
    errors.push("Debe marcar un rol por defecto para emisión");
  }
  if (data.reviewer_roles && data.reviewer_roles.length > 0 && !data.default_reviewer_role) {
    errors.push("Debe marcar un rol por defecto para revisión");
  }
  if (data.approver_roles && data.approver_roles.length > 0 && !data.default_approver_role) {
    errors.push("Debe marcar un rol por defecto para aprobación");
  }

  const dayFields: Array<[string, number, number]> = [
    ["days_to_issue", data.days_to_issue, 0],
    ["days_to_review", data.days_to_review, 0],
    ["days_to_approve", data.days_to_approve, 0],
  ];
  for (const [field, value, min] of dayFields) {
    if (value < min || value > 999) {
      errors.push(`${field} debe estar entre ${min} y 999`);
    }
  }

  if (data.days_to_alert_to_issue > data.days_to_issue) {
    errors.push("La alerta de emisor no puede exceder los días de vencimiento");
  }
  if (data.review_levels >= 2 && data.days_to_alert_to_review > data.days_to_review) {
    errors.push("La alerta de revisor no puede exceder los días de vencimiento");
  }
  if (data.review_levels >= 3 && data.days_to_alert_to_approve > data.days_to_approve) {
    errors.push("La alerta de aprobador no puede exceder los días de vencimiento");
  }

  if (data.review_levels < 0 || data.review_levels > 3) {
    errors.push("Los niveles de revisión deben estar entre 0 y 3");
  }

  return errors;
}

// ──────────────────────────────────────────────────────────────
// Query para obtener registro actual
// ──────────────────────────────────────────────────────────────

async function getCurrentTemplate(id: string): Promise<Record<string, unknown>> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("action_template")
    .select(`
      id, action_type_id, action_features_id, line_business_id, name, description,
      is_blocker, is_review_applicable, is_approval_applicable, review_levels,
      is_dispatch_applicable, days_to_issue, days_to_review, days_to_approve,
      days_to_alert_to_issue, days_to_alert_to_review, days_to_alert_to_approve,
      issuer_roles, reviewer_roles, approver_roles,
      default_issuer_role, default_reviewer_role, default_approver_role,
      is_active, code, company_id, insurance_company_id, event_id, country_id
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("La gestión no existe o fue eliminada");
  return data as Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────────
// Server Actions
// ──────────────────────────────────────────────────────────────

export async function createGestion(
  input: Record<string, unknown>
): Promise<GestionResult> {
  try {
    await requirePermission("catalogos", "create");

    const filtered = filterAllowedFields(
      input,
      ALLOWED_ON_CREATE as unknown as string[]
    ) as Record<string, unknown>;

    const errors = validateBusinessRules({
      days_to_issue: Number(filtered.days_to_issue ?? 1),
      days_to_review: Number(filtered.days_to_review ?? 0),
      days_to_approve: Number(filtered.days_to_approve ?? 0),
      days_to_alert_to_issue: Number(filtered.days_to_alert_to_issue ?? 0),
      days_to_alert_to_review: Number(filtered.days_to_alert_to_review ?? 0),
      days_to_alert_to_approve: Number(filtered.days_to_alert_to_approve ?? 0),
      review_levels: Number(filtered.review_levels ?? 1),
      name: String(filtered.name ?? ""),
      action_type_id: String(filtered.action_type_id ?? ""),
      action_features_id: String(filtered.action_features_id ?? ""),
      issuer_roles: Array.isArray(filtered.issuer_roles) ? filtered.issuer_roles as string[] : [],
      reviewer_roles: Array.isArray(filtered.reviewer_roles) ? filtered.reviewer_roles as string[] : [],
      approver_roles: Array.isArray(filtered.approver_roles) ? filtered.approver_roles as string[] : [],
      default_issuer_role: (filtered.default_issuer_role as string | null) ?? null,
      default_reviewer_role: (filtered.default_reviewer_role as string | null) ?? null,
      default_approver_role: (filtered.default_approver_role as string | null) ?? null,
    });
    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }

    const reviewLevels = Number(filtered.review_levels ?? 1);
    filtered.is_review_applicable = reviewLevels >= 2;
    filtered.is_approval_applicable = reviewLevels >= 3;

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("action_template")
      .insert(filtered)
      .select(`
        id, action_type_id, action_features_id, line_business_id, name, description,
        is_blocker, is_review_applicable, is_approval_applicable, review_levels,
        is_dispatch_applicable, days_to_issue, days_to_review, days_to_approve,
        days_to_alert_to_issue, days_to_alert_to_review, days_to_alert_to_approve,
        issuer_roles, reviewer_roles, approver_roles,
        default_issuer_role, default_reviewer_role, default_approver_role,
        is_active, code, company_id, sort_order
      `)
      .single();

    if (error) throw new Error(error.message);
    return data as GestionResult;
  } catch (err) {
    logger.error("createGestion falló", err as Error, {
      component: "server-action",
      action: "createGestion",
    });
    throw err;
  }
}

export async function updateGestion(
  id: string,
  input: Record<string, unknown>
): Promise<{ id: string; name: string; is_active: boolean }> {
  try {
    await requirePermission("catalogos", "edit");

    const current = await getCurrentTemplate(id);

    validateImmutableFields(
      current,
      input,
      IMMUTABLE_ON_UPDATE as unknown as string[]
    );

    const staticFiltered = filterAllowedFields(
      input,
      ALLOWED_ON_UPDATE as unknown as string[]
    ) as Record<string, unknown>;

    const user = await getServerUser();
    const filtered = await filterFieldsByPermission(
      staticFiltered,
      ALLOWED_ON_UPDATE as unknown as string[],
      user.role,
      "catalogos_gestiones"
    );

    const errors = validateBusinessRules({
      days_to_issue: Number(filtered.days_to_issue ?? current.days_to_issue ?? 1),
      days_to_review: Number(filtered.days_to_review ?? current.days_to_review ?? 0),
      days_to_approve: Number(filtered.days_to_approve ?? current.days_to_approve ?? 0),
      days_to_alert_to_issue: Number(filtered.days_to_alert_to_issue ?? 0),
      days_to_alert_to_review: Number(filtered.days_to_alert_to_review ?? 0),
      days_to_alert_to_approve: Number(filtered.days_to_alert_to_approve ?? 0),
      review_levels: Number(filtered.review_levels ?? current.review_levels ?? 1),
      name: String(filtered.name ?? current.name ?? ""),
      action_type_id: String(current.action_type_id ?? ""),
      action_features_id: String(current.action_features_id ?? ""),
      issuer_roles: Array.isArray(filtered.issuer_roles) ? filtered.issuer_roles as string[] : (current.issuer_roles as string[] | undefined) ?? [],
      reviewer_roles: Array.isArray(filtered.reviewer_roles) ? filtered.reviewer_roles as string[] : (current.reviewer_roles as string[] | undefined) ?? [],
      approver_roles: Array.isArray(filtered.approver_roles) ? filtered.approver_roles as string[] : (current.approver_roles as string[] | undefined) ?? [],
      default_issuer_role: (filtered.default_issuer_role as string | null | undefined) ?? (current.default_issuer_role as string | null | undefined) ?? null,
      default_reviewer_role: (filtered.default_reviewer_role as string | null | undefined) ?? (current.default_reviewer_role as string | null | undefined) ?? null,
      default_approver_role: (filtered.default_approver_role as string | null | undefined) ?? (current.default_approver_role as string | null | undefined) ?? null,
    });
    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }

    const reviewLevels = Number(filtered.review_levels ?? current.review_levels ?? 1);
    filtered.is_review_applicable = reviewLevels >= 2;
    filtered.is_approval_applicable = reviewLevels >= 3;

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("action_template")
      .update(filtered)
      .eq("id", id)
      .select("id, name, is_active")
      .single();

    if (error) throw new Error(error.message);
    return data as { id: string; name: string; is_active: boolean };
  } catch (err) {
    logger.error("updateGestion falló", err as Error, {
      component: "server-action",
      action: "updateGestion",
      metadata: { id },
    });
    throw err;
  }
}

export async function deleteGestion(id: string): Promise<void> {
  try {
    await requirePermission("catalogos", "delete");
    // Soft delete: marcar is_active = false
    await updateGestion(id, { is_active: false });
  } catch (err) {
    logger.error("deleteGestion falló", err as Error, {
      component: "server-action",
      action: "deleteGestion",
      metadata: { id },
    });
    throw err;
  }
}

export async function setGestionClaimStatuses(
  templateId: string,
  statusIds: string[]
): Promise<void> {
  try {
    await requirePermission("catalogos", "edit");

    const supabase = await createServerClient();

    // Delete all existing
    const { error: delError } = await supabase
      .from("action_template_claim_status")
      .delete()
      .eq("action_template_id", templateId);
    if (delError) throw new Error(delError.message);

    // Insert new ones
    if (statusIds.length === 0) return;

    const objects = statusIds.map((statusId) => ({
      action_template_id: templateId,
      claim_status_id: statusId,
    }));

    const { error: insError } = await supabase
      .from("action_template_claim_status")
      .insert(objects);
    if (insError) throw new Error(insError.message);
  } catch (err) {
    logger.error("setGestionClaimStatuses falló", err as Error, {
      component: "server-action",
      action: "setGestionClaimStatuses",
      metadata: { templateId },
    });
    throw err;
  }
}
