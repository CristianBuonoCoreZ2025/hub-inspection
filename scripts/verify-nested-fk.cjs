require('dotenv').config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testQuery(table, select) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`, {
    headers: { 'apikey': serviceKey, 'Authorization': 'Bearer ' + serviceKey }
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data };
  return { ok: true, data };
}

(async () => {
  const CHARACTERISTIC_SELECT = "id, action_feature_id, name, local_name, screen, control, issue, review, approve, document_template, email_template, document_type, is_active, sort_order, screen_id";
  const ACTION_FEATURE_SELECT = `id, name, has_specific_screen, has_control, has_issue, has_review, has_approve, is_active, sort_order, screen_id, created_at, updated_at, screen:gestion_screens!action_features_screen_id_fkey(id, code, name, description, icon, form_schema), characteristics:characteristic!characteristic_action_feature_id_fkey(${CHARACTERISTIC_SELECT})`;
  
  // Test 1: ACTION_FEATURE_SELECT on action_features table
  console.log('Test 1: ACTION_FEATURE_SELECT on action_features');
  const r1 = await testQuery('action_features', ACTION_FEATURE_SELECT);
  console.log(r1.ok ? '  OK' : '  FAIL: ' + r1.error.message?.slice(0, 150));
  
  // Test 2: ACTION_TEMPLATE_SELECT on action_template
  const ACTION_TEMPLATE_SELECT = `id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, reviewer_roles, approver_roles, days_to_issue, days_to_review, days_to_approve, days_to_alert_to_issue, days_to_alert_to_review, days_to_alert_to_approve, is_active, issuer_roles, default_issuer_role, default_reviewer_role, default_approver_role, code, is_dispatch_applicable, company_id, event_id, sort_order, created_at, updated_at, action_feature:action_features!action_template_action_features_id_fkey(${ACTION_FEATURE_SELECT}), action_type:lookup_catalog!action_template_action_type_id_fkey(id, category, code, name), claim_statuses:action_template_claim_status!action_template_claim_status_action_template_id_fkey(id, claim_status_id, is_active, claim_status:lookup_catalog!action_template_claim_status_claim_status_id_fkey(id, category, code, name))`;
  
  console.log('\nTest 2: ACTION_TEMPLATE_SELECT on action_template');
  const r2 = await testQuery('action_template', ACTION_TEMPLATE_SELECT);
  console.log(r2.ok ? '  OK' : '  FAIL: ' + r2.error.message?.slice(0, 150));
  
  // Test 3: CLAIM_ACTION_SELECT on claim_actions
  const CLAIM_ACTION_SELECT = `id, claim_id, action_type_id, action_features_id, action_template_id, line_business_id, name, description, code, action_data, action_status_id, created_by, created_on, issued_by, issued_on, issuer_id, issue_rejected_by, issue_rejected_on, issuer_rejection_comment, reviewed_by, reviewed_on, reviewer_id, review_rejected_by, review_rejected_on, reviewer_rejection_comment, approved_by, approved_on, approver_id, approve_rejected_by, approve_rejected_on, approver_rejection_comment, dispatched_by, dispatched_on, dispatcher_id, dispatch_rejected_by, dispatch_rejected_on, dispatcher_rejection_comment, expected_date, is_blocker, is_active, is_automatic, updated_on, updated_by, action_feature:action_features!claim_actions_action_features_id_fkey(${ACTION_FEATURE_SELECT}), action_type:lookup_catalog!claim_actions_action_type_id_fkey(id, category, code, name), action_status:lookup_catalog!claim_actions_action_status_id_fkey(id, category, code, name), action_template:action_template(id, name, code, issuer_roles, reviewer_roles, approver_roles, days_to_issue, days_to_review, days_to_approve), issuer:profiles!claim_actions_issuer_id_fkey(id, full_name, email), reviewer:profiles!claim_actions_reviewer_id_fkey(id, full_name, email), approver:profiles!claim_actions_approver_id_fkey(id, full_name, email)`;
  
  console.log('\nTest 3: CLAIM_ACTION_SELECT on claim_actions');
  const r3 = await testQuery('claim_actions', CLAIM_ACTION_SELECT);
  console.log(r3.ok ? '  OK' : '  FAIL: ' + r3.error.message?.slice(0, 150));
  
  // Test 4: the inner join query from line 37
  console.log('\nTest 4: action_template!inner with ACTION_TEMPLATE_SELECT');
  const r4 = await testQuery('claim_actions', `id, action_template:action_template!inner(${ACTION_TEMPLATE_SELECT})`);
  console.log(r4.ok ? '  OK' : '  FAIL: ' + r4.error.message?.slice(0, 150));
  
  // Test 5: simple nested action_feature on action_features table
  console.log('\nTest 5: nested screen on action_features');
  const r5 = await testQuery('action_features', 'id, screen:gestion_screens!action_features_screen_id_fkey(id, code, name)');
  console.log(r5.ok ? '  OK' : '  FAIL: ' + r5.error.message?.slice(0, 150));
  
  // Test 6: nested characteristics on action_features
  console.log('\nTest 6: nested characteristics on action_features');
  const r6 = await testQuery('action_features', `id, characteristics:characteristic!characteristic_action_feature_id_fkey(${CHARACTERISTIC_SELECT})`);
  console.log(r6.ok ? '  OK' : '  FAIL: ' + r6.error.message?.slice(0, 150));
})();
