export type UserRole =
  | "super_admin"
  | "admin"
  | "supervisor"
  | "adjuster"
  | "inspector"
  | "client";

export type { ClaimInput, CompanyInput, InviteUserInput } from "@/lib/validations";

export interface Country {
  id: string;
  code: string;
  name: string;
  phone_prefix?: string | null;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  rut?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  country_id?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  settings?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  company_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ClaimStatus =
  | "created"
  | "scheduled"
  | "in_progress"
  | "pending_info"
  | "in_review"
  | "signed"
  | "closed";

export interface Claim {
  id: string;
  claim_number: string;
  policy_number: string;
  claim_date: string;
  status: ClaimStatus;
  status_id: string | null;
  report_date: string | null;
  assignment_date: string | null;
  client_reference: string | null;
  company_report_number: string | null;
  liquidation_number: string | null;
  is_special_claim: boolean | null;
  summary: string | null;
  event: string | null;
  internal_number: string | null;
  notes: string | null;
  // Relaciones a empresa y usuarios
  company_id: string;
  assigned_adjuster_id: string | null;
  inspector_id: string | null;
  adjuster_id: string | null;
  auditor_id: string | null;
  dispatcher_id: string | null;
  assistant_id: string | null;
  // FKs a catálogos principales
  insurance_company_id: string | null;
  broker_id: string | null;
  advisor_id: string | null;
  claim_cause_id: string | null;
  claim_type_id: string | null;
  business_line_id: string | null;
  insurance_product_id: string | null;
  // FKs a lookup_catalog
  construction_type_id: string | null;
  destination_housing_id: string | null;
  damage_classification_id: string | null;
  habitability_id: string | null;
  type_id: string | null;
  currency_id: string | null;
  service_type_id: string | null;
  billing_type_id: string | null;
  // FKs geográficas
  country_id: string | null;
  region_id: string | null;
  city_id: string | null;
  commune_id: string | null;
  // Datos del siniestro
  claim_address: string | null;
  claim_country: string | null;
  claim_region: string | null;
  claim_city: string | null;
  claim_commune: string | null;
  owner_same_as_insured: boolean | null;
  // Datos de la póliza
  policy_item: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  policy_currency: string | null;
  policy_amount: number | null;
  policy_premium: number | null;
  // Recovery
  recovery_type_legal: boolean | null;
  recovery_type_material: boolean | null;
  recovery_comments: string | null;
  broker_executive: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimsParticipant {
  id: string;
  claim_id: string;
  type: "insured" | "contractor" | "beneficiary" | "executive" | "contact";
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  rut: string | null;
  email: string | null;
  phone: string | null;
  cell_phone: string | null;
  address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  commune: string | null;
  latitude: string | null;
  longitude: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LookupCatalog {
  id: string;
  country_id: string | null;
  category: string;
  code: string | null;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClaimsStaging {
  id: string;
  company_id: string | null;
  raw_data: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "error";
  error_message: string | null;
  claim_id: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActaPropertyRisk {
  risk_type?: string;
  risk_class?: string;
  property_type?: string;
  apartment_number?: string;
  floor_count?: string;
  age_years?: string;
  built_surface?: string;
  room_count?: string;
  bathroom_count?: string;
  office_count?: string;
  warehouse_count?: string;
  is_habitable?: boolean;
  owner_name?: string;
  branch_count?: string;
  worker_resident_count?: string;
  business_line?: string;
}

export interface ActaPropertyMateriality {
  walls?: string;
  roof?: string;
  interior_flooring?: string;
  interior_ceilings?: string;
  interior_finishes?: string;
  exterior_finishes?: string;
  perimeter_closure?: string;
  others?: string;
}

export interface ActaSecurityMeasureItem {
  has_it?: boolean;
  detail?: string;
}

export interface ActaSecurityMeasures {
  protections?: ActaSecurityMeasureItem;
  security_locks?: ActaSecurityMeasureItem;
  security_guards?: ActaSecurityMeasureItem;
  alarms?: ActaSecurityMeasureItem;
  cameras?: ActaSecurityMeasureItem;
  other_measures?: ActaSecurityMeasureItem;
}

export interface ActaInsuredStatement {
  statement?: string;
  entry_exit_point?: string;
  alarm_activation?: string;
  stolen_items_estimate?: string;
  vehicle_use?: string;
  incident_duration?: string;
}

export interface ActaThirdParty {
  party_type: "afectado" | "responsable";
  full_name?: string;
  rut?: string;
  address?: string;
  commune?: string;
  phone?: string;
  email?: string;
}

export interface InspectionSession {
  id: string;
  claim_id: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  magic_link_token: string | null;
  magic_link_expires_at: string | null;
  status: "pending" | "scheduled" | "active" | "completed" | "cancelled";
  inspection_date: string | null;
  inspection_time: string | null;
  interviewed_name: string | null;
  interviewed_email: string | null;
  interviewed_relationship: string | null;
  police_report_number: string | null;
  police_report_name: string | null;
  police_report_rut: string | null;
  firefighters_company: string | null;
  other_insurances: boolean;
  other_insurance_company: string | null;
  inspector_observations: string | null;
  property_risk?: ActaPropertyRisk | null;
  property_materiality?: ActaPropertyMateriality | null;
  security_measures?: ActaSecurityMeasures | null;
  insured_statement?: ActaInsuredStatement | null;
  third_parties?: ActaThirdParty[] | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  performed_by: string | null;
  company_id: string | null;
  created_at: string;
}

// ── Nuevas tablas de inspección en terreno ──

export interface PropertyRisk {
  id: string;
  session_id: string;
  risk_type: string | null;
  risk_class: string | null;
  property_type: string | null;
  apartment_number: string | null;
  floor_count: number | null;
  age_years: number | null;
  built_surface: number | null;
  room_count: number | null;
  bathroom_count: number | null;
  office_count: number | null;
  warehouse_count: number | null;
  is_habitable: boolean | null;
  owner_name: string | null;
  branch_count: number | null;
  worker_resident_count: number | null;
  business_line: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyMateriality {
  id: string;
  session_id: string;
  walls: string | null;
  roof: string | null;
  interior_flooring: string | null;
  interior_ceilings: string | null;
  interior_finishes: string | null;
  exterior_finishes: string | null;
  perimeter_closure: string | null;
  others: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecurityMeasures {
  id: string;
  session_id: string;
  protections: boolean;
  protections_detail: string | null;
  security_locks: boolean;
  security_locks_detail: string | null;
  security_guards: boolean;
  security_guards_detail: string | null;
  alarms: boolean;
  alarms_detail: string | null;
  cameras: boolean;
  cameras_detail: string | null;
  other_measures: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsuredStatement {
  id: string;
  session_id: string;
  statement: string | null;
  entry_exit_point: string | null;
  alarm_activation: string | null;
  stolen_items_estimate: string | null;
  vehicle_use: string | null;
  incident_duration: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThirdParty {
  id: string;
  session_id: string;
  party_type: "affected" | "responsible";
  full_name: string | null;
  rut: string | null;
  address: string | null;
  commune: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface DamageSketch {
  id: string;
  session_id: string;
  sketch_url: string;
  label: string | null;
  created_at: string;
}

export interface InspectionChecklist {
  id: string;
  session_id: string;
  area: string;
  item: string;
  status: "reviewed" | "pending" | "not_applicable";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionEvidence {
  id: string;
  session_id: string;
  type: "photo" | "video" | "document";
  url: string;
  description: string | null;
  created_at: string;
}

export interface InspectionSignature {
  id: string;
  session_id: string;
  role: "insured" | "adjuster";
  signature_url: string;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface InspectionReport {
  id: string;
  session_id: string;
  report_url: string | null;
  generated_at: string | null;
  status: "draft" | "generated" | "sent";
}

// ── Catalogos Maestros ──

export interface ClaimCause {
  id: string;
  name: string;
  description: string | null;
  country_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InsuranceCompanyCatalog {
  id: string;
  name: string;
  rut: string | null;
  address: string | null;
  line_of_business: string | null;
  code: string | null;
  type: string | null;
  country_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrokerCatalog {
  id: string;
  name: string;
  rut: string | null;
  address: string | null;
  contact: string | null;
  country_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessLine {
  id: string;
  country_id: string;
  name: string;
  claim_type: string | null;
  ramo_fecu: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InsuranceProduct {
  id: string;
  business_line_id: string;
  name: string;
  description: string | null;
  country_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Advisor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  country_id: string | null;
  code: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InspectionDamage {
  id: string;
  session_id: string;
  category: string;
  subcategory: string | null;
  description: string;
  observations: string | null;
  severity: "low" | "medium" | "high" | "total";
  dependency: string | null;
  sector: string | null;
  materiality_type: string | null;
  unit: string | null;
  quantity: number | null;
  damage_type: "building" | "content";
  product: string | null;
  brand_model: string | null;
  purchase_date: string | null;
  estimated_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionChatMessage {
  id: string;
  session_id: string;
  sender_id: string | null;
  sender_name: string | null;
  sender_role: string | null;
  content: string;
  created_at: string;
}

export interface Region {
  id: string;
  country_id: string;
  code: string | null;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface City {
  id: string;
  region_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Commune {
  id: string;
  city_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PropertyClassification {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DamageClassification {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PolicyType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClaimType {
  id: string;
  name: string;
  description: string | null;
  sw_type: number | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HousingDestination {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BuildingAge {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Relationship {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
