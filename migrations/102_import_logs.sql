-- ═══════════════════════════════════════════════════════════════
-- 102: Tabla import_logs — log de importaciones masivas
--   - Guarda un registro por cada importacion exitosa
--   - Lista de liquidation_numbers generados para trazabilidad
--   - Snapshot de mapeos usados (field, value, fixed)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS import_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  file_name text,
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  liquidation_numbers text[] NOT NULL DEFAULT '{}',
  field_mappings_used jsonb,
  value_mappings_used jsonb,
  fixed_values_used jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_logs_company
  ON import_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_created_at
  ON import_logs(company_id, created_at DESC);

-- ── RLS ──
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_logs_tenant_select" ON import_logs;
CREATE POLICY "import_logs_tenant_select" ON import_logs
  FOR SELECT USING (is_tenant_allowed(company_id));

DROP POLICY IF EXISTS "import_logs_tenant_insert" ON import_logs;
CREATE POLICY "import_logs_tenant_insert" ON import_logs
  FOR INSERT WITH CHECK (is_tenant_allowed(company_id));

DROP POLICY IF EXISTS "import_logs_tenant_delete" ON import_logs;
CREATE POLICY "import_logs_tenant_delete" ON import_logs
  FOR DELETE USING (is_tenant_allowed(company_id));
