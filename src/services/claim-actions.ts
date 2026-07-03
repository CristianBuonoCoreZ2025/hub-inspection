import { graphqlRequest } from "@/lib/nhost/graphql";
import type { ClaimAction, ActionTemplate, ActionFeature } from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Servicios para el Sistema de Acciones (Claim Actions)
// ═══════════════════════════════════════════════════════════════════

const ACTION_FEATURE_FIELDS = `
  id
  name
  has_specific_screen
  has_control
  has_issue
  has_review
  has_approve
  is_active
  sort_order
  created_at
  updated_at
`;

const ACTION_TEMPLATE_FIELDS = `
  id
  action_type_id
  action_features_id
  line_business_id
  name
  description
  is_blocker
  is_review_applicable
  is_approval_applicable
  reviewer_role
  approver_role
  days_to_issue
  days_to_review
  days_to_approve
  days_to_alert_to_issue
  days_to_alert_to_review
  days_to_alert_to_approve
  is_active
  issuer_role
  code
  is_dispatch_applicable
  company_id
  event_id
  sort_order
  created_at
  updated_at
  action_feature { ${ACTION_FEATURE_FIELDS} }
  action_type { id category code name }
  claim_statuses { id claim_status_id is_active claim_status { id category code name } }
`;

const CLAIM_ACTION_FIELDS = `
  id
  claim_id
  action_type_id
  action_features_id
  action_template_id
  line_business_id
  name
  description
  code
  action_data
  action_status_id
  created_by
  created_on
  issued_by
  issued_on
  issuer_id
  reviewed_by
  reviewed_on
  reviewer_id
  review_rejected_by
  review_rejected_on
  reviewer_rejection_comment
  approved_by
  approved_on
  approver_id
  approve_rejected_by
  approve_rejected_on
  approver_rejection_comment
  dispatched_by
  dispatched_on
  dispatcher_id
  dispatch_rejected_by
  dispatch_rejected_on
  dispatcher_rejection_comment
  expected_date
  is_blocker
  is_active
  updated_on
  updated_by
  action_feature { ${ACTION_FEATURE_FIELDS} }
  action_type { id category code name }
  action_status { id category code name }
  action_template { id name code }
`;

// ═══ Obtener plantillas disponibles según el estado del siniestro ═══

export async function getActionTemplatesByClaimStatus(claimStatusId: string): Promise<ActionTemplate[]> {
  const query = `
    query GetActionTemplatesByStatus($statusId: uuid!) {
      action_template_claim_status(
        where: { claim_status_id: { _eq: $statusId }, is_active: { _eq: true } }
      ) {
        action_template {
          ${ACTION_TEMPLATE_FIELDS}
        }
      }
    }
  `;
  const data = await graphqlRequest<{ action_template_claim_status: { action_template: ActionTemplate }[] }>(query, { statusId: claimStatusId });
  return data.action_template_claim_status.map((r) => r.action_template).filter(Boolean);
}

// ═══ Obtener todas las plantillas activas ═══

export async function getActionTemplates(): Promise<ActionTemplate[]> {
  const query = `
    query GetActionTemplates {
      action_template(where: { is_active: { _eq: true } }, order_by: { sort_order: asc }) {
        ${ACTION_TEMPLATE_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ action_template: ActionTemplate[] }>(query);
  return data.action_template;
}

// ═══ Obtener todas las features activas ═══

export async function getActionFeatures(): Promise<ActionFeature[]> {
  const query = `
    query GetActionFeatures {
      action_features(where: { is_active: { _eq: true } }, order_by: { sort_order: asc }) {
        ${ACTION_FEATURE_FIELDS}
        characteristics(order_by: { sort_order: asc }) {
          id
          action_feature_id
          name
          local_name
          screen
          control
          issue
          review
          approve
          document_template
          email_template
          document_type
          is_active
          sort_order
        }
      }
    }
  `;
  const data = await graphqlRequest<{ action_features: ActionFeature[] }>(query);
  return data.action_features;
}

// ═══ Listar acciones de un siniestro ═══

export async function getClaimActions(claimId: string): Promise<ClaimAction[]> {
  const query = `
    query GetClaimActions($claimId: uuid!) {
      claim_actions(
        where: { claim_id: { _eq: $claimId } }
        order_by: { created_on: desc }
      ) {
        ${CLAIM_ACTION_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ claim_actions: ClaimAction[] }>(query, { claimId });
  return data.claim_actions;
}

// ═══ Crear una acción en un siniestro ═══

export async function createClaimAction(input: {
  claim_id: string;
  action_template_id?: string;
  action_features_id: string;
  action_type_id?: string;
  name: string;
  description?: string;
  code?: string;
  action_data?: Record<string, unknown>;
  created_by?: string;
  is_blocker?: boolean;
  line_business_id?: string;
}): Promise<ClaimAction> {
  // Obtener el status_id de "todo" (pendiente)
  const statusQuery = `
    query GetTodoStatusId {
      lookup_catalog(where: { category: { _eq: "action_status" }, code: { _eq: "todo" } }, limit: 1) { id }
    }
  `;
  const statusData = await graphqlRequest<{ lookup_catalog: { id: string }[] }>(statusQuery);
  const todoStatusId = statusData.lookup_catalog[0]?.id;
  if (!todoStatusId) throw new Error("No se encontró el estado de acción 'todo'");

  // Si se pasó template, copiar datos de la plantilla
  let templateData: Record<string, unknown> = {};
  if (input.action_template_id) {
    const tplQuery = `
      query GetTemplate($id: uuid!) {
        action_template_by_pk(id: $id) {
          ${ACTION_TEMPLATE_FIELDS}
        }
      }
    `;
    const tplData = await graphqlRequest<{ action_template_by_pk: ActionTemplate | null }>(tplQuery, { id: input.action_template_id });
    const tpl = tplData.action_template_by_pk;
    if (tpl) {
      templateData = {
        action_type_id: tpl.action_type_id,
        line_business_id: tpl.line_business_id,
        is_blocker: tpl.is_blocker,
        code: tpl.code,
        description: tpl.description,
      };
    }
  }

  const insertData = {
    claim_id: input.claim_id,
    action_template_id: input.action_template_id || null,
    action_features_id: input.action_features_id,
    action_type_id: input.action_type_id || templateData.action_type_id || null,
    line_business_id: input.line_business_id || templateData.line_business_id || null,
    name: input.name,
    description: input.description || templateData.description || null,
    code: input.code || templateData.code || null,
    action_data: input.action_data || {},
    action_status_id: todoStatusId,
    created_by: input.created_by || null,
    is_blocker: input.is_blocker ?? templateData.is_blocker ?? false,
  };

  const mutation = `
    mutation CreateClaimAction($data: claim_actions_insert_input!) {
      insert_claim_actions_one(object: $data) {
        ${CLAIM_ACTION_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_claim_actions_one: ClaimAction }>(mutation, { data: insertData });
  return data.insert_claim_actions_one;
}

// ═══ Emitir una acción (cambiar estado a "issued") ═══

export async function issueClaimAction(actionId: string, userId?: string, actionData?: Record<string, unknown>): Promise<ClaimAction> {
  const statusQuery = `
    query GetIssuedStatusId {
      lookup_catalog(where: { category: { _eq: "action_status" }, code: { _eq: "issued" } }, limit: 1) { id }
    }
  `;
  const statusData = await graphqlRequest<{ lookup_catalog: { id: string }[] }>(statusQuery);
  const issuedStatusId = statusData.lookup_catalog[0]?.id;
  if (!issuedStatusId) throw new Error("No se encontró el estado de acción 'issued'");

  const setFields: Record<string, unknown> = {
    action_status_id: issuedStatusId,
    issued_on: new Date().toISOString(),
    issued_by: userId || null,
    updated_on: new Date().toISOString(),
    updated_by: userId || null,
  };
  if (actionData) {
    setFields.action_data = actionData;
  }

  const mutation = `
    mutation IssueClaimAction($id: uuid!, $set: claim_actions_set_input!) {
      update_claim_actions_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${CLAIM_ACTION_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ update_claim_actions_by_pk: ClaimAction }>(mutation, { id: actionId, set: setFields });
  return data.update_claim_actions_by_pk;
}

// ═══ Actualizar datos de una acción ═══

export async function updateClaimAction(actionId: string, updates: Record<string, unknown>, userId?: string): Promise<ClaimAction> {
  const setFields = {
    ...updates,
    updated_on: new Date().toISOString(),
    updated_by: userId || null,
  };

  const mutation = `
    mutation UpdateClaimAction($id: uuid!, $set: claim_actions_set_input!) {
      update_claim_actions_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${CLAIM_ACTION_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ update_claim_actions_by_pk: ClaimAction }>(mutation, { id: actionId, set: setFields });
  return data.update_claim_actions_by_pk;
}

// ═══ Hook helper: resolver código de estado de acción desde ID ═══

export async function getActionStatusByCode(code: string): Promise<string | null> {
  const query = `
    query GetActionStatusByCode($code: String!) {
      lookup_catalog(where: { category: { _eq: "action_status" }, code: { _eq: $code } }, limit: 1) { id }
    }
  `;
  const data = await graphqlRequest<{ lookup_catalog: { id: string }[] }>(query, { code });
  return data.lookup_catalog[0]?.id ?? null;
}
