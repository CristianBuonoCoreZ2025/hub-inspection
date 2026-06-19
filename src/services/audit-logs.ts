import { graphqlRequest } from "@/lib/nhost/graphql";
import type { AuditLog } from "@/types";

const AUDIT_LOG_FIELDS = `
  id
  table_name
  record_id
  action
  old_data
  new_data
  performed_by
  company_id
  created_at
`;

export async function getAuditLogs(
  tableName: string,
  recordId: string,
  companyId?: string
) {
  const companyFilter = companyId
    ? `, company_id: { _eq: "${companyId}" }`
    : "";

  const query = `
    query GetAuditLogs {
      audit_logs(
        where: {
          table_name: { _eq: "${tableName}" }
          record_id: { _eq: "${recordId}" }
          ${companyFilter}
        }
        order_by: { created_at: desc }
      ) {
        ${AUDIT_LOG_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest<{ audit_logs: AuditLog[] }>(query);
  return data.audit_logs;
}

export async function getRecentAuditLogs(companyId?: string, limit = 10) {
  const companyFilter = companyId
    ? `company_id: { _eq: "${companyId}" }`
    : "";

  const query = `
    query GetRecentAuditLogs {
      audit_logs(
        where: { ${companyFilter} }
        order_by: { created_at: desc }
        limit: ${limit}
      ) {
        ${AUDIT_LOG_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest<{ audit_logs: AuditLog[] }>(query);
  return data.audit_logs;
}
