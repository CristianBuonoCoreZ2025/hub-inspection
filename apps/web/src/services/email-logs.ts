import { fetchAll, insertRow } from "@/lib/supabase/db";

// ──────────────────────────────────────────────────────────────
// Servicios de Logs de E-mail enviados
// ──────────────────────────────────────────────────────────────

export interface EmailLog {
  id: string;
  company_id: string;
  claim_id: string;
  claim_action_id: string;
  email_template_id: string | null;
  to_address: string[];
  cc_address: string[];
  bcc_address: string[];
  subject: string;
  body: string;
  body_format: "plain" | "html";
  status: string;
  provider_response: Record<string, unknown> | null;
  sent_by: string | null;
  sent_at: string;
  created_at: string;
  correlativo: number;
  parent_action_code: string | null;
  sent_by_user?: { id: string; full_name: string; email: string } | null;
}

export interface EmailLogInput {
  company_id: string;
  claim_id: string;
  claim_action_id: string;
  email_template_id?: string | null;
  to_address: string[];
  cc_address?: string[];
  bcc_address?: string[];
  subject: string;
  body: string;
  body_format?: "plain" | "html";
  status?: string;
  provider_response?: Record<string, unknown>;
  sent_by?: string | null;
  parent_action_code?: string | null;
}

const LOG_FIELDS =
  "id, company_id, claim_id, claim_action_id, email_template_id, to_address, cc_address, bcc_address, subject, body, body_format, status, provider_response, sent_by, sent_at, created_at, correlativo, parent_action_code, sent_by_user:profiles!email_logs_sent_by_fkey(id, full_name, email)";

export async function getEmailLogs(claimActionId: string): Promise<EmailLog[]> {
  return fetchAll<EmailLog>("email_logs", {
    select: LOG_FIELDS,
    eq: { claim_action_id: claimActionId },
    order: { column: "sent_at", ascending: false },
  });
}

export async function getEmailLogsByClaim(claimId: string): Promise<EmailLog[]> {
  return fetchAll<EmailLog>("email_logs", {
    select: LOG_FIELDS,
    eq: { claim_id: claimId },
    order: { column: "sent_at", ascending: false },
  });
}

export async function createEmailLog(input: EmailLogInput): Promise<EmailLog> {
  return insertRow<EmailLog>(
    "email_logs",
    {
      company_id: input.company_id,
      claim_id: input.claim_id,
      claim_action_id: input.claim_action_id,
      email_template_id: input.email_template_id ?? null,
      to_address: input.to_address,
      cc_address: input.cc_address ?? [],
      bcc_address: input.bcc_address ?? [],
      subject: input.subject,
      body: input.body,
      body_format: input.body_format ?? "plain",
      status: input.status ?? "sent",
      provider_response: input.provider_response ?? null,
      sent_by: input.sent_by ?? null,
      parent_action_code: input.parent_action_code ?? null,
    },
    LOG_FIELDS
  );
}
