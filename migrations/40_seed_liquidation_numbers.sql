-- ============================================================
-- Hub Inspections -- Migracion 40: Generar numeros de liquidacion
-- Nuestro correlativo McLarens: L-0000001, L-0000002, etc.
-- ============================================================

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY claim_date, claim_number) AS rn
  FROM claims
)
UPDATE claims
SET liquidation_number = 'L-' || LPAD(n.rn::TEXT, 7, '0')
FROM numbered n
WHERE claims.id = n.id;
