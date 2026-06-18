-- ============================================================
-- Hub Inspections — Migracion: Eliminar campos exclusivos de McLarens
-- Hace claims 100% generico para cualquier empresa de ajuste
-- ============================================================

-- 1. Eliminar columna exclusiva de McLarens
ALTER TABLE claims
  DROP COLUMN IF EXISTS mclarens_one_number;

-- 2. Renombrar internal_number → client_reference (referencia interna del cliente/empresa)
-- Cualquier empresa de ajuste que use el sistema puede tener su propio numero de referencia interno
ALTER TABLE claims
  RENAME COLUMN internal_number TO client_reference;

-- 3. Actualizar comentario para que sea generico
COMMENT ON COLUMN claims.client_reference IS 'Numero de referencia interno de la empresa de ajuste (cliente del sistema)';
