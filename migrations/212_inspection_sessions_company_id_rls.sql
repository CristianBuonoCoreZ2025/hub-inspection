-- ═══════════════════════════════════════════════════════════════
-- Migration 212: inspection_sessions multi-tenant + RLS
--
-- Problema: inspection_sessions es la única tabla principal que no
-- hereda company_id de claims a través de claim_id. Esto rompe
-- el filtrado multi-tenant y dificulta las políticas de RLS.
--
-- Solución:
-- 1. Agregar company_id a inspection_sessions.
-- 2. Backfill desde claims.company_id vía claim_id.
-- 3. Crear FK e índice.
-- 4. Activar RLS con política por company_id.
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columna company_id si no existe
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS company_id uuid;

-- 2. Backfill desde claims (única fuente de verdad del tenant)
UPDATE inspection_sessions
SET company_id = c.company_id
FROM claims c
WHERE inspection_sessions.claim_id = c.id
  AND inspection_sessions.company_id IS NULL;

-- 3. Crear FK a companies (después de asegurar que no haya nulos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'inspection_sessions'
      AND constraint_name = 'inspection_sessions_company_id_fkey'
  ) THEN
    ALTER TABLE inspection_sessions
      ADD CONSTRAINT inspection_sessions_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

-- 4. Hacer NOT NULL solo si toda fila tiene company_id
DO $$
DECLARE
  v_nulls bigint;
BEGIN
  SELECT COUNT(*) INTO v_nulls FROM inspection_sessions WHERE company_id IS NULL;
  IF v_nulls = 0 THEN
    ALTER TABLE inspection_sessions
      ALTER COLUMN company_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'inspection_sessions tiene % filas sin company_id. No se aplica NOT NULL.', v_nulls;
  END IF;
END $$;

-- 5. Índice para el filtro por tenant
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_company_id
  ON inspection_sessions(company_id);

-- 6. RLS
ALTER TABLE inspection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_sessions_select_company" ON inspection_sessions;
DROP POLICY IF EXISTS "inspection_sessions_all_company" ON inspection_sessions;

-- Política SELECT: tenant propio o sesión sin tenant configurado (para migraciones/seed)
CREATE POLICY "inspection_sessions_select_company" ON inspection_sessions
  FOR SELECT
  USING (
    company_id = current_setting('app.current_company_id')::uuid
    OR current_setting('app.current_company_id', true) IS NULL
    OR current_setting('app.current_company_id', true) = ''
  );

-- Política INSERT/UPDATE/DELETE: tenant propio
CREATE POLICY "inspection_sessions_all_company" ON inspection_sessions
  FOR ALL
  USING (company_id = current_setting('app.current_company_id')::uuid);
