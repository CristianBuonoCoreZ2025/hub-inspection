-- ═══════════════════════════════════════════════════════════════
-- Migración 160: Extender third_parties para culpable y afectado
-- ═══════════════════════════════════════════════════════════════
--
-- Un tercero puede ser:
-- 1. CULPABLE (responsable) — necesita datos para demanda:
--    - company_name (si es empresa)
--    - has_insurance (tiene seguro?)
--    - insurance_company (su compañía de seguros)
--    - claim_number (número de siniestro en su compañía)
--    - Si no tiene seguro → demanda particular
--
-- 2. AFECTADO — necesita mismo esquema de daños que el asegurado:
--    - Sus daños se registran en inspection_damages con third_party_id
--    - Mismo formulario de daños constructivos + contenido
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Agregar columnas a third_parties ──
ALTER TABLE third_parties
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS has_insurance BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_company TEXT,
  ADD COLUMN IF NOT EXISTS claim_number TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN third_parties.company_name IS 'Nombre de empresa (si el tercero es empresa, no persona natural)';
COMMENT ON COLUMN third_parties.has_insurance IS '¿El tercero culpable tiene seguro? Si false → demanda particular';
COMMENT ON COLUMN third_parties.insurance_company IS 'Compañía de seguros del tercero culpable';
COMMENT ON COLUMN third_parties.claim_number IS 'Número de siniestro en la compañía del tercero';
COMMENT ON COLUMN third_parties.notes IS 'Notas adicionales sobre el tercero';

-- ── 2. Normalizar party_type (ya hecho en 157, pero por si acaso) ──
UPDATE third_parties SET party_type = 'afectado' WHERE party_type = 'affected';
UPDATE third_parties SET party_type = 'responsable' WHERE party_type = 'responsible';

-- ── 3. Actualizar CHECK constraint de party_type ──
ALTER TABLE third_parties DROP CONSTRAINT IF EXISTS third_parties_party_type_check;
ALTER TABLE third_parties ADD CONSTRAINT third_parties_party_type_check
  CHECK (party_type IN ('afectado', 'responsable'));

-- ── 4. RLS en third_parties (si no existe) ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'third_parties' AND policyname = 'third_parties_select') THEN
    ALTER TABLE third_parties ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "third_parties_select" ON third_parties FOR SELECT USING (true);
    CREATE POLICY "third_parties_all" ON third_parties FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
