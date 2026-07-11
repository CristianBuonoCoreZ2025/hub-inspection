require('dotenv').config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testQuery(table, select, label) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`, {
    headers: { 'apikey': serviceKey, 'Authorization': 'Bearer ' + serviceKey }
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`OK   ${label}`);
    return true;
  } else {
    console.log(`FAIL ${label}: ${data.message?.slice(0, 150)}`);
    return false;
  }
}

(async () => {
  let pass = 0, fail = 0;
  
  // ============ claims.ts ============
  const CLAIM_SELECT = "id, claim_number, inspection_sessions:inspection_sessions(id, status, inspection_number, inspection_type, scheduled_at, started_at, ended_at, created_at), status:lookup_catalog!claims_status_id_fkey(id, category, code, name), assigned_adjuster:profiles!claims_assigned_adjuster_id_fkey(id, full_name, email), adjuster:profiles!claims_adjuster_id_fkey(id, full_name, email), inspector:profiles!claims_inspector_id_fkey(id, full_name, email), assistant:profiles!claims_assistant_id_fkey(id, full_name, email), broker:brokers!claims_broker_id_fkey(id, name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(id, name)";
  if (await testQuery('claims', CLAIM_SELECT, 'claims.ts CLAIM_SELECT')) pass++; else fail++;
  
  // ============ claim-actions.ts ============
  const CHARACTERISTIC_SELECT = "id, action_feature_id, name, local_name, screen, control, issue, review, approve, document_template, email_template, document_type, is_active, sort_order, screen_id";
  const ACTION_FEATURE_SELECT = `id, name, has_specific_screen, has_control, has_issue, has_review, has_approve, is_active, sort_order, screen_id, created_at, updated_at, screen:gestion_screens!action_features_screen_id_fkey(id, code, name, description, icon, form_schema), characteristics:characteristic!characteristic_action_feature_id_fkey(${CHARACTERISTIC_SELECT})`;
  const ACTION_TEMPLATE_SELECT = `id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, reviewer_roles, approver_roles, days_to_issue, days_to_review, days_to_approve, days_to_alert_to_issue, days_to_alert_to_review, days_to_alert_to_approve, is_active, issuer_roles, default_issuer_role, default_reviewer_role, default_approver_role, code, is_dispatch_applicable, company_id, event_id, sort_order, created_at, updated_at, action_feature:action_features!action_template_action_features_id_fkey(${ACTION_FEATURE_SELECT}), action_type:lookup_catalog!action_template_action_type_id_fkey(id, category, code, name), claim_statuses:action_template_claim_status!action_template_claim_status_action_template_id_fkey(id, claim_status_id, is_active, claim_status:lookup_catalog!action_template_claim_status_claim_status_id_fkey(id, category, code, name))`;
  const CLAIM_ACTION_SELECT = `id, claim_id, action_type_id, action_features_id, action_template_id, line_business_id, name, description, code, action_data, action_status_id, created_by, created_on, issued_by, issued_on, issuer_id, issue_rejected_by, issue_rejected_on, issuer_rejection_comment, reviewed_by, reviewed_on, reviewer_id, review_rejected_by, review_rejected_on, reviewer_rejection_comment, approved_by, approved_on, approver_id, approve_rejected_by, approve_rejected_on, approver_rejection_comment, dispatched_by, dispatched_on, dispatcher_id, dispatch_rejected_by, dispatch_rejected_on, dispatcher_rejection_comment, expected_date, is_blocker, is_active, is_automatic, updated_on, updated_by, action_feature:action_features!claim_actions_action_features_id_fkey(${ACTION_FEATURE_SELECT}), action_type:lookup_catalog!claim_actions_action_type_id_fkey(id, category, code, name), action_status:lookup_catalog!claim_actions_action_status_id_fkey(id, category, code, name), action_template:action_template(id, name, code, issuer_roles, reviewer_roles, approver_roles, days_to_issue, days_to_review, days_to_approve), issuer:profiles!claim_actions_issuer_id_fkey(id, full_name, email), reviewer:profiles!claim_actions_reviewer_id_fkey(id, full_name, email), approver:profiles!claim_actions_approver_id_fkey(id, full_name, email)`;
  
  if (await testQuery('action_features', ACTION_FEATURE_SELECT, 'claim-actions.ts ACTION_FEATURE_SELECT')) pass++; else fail++;
  if (await testQuery('action_template', ACTION_TEMPLATE_SELECT, 'claim-actions.ts ACTION_TEMPLATE_SELECT')) pass++; else fail++;
  if (await testQuery('claim_actions', CLAIM_ACTION_SELECT, 'claim-actions.ts CLAIM_ACTION_SELECT')) pass++; else fail++;
  if (await testQuery('claim_actions', "id, is_automatic, is_active, action_status:lookup_catalog!claim_actions_action_status_id_fkey(code)", 'claim-actions.ts line 659')) pass++; else fail++;
  if (await testQuery('claim_actions', "id, action_template:action_template!inner(code), action_status:lookup_catalog!claim_actions_action_status_id_fkey!inner(code)", 'claim-actions.ts line 105')) pass++; else fail++;
  if (await testQuery('claim_actions', "id, action_template:action_template!inner(code)", 'claim-actions.ts line 120')) pass++; else fail++;
  if (await testQuery('action_template_claim_status', `action_template:action_template!inner(${ACTION_TEMPLATE_SELECT})`, 'claim-actions.ts line 37')) pass++; else fail++;
  
  // ============ claim-action-history.ts ============
  if (await testQuery('claim_action_history', "id, claim_action_id, event_type, performed_by_profile:profiles!claim_action_history_performed_by_fkey(id, full_name, email)", 'claim-action-history.ts')) pass++; else fail++;
  
  // ============ claim-coverages.ts ============
  if (await testQuery('claim_coverages', "id, claim_id, policy_coverage:policy_coverages!claim_coverages_policy_coverage_id_fkey(id, coverage_catalog:coverage_catalog!policy_coverages_coverage_catalog_id_fkey(code, name), subcoverage_catalog:subcoverage_catalog!policy_coverages_subcoverage_catalog_id_fkey(code, name))", 'claim-coverages.ts')) pass++; else fail++;
  
  // ============ claim-documents.ts ============
  if (await testQuery('claim_document_requests', "id, claim_id, claim_action_id, request_number, status, notes, created_at, updated_at, closed_at, closed_by, claim_document_request_items:claim_document_request_items(id, request_id, document_type_code, document_name, status, received_file_url, received_file_id, received_at, received_by, notes, sort_order)", 'claim-documents.ts')) pass++; else fail++;
  
  // ============ claim-reserves.ts ============
  if (await testQuery('claim_reserves', "id, claim_id, reserve_coverages:reserve_coverages(id, claim_reserve_id, claim_coverage_id, insured_amount, claimed_amount, reserved_amount, recovered_amount, deductible_amount, net_reserve, adjusted_amount, adjusted_deductible, adjusted_net, adjustment_notes, adjusted_at, claim_coverage:claim_coverages!reserve_coverages_claim_coverage_id_fkey(id, coverage_name, subcoverage_name))", 'claim-reserves.ts RESERVE_SELECT')) pass++; else fail++;
  if (await testQuery('reserve_coverages', "id, claim_reserve_id, claim_coverage_id, claim_coverage:claim_coverages!reserve_coverages_claim_coverage_id_fkey(id, coverage_name, subcoverage_name)", 'claim-reserves.ts RESERVE_COVERAGE_SELECT')) pass++; else fail++;
  
  // ============ inspections.ts ============
  const SESSION_SELECT = "id, claim_id, status, inspection_type, scheduled_at, started_at, ended_at, magic_link_token, magic_link_expires_at, inspection_date, inspection_time";
  if (await testQuery('inspection_sessions', `${SESSION_SELECT}, action_template:action_template!inspection_sessions_action_template_id_fkey(code), claim:claims!inspection_sessions_claim_id_fkey(claim_number, policy_number, claim_date, client_reference, claim_address, liquidation_number, inspector_id, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(name))`, 'inspections.ts line 45')) pass++; else fail++;
  if (await testQuery('inspection_sessions', `id, claim_id, status, action_template:action_template!inspection_sessions_action_template_id_fkey(id, name, code, action_features_id), claim:claims!inspection_sessions_claim_id_fkey(claim_number, policy_number, claim_date, client_reference, claim_address, liquidation_number, broker_executive, inspector_id, adjuster_id, auditor_id, dispatcher_id, assistant_id, insurance_company_id, broker_id, advisor_id, insurance_company:insurance_companies!claims_insurance_company_id_fkey(name), broker:brokers!claims_broker_id_fkey(name), advisor:advisors!claims_advisor_id_fkey(name), claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name, first_name, last_name, email, phone, cell_phone)), inspection_evidences:inspection_evidences!inspection_evidences_session_id_fkey(id, url, type, description), inspection_checklists:inspection_checklists!inspection_checklists_session_id_fkey(id, area, item, status), inspection_damages:inspection_damages!inspection_damages_session_id_fkey(id, description, severity), inspection_signatures:inspection_signatures!inspection_signatures_session_id_fkey(id, role), damage_sketches:damage_sketches!damage_sketches_session_id_fkey(id)`, 'inspections.ts line 200')) pass++; else fail++;
  
  // ============ document-data.ts ============
  if (await testQuery('claims', "id, claim_number, company:companies!claims_company_id_fkey(id, name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(id, name), broker:brokers!claims_broker_id_fkey(id, name), advisor:advisors!claims_advisor_id_fkey(id, name), claim_type:claim_types!claims_claim_type_id_fkey(id, name), business_line:business_lines!claims_business_line_id_fkey(id, name), insurance_product:insurance_products!claims_insurance_product_id_fkey(id, name), claim_cause:claim_causes!claims_claim_cause_id_fkey(id, name), event:events!claims_event_id_fkey(id, name), type:lookup_catalog!claims_type_id_fkey(id, name), construction_type:lookup_catalog!claims_construction_type_id_fkey(id, name), destination_housing:housing_destinations!claims_destination_housing_id_fkey(id, name), damage_classification:damage_classifications!claims_damage_classification_id_fkey(id, name), habitability:lookup_catalog!claims_habitability_id_fkey(id, name), service_type:lookup_catalog!claims_service_type_id_fkey(id, name), billing_type:lookup_catalog!claims_billing_type_id_fkey(id, name), country:countries!claims_country_id_fkey(id, name), region:regions!claims_region_id_fkey(id, name), city:cities!claims_city_id_fkey(id, name), commune:communes!claims_commune_id_fkey(id, name), status:lookup_catalog!claims_status_id_fkey(id, name, code), currency:lookup_catalog!claims_currency_id_fkey(id, name, code), adjuster_user:profiles!claims_adjuster_id_fkey(id, full_name, email), inspector_user:profiles!claims_inspector_id_fkey(id, full_name, email), auditor_user:profiles!claims_auditor_id_fkey(id, full_name, email), dispatcher_user:profiles!claims_dispatcher_id_fkey(id, full_name, email), assistant_user:profiles!claims_assistant_id_fkey(id, full_name, email)", 'document-data.ts CLAIM_SELECT')) pass++; else fail++;
  
  // ============ actions.ts ============
  if (await testQuery('action_features', "id, name, code, has_specific_screen, has_template, max_review_levels, has_control, has_issue, has_review, has_approve, is_active, sort_order, screen_id, screen:gestion_screens!action_features_screen_id_fkey(id, code, name), characteristics:characteristic!characteristic_action_feature_id_fkey(id, action_feature_id, name, local_name, screen, control, issue, review, approve, document_template, email_template, document_type, is_active, sort_order)", 'actions.ts getActionFeatures')) pass++; else fail++;
  if (await testQuery('action_template', "id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, review_levels, issuer_roles, reviewer_roles, approver_roles, default_issuer_role, default_reviewer_role, default_approver_role, days_to_issue, days_to_review, days_to_approve, days_to_alert_to_issue, days_to_alert_to_review, days_to_alert_to_approve, is_active, code, is_dispatch_applicable, company_id, insurance_company_id, event_id, country_id, sort_order, action_feature:action_features!action_template_action_features_id_fkey(id, name, code), line_business:business_lines!action_template_line_business_id_fkey(id, name, code_prefix), company:companies!action_template_company_id_fkey(id, name), event:events!action_template_event_id_fkey(id, name), claim_statuses:action_template_claim_status!action_template_claim_status_action_template_id_fkey(claim_status_id, is_active)", 'actions.ts ACTION_TEMPLATE_FIELDS')) pass++; else fail++;
  
  // ============ gestion-screens.ts ============
  if (await testQuery('characteristic_screens', "id, characteristic_id, screen_id, is_default, screen:gestion_screens!characteristic_screens_screen_id_fkey(id, code, name, description, icon, form_schema)", 'gestion-screens.ts getCharacteristicScreens')) pass++; else fail++;
  
  // ============ users.ts ============
  if (await testQuery('profiles', "id, user_id, company_id, full_name, first_name, last_name, email, phone, rut, country_id, avatar_url, role, is_active, created_at, updated_at, user_clients:user_clients!user_clients_user_id_fkey(id, user_id, company_id, created_at, company:companies!user_clients_company_id_fkey(id, name, slug))", 'users.ts PROFILE_FIELDS')) pass++; else fail++;
  
  // ============ user-clients.ts ============
  if (await testQuery('user_clients', "id, user_id, company_id, created_at, company:companies!user_clients_company_id_fkey(id, name, slug)", 'user-clients.ts')) pass++; else fail++;
  
  // ============ policies.ts ============
  if (await testQuery('policy_coverages', "id, policy_id, policy_number, coverage_name, subcoverage_name, insured_amount, deductible_amount, currency, is_active, created_at, updated_at, coverage_catalog_id, subcoverage_catalog_id, coverage_catalog:coverage_catalog!policy_coverages_coverage_catalog_id_fkey(code, name), subcoverage_catalog:subcoverage_catalog!policy_coverages_subcoverage_catalog_id_fkey(code, name)", 'policies.ts getPolicyCoveragesByPolicyId')) pass++; else fail++;
  
  // ============ persons.ts ============
  if (await testQuery('persons', "id, country_id, tax_id, person_type, first_name, last_name, business_name, created_at, person_addresses:person_addresses!person_addresses_person_id_fkey(id, person_id, address, country, region, city, commune, source_claim_id, created_at)", 'persons.ts PERSON_SELECT')) pass++; else fail++;
  
  // ============ inspection/live API route ============
  if (await testQuery('inspection_sessions', `id, claim_id, status, action_template:action_template!inspection_sessions_action_template_id_fkey(code), inspection_evidences:inspection_evidences!inspection_evidences_session_id_fkey(id, url, type, description, category, created_at), inspection_notes:inspection_notes!inspection_notes_session_id_fkey(id, content, created_at), inspection_checklists:inspection_checklists!inspection_checklists_session_id_fkey(id, area, item, status, notes, created_at), inspection_damages:inspection_damages!inspection_damages_session_id_fkey(id, category, subcategory, description, observations, severity, dependency, sector, materiality_type, unit, quantity, damage_type, product, brand_model, purchase_date, estimated_amount, created_at), inspection_chat_messages:inspection_chat_messages!inspection_chat_messages_session_id_fkey(id, content, sender_name, sender_role, created_at), inspection_signatures:inspection_signatures!inspection_signatures_session_id_fkey(id, role, signature_url, signed_at), damage_sketches:damage_sketches!damage_sketches_session_id_fkey(id, sketch_url, label, created_at), claim:claims!inspection_sessions_claim_id_fkey(claim_number, client_reference, claim_address, policy_number, claim_date, liquidation_number, claims_participants:claims_participants!claim_participants_claim_id_fkey!inner(type, full_name, email, phone, cell_phone), insurance_company:insurance_companies!claims_insurance_company_id_fkey(name))`, 'api/inspection/live route')) pass++; else fail++;
  
  console.log(`\n========================================`);
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  console.log(`========================================`);
})();
