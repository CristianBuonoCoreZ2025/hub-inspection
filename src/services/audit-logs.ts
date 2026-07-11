import { fetchAll } from "@/lib/supabase/db";
import type { AuditLog } from "@/types";

const AUDIT_LOG_FIELDS =
  "id, table_name, record_id, action, old_data, new_data, performed_by, company_id, created_at";

export async function getAuditLogs(
  tableName: string,
  recordId: string,
  companyId?: string
) {
  const eq: Record<string, string> = {
    table_name: tableName,
    record_id: recordId,
  };
  if (companyId) {
    eq.company_id = companyId;
  }

  return fetchAll<AuditLog>("audit_logs", {
    select: AUDIT_LOG_FIELDS,
    eq,
    order: { column: "created_at", ascending: false },
  });
}

export async function getRecentAuditLogs(companyId?: string, limit = 10) {
  const eq: Record<string, string> = {};
  if (companyId) {
    eq.company_id = companyId;
  }

  return fetchAll<AuditLog>("audit_logs", {
    select: AUDIT_LOG_FIELDS,
    eq,
    order: { column: "created_at", ascending: false },
    limit,
  });
}
