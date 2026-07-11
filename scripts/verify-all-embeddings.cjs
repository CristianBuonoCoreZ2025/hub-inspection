require('dotenv').config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testQuery(table, select, label) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`, {
    headers: { 'apikey': serviceKey, 'Authorization': 'Bearer ' + serviceKey }
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`OK  ${label}`);
    return true;
  } else {
    console.log(`FAIL ${label}: ${data.message?.slice(0, 120)}`);
    return false;
  }
}

(async () => {
  let pass = 0, fail = 0;
  
  // actions.ts - getActionFeatures
  if (await testQuery('action_features', 
    'id, name, code, has_specific_screen, has_template, max_review_levels, has_control, has_issue, has_review, has_approve, is_active, sort_order, screen_id, screen:gestion_screens!action_features_screen_id_fkey(id, code, name), characteristics:characteristic!characteristic_action_feature_id_fkey(id, action_feature_id, name, local_name, screen, control, issue, review, approve, document_template, email_template, document_type, is_active, sort_order)',
    'actions.ts getActionFeatures')) pass++; else fail++;
  
  // actions.ts - ACTION_TEMPLATE_FIELDS
  if (await testQuery('action_template',
    'id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, review_levels, issuer_roles, reviewer_roles, approver_roles, default_issuer_role, default_reviewer_role, default_approver_role, days_to_issue, days_to_review, days_to_approve, days_to_alert_to_issue, days_to_alert_to_review, days_to_alert_to_approve, is_active, code, is_dispatch_applicable, company_id, insurance_company_id, event_id, country_id, sort_order, action_feature:action_features!action_template_action_features_id_fkey(id, name, code), line_business:business_lines!action_template_line_business_id_fkey(id, name, code_prefix), company:companies!action_template_company_id_fkey(id, name), event:events!action_template_event_id_fkey(id, name), claim_statuses:action_template_claim_status!action_template_claim_status_action_template_id_fkey(claim_status_id, is_active)',
    'actions.ts ACTION_TEMPLATE_FIELDS')) pass++; else fail++;
  
  // document-data.ts - CLAIM_SELECT
  if (await testQuery('claims',
    'id, claim_number, company:companies!claims_company_id_fkey(id, name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(id, name), broker:brokers!claims_broker_id_fkey(id, name), advisor:advisors!claims_advisor_id_fkey(id, name), claim_type:claim_types!claims_claim_type_id_fkey(id, name), business_line:business_lines!claims_business_line_id_fkey(id, name), event:events!claims_event_id_fkey(id, name), type:lookup_catalog!claims_type_id_fkey(id, name), status:lookup_catalog!claims_status_id_fkey(id, name, code), currency:lookup_catalog!claims_currency_id_fkey(id, name, code), country:countries!claims_country_id_fkey(id, name), adjuster_user:profiles!claims_adjuster_id_fkey(id, full_name, email), inspector_user:profiles!claims_inspector_id_fkey(id, full_name, email)',
    'document-data.ts CLAIM_SELECT')) pass++; else fail++;
  
  // inspections.ts - getInspectionSessions
  if (await testQuery('inspection_sessions',
    'id, claim_id, status, action_template:action_template!inspection_sessions_action_template_id_fkey(code), claim:claims!inspection_sessions_claim_id_fkey(claim_number, policy_number, claim_date, client_reference, claim_address, liquidation_number, inspector_id, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(name))',
    'inspections.ts getInspectionSessions')) pass++; else fail++;
  
  // inspections.ts - full session with nested
  if (await testQuery('inspection_sessions',
    'id, claim_id, status, action_template:action_template!inspection_sessions_action_template_id_fkey(code), inspection_evidences:inspection_evidences!inspection_evidences_session_id_fkey(id, url, type), inspection_notes:inspection_notes!inspection_notes_session_id_fkey(id, content), claim:claims!inspection_sessions_claim_id_fkey(claim_number, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(name))',
    'inspections.ts full session')) pass++; else fail++;
  
  // gestion-screens.ts
  if (await testQuery('characteristic_screens',
    'id, characteristic_id, screen_id, is_default, screen:gestion_screens!characteristic_screens_screen_id_fkey(id, code, name)',
    'gestion-screens.ts getCharacteristicScreens')) pass++; else fail++;
  
  // users.ts
  if (await testQuery('profiles',
    'id, user_id, company_id, full_name, email, role, is_active, user_clients:user_clients!user_clients_user_id_fkey(id, user_id, company_id, created_at, company:companies!user_clients_company_id_fkey(id, name, slug))',
    'users.ts PROFILE_FIELDS')) pass++; else fail++;
  
  // policies.ts
  if (await testQuery('policy_coverages',
    'id, policy_id, coverage_name, coverage_catalog:coverage_catalog!policy_coverages_coverage_catalog_id_fkey(code, name), subcoverage_catalog:subcoverage_catalog!policy_coverages_subcoverage_catalog_id_fkey(code, name)',
    'policies.ts getPolicyCoveragesByPolicyId')) pass++; else fail++;
  
  console.log(`\n${pass} passed, ${fail} failed`);
})();
