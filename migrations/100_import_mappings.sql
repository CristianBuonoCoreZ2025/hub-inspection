-- ═══════════════════════════════════════════════════════════════
-- 100: Tablas de aprendizaje para importación masiva
--   - import_field_mappings: guarda excel_header → field_key por empresa
--   - import_value_mappings: guarda excel_value → catalog_uuid por empresa
--   - RLS: solo la empresa puede ver/editar sus mappings
--   - El sistema "aprende" cada vez que el usuario mapea campos o valores
--     y los reutiliza en futuras importaciones del mismo Excel
-- ═══════════════════════════════════════════════════════════════

-- ── Tabla 1: Mapeo de campos (columna Excel → campo del sistema) ──
CREATE TABLE IF NOT EXISTS import_field_mappings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  excel_header text NOT NULL,
  field_key text NOT NULL,
  times_used integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, excel_header)
);

CREATE INDEX IF NOT EXISTS idx_import_field_mappings_company
  ON import_field_mappings(company_id);

-- ── Tabla 2: Mapeo de valores (valor Excel → UUID del catálogo) ──
CREATE TABLE IF NOT EXISTS import_value_mappings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  excel_value text NOT NULL,
  catalog_uuid uuid NOT NULL,
  times_used integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, field_key, excel_value)
);

CREATE INDEX IF NOT EXISTS idx_import_value_mappings_company_field
  ON import_value_mappings(company_id, field_key);

-- ── RLS: import_field_mappings ──
ALTER TABLE import_field_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_field_mappings_tenant_select" ON import_field_mappings;
CREATE POLICY "import_field_mappings_tenant_select" ON import_field_mappings
  FOR SELECT USING (is_tenant_allowed(company_id));

DROP POLICY IF EXISTS "import_field_mappings_tenant_insert" ON import_field_mappings;
CREATE POLICY "import_field_mappings_tenant_insert" ON import_field_mappings
  FOR INSERT WITH CHECK (is_tenant_allowed(company_id));

DROP POLICY IF EXISTS "import_field_mappings_tenant_update" ON import_field_mappings;
CREATE POLICY "import_field_mappings_tenant_update" ON import_field_mappings
  FOR UPDATE USING (is_tenant_allowed(company_id));

DROP POLICY IF EXISTS "import_field_mappings_tenant_delete" ON import_field_mappings;
CREATE POLICY "import_field_mappings_tenant_delete" ON import_field_mappings
  FOR DELETE USING (is_tenant_allowed(company_id));

-- ── RLS: import_value_mappings ──
ALTER TABLE import_value_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_value_mappings_tenant_select" ON import_value_mappings;
CREATE POLICY "import_value_mappings_tenant_select" ON import_value_mappings
  FOR SELECT USING (is_tenant_allowed(company_id));

DROP POLICY IF EXISTS "import_value_mappings_tenant_insert" ON import_value_mappings;
CREATE POLICY "import_value_mappings_tenant_insert" ON import_value_mappings
  FOR INSERT WITH CHECK (is_tenant_allowed(company_id));

DROP POLICY IF EXISTS "import_value_mappings_tenant_update" ON import_value_mappings;
CREATE POLICY "import_value_mappings_tenant_update" ON import_value_mappings
  FOR UPDATE USING (is_tenant_allowed(company_id));

DROP POLICY IF EXISTS "import_value_mappings_tenant_delete" ON import_value_mappings;
CREATE POLICY "import_value_mappings_tenant_delete" ON import_value_mappings
  FOR DELETE USING (is_tenant_allowed(company_id));

-- ── Trigger updated_at ──
DROP TRIGGER IF EXISTS trg_import_field_mappings_updated_at ON import_field_mappings;
CREATE TRIGGER trg_import_field_mappings_updated_at
  BEFORE UPDATE ON import_field_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_import_value_mappings_updated_at ON import_value_mappings;
CREATE TRIGGER trg_import_value_mappings_updated_at
  BEFORE UPDATE ON import_value_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
