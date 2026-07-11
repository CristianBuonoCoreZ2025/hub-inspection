-- ═══════════════════════════════════════════════════════════════
-- 101: Coberturas del siniestro y reservas
-- Flujo: coberturas del siniestro → reservas → ajustes
-- Las coberturas son acumulativas por claim.
-- Las reservas pueden usar coberturas de cualquier gestión anterior.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. Coberturas del siniestro (claim_coverages)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS claim_coverages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  claim_action_id uuid REFERENCES claim_actions(id) ON DELETE SET NULL,
  policy_coverage_id uuid, -- si viene de una cobertura de póliza
  coverage_id uuid,
  subcoverage_id uuid,
  coverage_name text,
  subcoverage_name text,
  insured_amount numeric(18,2) DEFAULT 0,
  claimed_amount numeric(18,2) DEFAULT 0,
  reserved_amount numeric(18,2) DEFAULT 0,
  recovered_amount numeric(18,2) DEFAULT 0,
  deductible_amount numeric(18,2) DEFAULT 0,
  net_reserve numeric(18,2) DEFAULT 0,
  currency text DEFAULT 'CLP',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_coverages_claim ON claim_coverages(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_coverages_action ON claim_coverages(claim_action_id);
CREATE INDEX IF NOT EXISTS idx_claim_coverages_active ON claim_coverages(claim_id, is_active);

CREATE OR REPLACE FUNCTION trg_claim_coverages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS claim_coverages_updated_at ON claim_coverages;
CREATE TRIGGER claim_coverages_updated_at
  BEFORE UPDATE ON claim_coverages
  FOR EACH ROW EXECUTE FUNCTION trg_claim_coverages_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 2. Reservas del siniestro (claim_reserves)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS claim_reserves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  claim_action_id uuid REFERENCES claim_actions(id) ON DELETE SET NULL,
  reserve_number text,
  currency text DEFAULT 'CLP',
  exchange_rate numeric(18,4) DEFAULT 1,
  capital_amount numeric(18,2) DEFAULT 0,        -- Capital Siniestro
  claimed_amount numeric(18,2) DEFAULT 0,         -- Reclamado Siniestro
  deductible_amount numeric(18,2) DEFAULT 0,      -- Deducible Siniestro
  reserve_amount numeric(18,2) DEFAULT 0,        -- Reserva
  final_amount numeric(18,2) DEFAULT 0,          -- Previsión Final / Monto Final
  status text DEFAULT 'draft',                     -- draft, active, closed, adjusted
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_reserves_claim ON claim_reserves(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_reserves_action ON claim_reserves(claim_action_id);

CREATE OR REPLACE FUNCTION trg_claim_reserves_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS claim_reserves_updated_at ON claim_reserves;
CREATE TRIGGER claim_reserves_updated_at
  BEFORE UPDATE ON claim_reserves
  FOR EACH ROW EXECUTE FUNCTION trg_claim_reserves_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 3. Relación reserva-coberturas (reserve_coverages)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reserve_coverages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_reserve_id uuid NOT NULL REFERENCES claim_reserves(id) ON DELETE CASCADE,
  claim_coverage_id uuid NOT NULL REFERENCES claim_coverages(id) ON DELETE CASCADE,
  insured_amount numeric(18,2) DEFAULT 0,
  claimed_amount numeric(18,2) DEFAULT 0,
  reserved_amount numeric(18,2) DEFAULT 0,
  recovered_amount numeric(18,2) DEFAULT 0,
  deductible_amount numeric(18,2) DEFAULT 0,
  net_reserve numeric(18,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(claim_reserve_id, claim_coverage_id)
);

CREATE INDEX IF NOT EXISTS idx_reserve_coverages_reserve ON reserve_coverages(claim_reserve_id);
CREATE INDEX IF NOT EXISTS idx_reserve_coverages_coverage ON reserve_coverages(claim_coverage_id);

-- ═══════════════════════════════════════════════════════════════
-- RLS (políticas abiertas para Hasura, control de acceso vía Hasura Console)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE claim_coverages ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_reserves ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserve_coverages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claim_coverages_all" ON claim_coverages;
CREATE POLICY "claim_coverages_all" ON claim_coverages
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "claim_reserves_all" ON claim_reserves;
CREATE POLICY "claim_reserves_all" ON claim_reserves
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reserve_coverages_all" ON reserve_coverages;
CREATE POLICY "reserve_coverages_all" ON reserve_coverages
  FOR ALL TO public USING (true) WITH CHECK (true);
