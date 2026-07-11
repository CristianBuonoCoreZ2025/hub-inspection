import { fetchAll, insertRow, insertMany, updateRow, deleteRow, deleteWhere } from "@/lib/supabase/db";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ActionType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface ActionFeature {
  id: string;
  name: string;
  code: string | null;
  has_specific_screen: boolean;
  has_template: boolean;
  max_review_levels: number;
  has_control: boolean;
  has_issue: boolean;
  has_review: boolean;
  has_approve: boolean;
  is_active: boolean;
  sort_order: number;
  screen_id: string | null;
  screen?: { id: string; code: string; name: string; is_dynamic?: boolean } | null;
  characteristics: Characteristic[];
}

export interface Characteristic {
  id: string;
  action_feature_id: string;
  name: string;
  local_name: string | null;
  screen: boolean;
  control: boolean;
  issue: boolean;
  review: boolean;
  approve: boolean;
  document_template: boolean;
  email_template: boolean;
  document_type: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface ActionTemplate {
  id: string;
  action_type_id: string;
  action_features_id: string;
  line_business_id: string | null;
  name: string;
  description: string | null;
  is_blocker: boolean;
  is_review_applicable: boolean;
  is_approval_applicable: boolean;
  review_levels: number;
  reviewer_roles: string[];
  approver_roles: string[];
  days_to_issue: number;
  days_to_review: number;
  days_to_approve: number;
  days_to_alert_to_issue: number;
  days_to_alert_to_review: number;
  days_to_alert_to_approve: number;
  is_active: boolean;
  issuer_roles: string[];
  default_issuer_role: string | null;
  default_reviewer_role: string | null;
  default_approver_role: string | null;
  code: string | null;
  is_dispatch_applicable: boolean | null;
  company_id: string | null;
  insurance_company_id: string | null;
  event_id: string | null;
  country_id: string | null;
  sort_order: number;
  // Joins
  action_type?: ActionType;
  action_feature?: { id: string; name: string; code: string | null };
  line_business?: { id: string; name: string; code_prefix: string | null };
  company?: { id: string; name: string };
  insurance_company?: { id: string; name: string };
  event?: { id: string; name: string };
  country?: { id: string; name: string };
  claim_statuses?: { claim_status_id: string; is_active: boolean }[];
}

export interface ClaimStatus {
  id: string;
  code: string;
  name: string;
  sort_order: number;
}

// ──────────────────────────────────────────────────────────────
// Action Types (lookup_catalog category='action_type')
// ──────────────────────────────────────────────────────────────

export async function getActionTypes(): Promise<ActionType[]> {
  return fetchAll<ActionType>("lookup_catalog", {
    select: "id, code, name, description, is_active, sort_order",
    eq: { category: "action_type" },
    order: { column: "name", ascending: true },
  });
}

export async function createActionType(input: { code: string; name: string; description?: string }) {
  return insertRow<ActionType>("lookup_catalog", {
    category: "action_type",
    code: input.code,
    name: input.name,
    description: input.description || null,
    is_active: true,
  }, "id, code, name, description, is_active, sort_order");
}

export async function updateActionType(id: string, input: { code?: string; name?: string; description?: string; is_active?: boolean }) {
  const set: Record<string, unknown> = {};
  if (input.code !== undefined) set.code = input.code;
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description;
  if (input.is_active !== undefined) set.is_active = input.is_active;

  return updateRow<ActionType>("lookup_catalog", id, set, "id, code, name, description, is_active, sort_order");
}

export async function deleteActionType(id: string) {
  return updateActionType(id, { is_active: false });
}

// ──────────────────────────────────────────────────────────────
// Action Features + Characteristics
// ──────────────────────────────────────────────────────────────

export async function getActionFeatures(): Promise<ActionFeature[]> {
  return fetchAll<ActionFeature>("action_features", {
    select: "id, name, code, has_specific_screen, has_template, max_review_levels, has_control, has_issue, has_review, has_approve, is_active, sort_order, screen_id, screen:gestion_screens!action_features_screen_id_fkey(id, code, name, is_dynamic), characteristics:characteristic!characteristic_action_feature_id_fkey(id, action_feature_id, name, local_name, screen, control, issue, review, approve, document_template, email_template, document_type, is_active, sort_order)",
    order: { column: "name", ascending: true },
  }).then((rows) => {
    // Sort characteristics by sort_order within each feature
    for (const f of rows) {
      if (f.characteristics) {
        f.characteristics.sort((a, b) => a.sort_order - b.sort_order);
      }
    }
    return rows;
  });
}

export async function createActionFeature(input: {
  name: string;
  code?: string;
  has_specific_screen?: boolean;
  has_template?: boolean;
  max_review_levels?: number;
  has_control?: boolean;
  has_issue?: boolean;
  has_review?: boolean;
  has_approve?: boolean;
  screen_id?: string;
}) {
  return insertRow<ActionFeature>("action_features", {
    name: input.name,
    code: input.code || null,
    has_specific_screen: input.has_specific_screen ?? false,
    has_template: input.has_template ?? false,
    max_review_levels: input.max_review_levels ?? 1,
    has_control: input.has_control ?? false,
    has_issue: input.has_issue ?? false,
    has_review: input.has_review ?? false,
    has_approve: input.has_approve ?? false,
    screen_id: input.screen_id || null,
  }, "id, name, code, has_specific_screen, has_template, max_review_levels, has_control, has_issue, has_review, has_approve, is_active, sort_order");
}

export async function updateActionFeature(id: string, input: Partial<{
  name: string;
  has_specific_screen: boolean;
  has_template: boolean;
  max_review_levels: number;
  has_control: boolean;
  has_issue: boolean;
  has_review: boolean;
  has_approve: boolean;
  is_active: boolean;
  screen_id: string;
}>) {
  const set: Record<string, unknown> = {};
  Object.entries(input).forEach(([k, v]) => { if (v !== undefined) set[k] = v; });

  return updateRow<ActionFeature>("action_features", id, set, "id, name, has_specific_screen, has_control, has_issue, has_review, has_approve, is_active, sort_order");
}

export async function deleteActionFeature(id: string) {
  return updateActionFeature(id, { is_active: false });
}

// ──────────────────────────────────────────────────────────────
// Characteristics
// ──────────────────────────────────────────────────────────────

export async function createCharacteristic(input: {
  action_feature_id: string;
  name: string;
  local_name?: string;
  screen?: boolean;
  control?: boolean;
  issue?: boolean;
  review?: boolean;
  approve?: boolean;
  document_template?: boolean;
  email_template?: boolean;
  document_type?: boolean;
}) {
  return insertRow<Characteristic>("characteristic", {
    action_feature_id: input.action_feature_id,
    name: input.name,
    local_name: input.local_name || null,
    screen: input.screen ?? false,
    control: input.control ?? false,
    issue: input.issue ?? false,
    review: input.review ?? false,
    approve: input.approve ?? false,
    document_template: input.document_template ?? false,
    email_template: input.email_template ?? false,
    document_type: input.document_type ?? false,
  }, "id, action_feature_id, name, local_name, screen, control, issue, review, approve, document_template, email_template, document_type, is_active, sort_order");
}

export async function updateCharacteristic(id: string, input: Partial<{
  name: string;
  local_name: string;
  screen: boolean;
  control: boolean;
  issue: boolean;
  review: boolean;
  approve: boolean;
  document_template: boolean;
  email_template: boolean;
  document_type: boolean;
  is_active: boolean;
}>) {
  const set: Record<string, unknown> = {};
  Object.entries(input).forEach(([k, v]) => { if (v !== undefined) set[k] = v; });

  return updateRow<Characteristic>("characteristic", id, set, "id, name, local_name, screen, control, issue, review, approve, document_template, email_template, document_type, is_active, sort_order");
}

export async function deleteCharacteristic(id: string) {
  await deleteRow("characteristic", id);
}

// ──────────────────────────────────────────────────────────────
// Action Templates
// ──────────────────────────────────────────────────────────────

const ACTION_TEMPLATE_FIELDS =
  "id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, review_levels, issuer_roles, reviewer_roles, approver_roles, default_issuer_role, default_reviewer_role, default_approver_role, days_to_issue, days_to_review, days_to_approve, days_to_alert_to_issue, days_to_alert_to_review, days_to_alert_to_approve, is_active, code, is_dispatch_applicable, company_id, insurance_company_id, event_id, country_id, sort_order, action_feature:action_features!action_template_action_features_id_fkey(id, name, code), line_business:business_lines!action_template_line_business_id_fkey(id, name, code_prefix), company:companies!action_template_company_id_fkey(id, name), event:events!action_template_event_id_fkey(id, name), claim_statuses:action_template_claim_status!action_template_claim_status_action_template_id_fkey(claim_status_id, is_active)";

export async function getActionTemplates(): Promise<ActionTemplate[]> {
  const templates = await fetchAll<ActionTemplate>("action_template", {
    select: ACTION_TEMPLATE_FIELDS,
    order: { column: "name", ascending: true },
  });
  // Fetch action_type names separately
  const types = await getActionTypes();
  const typeMap = new Map(types.map(t => [t.id, t]));
  return templates.map(t => ({
    ...t,
    action_type: typeMap.get(t.action_type_id),
  }));
}

// IDs de action_features que son de tipo inspección
const INSPECTION_FEATURE_IDS = [
  "a1000001-0000-0000-0000-000000000001", // Inspección
  "a1000001-0000-0000-0000-000000000005", // Coordinación Inspección
];

export async function getInspectionTemplates(): Promise<ActionTemplate[]> {
  const all = await getActionTemplates();
  return all.filter(t =>
    INSPECTION_FEATURE_IDS.includes(t.action_features_id) && t.is_active
  );
}

export async function createActionTemplate(input: {
  action_type_id: string;
  action_features_id: string;
  line_business_id?: string;
  name: string;
  description?: string;
  code?: string;
  is_blocker?: boolean;
  is_review_applicable?: boolean;
  is_approval_applicable?: boolean;
  review_levels?: number;
  is_dispatch_applicable?: boolean;
  days_to_issue?: number;
  days_to_review?: number;
  days_to_approve?: number;
  days_to_alert_to_issue?: number;
  days_to_alert_to_review?: number;
  days_to_alert_to_approve?: number;
  issuer_roles?: string[];
  reviewer_roles?: string[];
  approver_roles?: string[];
  company_id?: string;
  insurance_company_id?: string;
  event_id?: string;
  country_id?: string;
}) {
  return insertRow<ActionTemplate>("action_template", {
    action_type_id: input.action_type_id,
    action_features_id: input.action_features_id,
    line_business_id: input.line_business_id || null,
    name: input.name,
    description: input.description || null,
    code: input.code || null,
    is_blocker: input.is_blocker ?? false,
    is_review_applicable: input.is_review_applicable ?? false,
    is_approval_applicable: input.is_approval_applicable ?? false,
    review_levels: input.review_levels ?? 1,
    is_dispatch_applicable: input.is_dispatch_applicable ?? false,
    days_to_issue: input.days_to_issue ?? 1,
    days_to_review: input.days_to_review ?? 0,
    days_to_approve: input.days_to_approve ?? 0,
    days_to_alert_to_issue: input.days_to_alert_to_issue ?? 0,
    days_to_alert_to_review: input.days_to_alert_to_review ?? 0,
    days_to_alert_to_approve: input.days_to_alert_to_approve ?? 0,
    issuer_roles: input.issuer_roles || [],
    reviewer_roles: input.reviewer_roles || [],
    approver_roles: input.approver_roles || [],
    company_id: input.company_id || null,
    insurance_company_id: input.insurance_company_id || null,
    event_id: input.event_id || null,
    country_id: input.country_id || null,
  }, "id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, review_levels, days_to_issue, days_to_review, days_to_approve, days_to_alert_to_issue, days_to_alert_to_review, days_to_alert_to_approve, is_active, code, is_dispatch_applicable, company_id, event_id, sort_order");
}

export async function updateActionTemplate(id: string, input: Partial<{
  action_type_id: string;
  action_features_id: string;
  line_business_id: string;
  name: string;
  description: string;
  code: string;
  is_blocker: boolean;
  is_review_applicable: boolean;
  is_approval_applicable: boolean;
  review_levels: number;
  is_dispatch_applicable: boolean;
  days_to_issue: number;
  days_to_review: number;
  days_to_approve: number;
  days_to_alert_to_issue: number;
  days_to_alert_to_review: number;
  days_to_alert_to_approve: number;
  issuer_roles: string[];
  reviewer_roles: string[];
  approver_roles: string[];
  is_active: boolean;
  company_id: string;
  insurance_company_id: string;
  event_id: string;
  country_id: string;
}>) {
  const set: Record<string, unknown> = {};
  Object.entries(input).forEach(([k, v]) => { if (v !== undefined) set[k] = v; });

  return updateRow<ActionTemplate>("action_template", id, set, "id, name, code, is_active");
}

export async function deleteActionTemplate(id: string) {
  return updateActionTemplate(id, { is_active: false });
}

// ──────────────────────────────────────────────────────────────
// Action Template Claim Status (puente)
// ──────────────────────────────────────────────────────────────

export async function setTemplateClaimStatuses(templateId: string, statusIds: string[]) {
  // Delete all existing
  await deleteWhere("action_template_claim_status", { action_template_id: templateId });

  // Insert new ones
  if (statusIds.length === 0) return;
  await insertMany("action_template_claim_status", statusIds.map(sid => ({
    action_template_id: templateId,
    claim_status_id: sid,
    is_active: true,
  })));
}

// ──────────────────────────────────────────────────────────────
// Claim Statuses (for multi-select)
// ──────────────────────────────────────────────────────────────

export async function getClaimStatuses(): Promise<ClaimStatus[]> {
  return fetchAll<ClaimStatus>("lookup_catalog", {
    select: "id, code, name, sort_order",
    eq: { category: "claim_status" },
    order: { column: "sort_order", ascending: true },
  });
}

// ──────────────────────────────────────────────────────────────
// Business Lines (for select)
// ──────────────────────────────────────────────────────────────

export async function getBusinessLinesForActions(): Promise<{ id: string; name: string; code_prefix: string | null }[]> {
  return fetchAll<{ id: string; name: string; code_prefix: string | null }>("business_lines", {
    select: "id, name, code_prefix",
    order: { column: "name", ascending: true },
  });
}
