-- ═══════════════════════════════════════════════════════════════
-- 101: Tabla de valores fijos para importación masiva
--   - import_fixed_values: guarda field_key → valor fijo por empresa
--   - Para campos que no vienen en el Excel pero se cargan con un valor en duro
--   - catalog_uuid: si el campo es de referencia (auditor, liquidador, etc.),
--     este campo guarda el UUID del catálogo (no texto libre)
--   - El sistema carga estos valores automáticamente al iniciar una importación
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS import_fixed_values (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  fixed_value text,
  catalog_uuid uuid,
  times_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_import_fixed_values_company
  ON import_fixed_values(company_id);

-- ── RLS ──
ALTER TABLE import_fixed_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_fixed_values_tenant_select" ON import_fixed_values;
CREATE POLICY "import_fixed_values_tenant_select" ON import_fixed_values
  FOR SELECT USING (is_tenant_allowed(company_id));

DROP POLICY IF EXISTS "import_fixed_values_tenant_insert" ON import_fixed_values;
CREATE POLICY "import_fixed_values_tenant_insert" ON import_fixed_values
  FOR INSERT WITH CHECK (is_tenant_allowed(company_id));

DROP POLICY IF EXISTS "import_fixed_values_tenant_update" ON import_fixed_values;
CREATE POLICY "import_fixed_values_tenant_update" ON import_fixed_values
  FOR UPDATE USING (is_tenant_allowed(company_id));

DROP POLICY IF EXISTS "import_fixed_values_tenant_delete" ON import_fixed_values;
CREATE POLICY "import_fixed_values_tenant_delete" ON import_fixed_values
  FOR DELETE USING (is_tenant_allowed(company_id));

-- ── Trigger updated_at ──
DROP TRIGGER IF EXISTS trg_import_fixed_values_updated_at ON import_fixed_values;
CREATE TRIGGER trg_import_fixed_values_updated_at
  BEFORE UPDATE ON import_fixed_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
