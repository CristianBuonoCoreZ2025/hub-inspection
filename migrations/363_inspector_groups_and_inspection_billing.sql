-- ═══════════════════════════════════════════════════════════════
-- Migración 363: Agrupaciones de inspectores + Facturación de inspecciones
-- ═══════════════════════════════════════════════════════════════
--
-- Crea 4 tablas:
-- 1. inspector_groups            — agrupaciones de inspectores (ej: "Celis")
-- 2. inspector_group_members     — miembros de cada agrupación (1 inspector = 1 grupo)
-- 3. inspection_billing_batches  — nóminas de facturación de inspecciones
-- 4. inspection_billing_batch_items — items de cada nómina
--
-- Diferencia con billing_batches (facturación de accesos):
--   - La facturación de accesos cobra inspecciones completadas (acceso al módulo)
--   - La facturación de inspecciones cobra el servicio de inspección vendido
--   - Son marcas distintas: una inspección puede estar en ambos procesos
--   - La facturación de inspecciones filtra por agrupación de inspectores
--
-- Flujo:
--   pendiente_revision → enviada_revision → aprobada
--   Al aprobar, los items con include_for_billing=true se marcan billed=true.
--   Las inspecciones con billed=true no aparecen en futuras nóminas del mismo tipo.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. inspector_groups (Agrupaciones) ──
CREATE TABLE IF NOT EXISTS inspector_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inspector_groups ENABLE ROW LEVEL SECURITY;
GRANT ALL ON inspector_groups TO anon, authenticated, service_role;
CREATE POLICY "inspector_groups_select" ON inspector_groups FOR SELECT USING (true);
CREATE POLICY "inspector_groups_all" ON inspector_groups FOR ALL USING (true) WITH CHECK (true);

-- ── 2. inspector_group_members (Miembros) ──
-- Un inspector solo puede pertenecer a UNA agrupación (unique en inspector_id)
CREATE TABLE IF NOT EXISTS inspector_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES inspector_groups(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inspector_group_members ENABLE ROW LEVEL SECURITY;
GRANT ALL ON inspector_group_members TO anon, authenticated, service_role;
CREATE POLICY "inspector_group_members_select" ON inspector_group_members FOR SELECT USING (true);
CREATE POLICY "inspector_group_members_all" ON inspector_group_members FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_inspector_group_members_group_id ON inspector_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_inspector_group_members_inspector_id ON inspector_group_members(inspector_id);

-- ── 3. inspection_billing_batches (Nóminas de facturación de inspecciones) ──
CREATE TABLE IF NOT EXISTS inspection_billing_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES inspector_groups(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente_revision',
  generated_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  item_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inspection_billing_batches ENABLE ROW LEVEL SECURITY;
GRANT ALL ON inspection_billing_batches TO anon, authenticated, service_role;
CREATE POLICY "inspection_billing_batches_select" ON inspection_billing_batches FOR SELECT USING (true);
CREATE POLICY "inspection_billing_batches_all" ON inspection_billing_batches FOR ALL USING (true) WITH CHECK (true);

-- ── 4. inspection_billing_batch_items (Items de nómina) ──
CREATE TABLE IF NOT EXISTS inspection_billing_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES inspection_billing_batches(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  claim_id UUID,
  inspector_id UUID,
  include_for_billing BOOLEAN DEFAULT true,
  billed BOOLEAN DEFAULT false,
  -- Snapshot de datos para el Excel
  liquidation_number TEXT,
  case_code TEXT,
  inspection_number TEXT,
  client_reference TEXT,
  inspector_name TEXT,
  insured_name TEXT,
  claim_address TEXT,
  inspection_date TEXT,
  inspection_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inspection_billing_batch_items ENABLE ROW LEVEL SECURITY;
GRANT ALL ON inspection_billing_batch_items TO anon, authenticated, service_role;
CREATE POLICY "inspection_billing_batch_items_select" ON inspection_billing_batch_items FOR SELECT USING (true);
CREATE POLICY "inspection_billing_batch_items_all" ON inspection_billing_batch_items FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_inspection_billing_items_batch_id ON inspection_billing_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_inspection_billing_items_session_id ON inspection_billing_batch_items(session_id);
CREATE INDEX IF NOT EXISTS idx_inspection_billing_items_billed ON inspection_billing_batch_items(billed) WHERE billed = true;

-- Triggers updated_at
CREATE TRIGGER set_updated_at_inspector_groups BEFORE UPDATE ON inspector_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_inspection_billing_batches BEFORE UPDATE ON inspection_billing_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
