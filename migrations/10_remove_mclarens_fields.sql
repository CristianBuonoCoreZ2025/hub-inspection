-- ============================================================
-- Hub Inspections — Migracion: Eliminar campos exclusivos de McLarens
-- Hace claims 100% generico para cualquier empresa de ajuste
-- ============================================================

-- 1. Eliminar columna exclusiva de McLarens
ALTER TABLE claims
  DROP COLUMN IF EXISTS mclarens_one_number;

-- 2. Renombrar internal_number → client_reference (referencia interna del cliente/empresa)
-- Solo si internal_number existe y client_reference NO existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'internal_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'client_reference'
  ) THEN
    ALTER TABLE claims RENAME COLUMN internal_number TO client_reference;
  END IF;
END $$;

-- 3. Actualizar comentario para que sea generico
COMMENT ON COLUMN claims.client_reference IS 'Numero de referencia interno de la empresa de ajuste (cliente del sistema)';
