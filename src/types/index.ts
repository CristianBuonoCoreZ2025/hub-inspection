export type UserRole =
  | "super_admin"
  | "admin"
  | "supervisor"
  | "adjuster"
  | "inspector"
  | "client";

export type { ClaimInput, CompanyInput, InviteUserInput } from "@/lib/validations";

export interface Company {
  id: string;
  name: string;
  slug: string;
  rut?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
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
  insured_email: string | null;
  insured_phone: string | null;
  address: string;
  city: string;
  claim_date: string;
  claim_type: string;
  status: ClaimStatus;
  assigned_adjuster_id: string | null;
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
