-- ═══════════════════════════════════════════════════════════════
-- Migración 355: Nóminas de facturación de inspecciones
-- ═══════════════════════════════════════════════════════════════
--
-- Crea 2 tablas para gestionar el cobro de inspecciones completadas:
-- 1. billing_batches       — nóminas (cabecera)
-- 2. billing_batch_items   — items de cada nómina (inspecciones)
--
-- Flujo:
--   pendiente_revision → enviada_revision → aprobada
--   Al aprobar, los items con include_for_billing=true se marcan billed=true.
--   Las inspecciones con billed=true no aparecen en futuras nóminas.
--   Las nóminas NO se pueden eliminar una vez generadas.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. billing_batches (Nóminas) ──
CREATE TABLE IF NOT EXISTS billing_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
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

ALTER TABLE billing_batches ENABLE ROW LEVEL SECURITY;
GRANT ALL ON billing_batches TO anon, authenticated, service_role;
CREATE POLICY "billing_batches_select" ON billing_batches FOR SELECT USING (true);
CREATE POLICY "billing_batches_all" ON billing_batches FOR ALL USING (true) WITH CHECK (true);

-- ── 2. billing_batch_items (Items de nómina) ──
CREATE TABLE IF NOT EXISTS billing_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES billing_batches(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  claim_id UUID,
  include_for_billing BOOLEAN DEFAULT true,
  billed BOOLEAN DEFAULT false,
  -- Snapshot de datos para el Excel (no depende de joins futuros)
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

ALTER TABLE billing_batch_items ENABLE ROW LEVEL SECURITY;
GRANT ALL ON billing_batch_items TO anon, authenticated, service_role;
CREATE POLICY "billing_batch_items_select" ON billing_batch_items FOR SELECT USING (true);
CREATE POLICY "billing_batch_items_all" ON billing_batch_items FOR ALL USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_billing_batch_items_batch_id ON billing_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_billing_batch_items_session_id ON billing_batch_items(session_id);
CREATE INDEX IF NOT EXISTS idx_billing_batch_items_billed ON billing_batch_items(billed) WHERE billed = true;

-- Trigger updated_at para billing_batches
CREATE TRIGGER set_updated_at_billing_batches BEFORE UPDATE ON billing_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
