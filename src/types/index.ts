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
  insurance_company: string | null;
  insured_name: string;
  last_name: string | null;
  rut: string | null;
  insured_email: string | null;
  insured_phone: string | null;
  cell_phone: string | null;
  address: string;
  city: string;
  commune: string | null;
  region: string | null;
  country: string | null;
  claim_date: string;
  report_date: string | null;
  assignment_date: string | null;
  claim_type: string;
  claim_cause: string | null;
  summary: string | null;
  status: ClaimStatus;
  assigned_adjuster_id: string | null;
  inspector_id: string | null;
  adjuster_id: string | null;
  auditor_id: string | null;
  dispatcher_id: string | null;
  assistant_id: string | null;
  broker_name: string | null;
  broker_executive: string | null;
  broker_number: string | null;
  builder_name: string | null;
  advisor: string | null;
  internal_number: string | null;
  company_report_number: string | null;
  mclarens_one_number: string | null;
  liquidation_number: string | null;
  is_special_claim: boolean;
  recovery_type_legal: string | null;
  recovery_type_material: string | null;
  recovery_comments: string | null;
  company_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionSession {
  id: string;
  claim_id: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  magic_link_token: string | null;
  magic_link_expires_at: string | null;
  status: "pending" | "active" | "completed" | "cancelled";
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
