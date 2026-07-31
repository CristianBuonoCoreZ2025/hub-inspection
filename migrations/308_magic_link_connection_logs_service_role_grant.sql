-- ═══════════════════════════════════════════════════════════════
-- Migración 308: Grants para service_role en magic_link_connection_logs
-- ═══════════════════════════════════════════════════════════════
-- El API route usa createAdminClient (service role) para leer/escribir logs.
-- Si el rol service_role no tiene grants sobre la tabla, falla con
-- "permission denied for table magic_link_connection_logs".

GRANT ALL ON TABLE magic_link_connection_logs TO service_role;
GRANT EXECUTE ON FUNCTION is_mlcl_tenant_allowed(uuid) TO service_role;
