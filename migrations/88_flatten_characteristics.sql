-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 88: Flatten characteristics — add max_review_levels
-- and has_template to action_features
--
-- La característica (action_features) define:
--   - code: 3 letras único (ya agregado en migración 85)
--   - has_specific_screen: si tiene pantalla propia (inspección, coordinación)
--   - has_template: si soporta plantillas de documentos
--   - max_review_levels: 0-3, máximo de niveles de revisión permitidos
--
-- La tabla hija `characteristics` se elimina de la UI pero se mantiene
-- en la BD por compatibilidad.
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar has_template y max_review_levels a action_features
ALTER TABLE action_features
  ADD COLUMN IF NOT EXISTS has_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_review_levels int NOT NULL DEFAULT 1;

-- 2. Constraint: max_review_levels entre 0 y 3
ALTER TABLE action_features
  DROP CONSTRAINT IF EXISTS action_features_max_review_levels_check;
ALTER TABLE action_features
  ADD CONSTRAINT action_features_max_review_levels_check
  CHECK (max_review_levels >= 0 AND max_review_levels <= 3);

-- 3. Seed inicial basado en los flags existentes
--    has_issue + has_review + has_approve = 3 niveles
--    has_issue + has_review = 2 niveles
--    has_issue = 1 nivel
--    ninguno = 0 niveles (gestión muerta)
UPDATE action_features
  SET max_review_levels = CASE
    WHEN has_issue AND has_review AND has_approve THEN 3
    WHEN has_issue AND has_review THEN 2
    WHEN has_issue THEN 1
    ELSE 0
  END
  WHERE max_review_levels = 1 AND has_issue IS NOT NULL;

-- 4. has_template: derivar de has_specific_screen (las que tienen pantalla
--    generalmente no tienen template, excepto las híbridas)
--    Por defecto false, se configura manualmente
UPDATE action_features
  SET has_template = true
  WHERE name ILIKE '%informe%liquidaci%'
     OR name ILIKE '%carta%propuesta%'
     OR name ILIKE '%solicitud%antecedentes%'
     OR name ILIKE '%reserva%'
     OR name ILIKE '%reporte%preliminar%'
     OR name ILIKE '%registro%indemnizaci%';

-- 5. has_specific_screen: ya existe, actualizar basado en nombre
UPDATE action_features
  SET has_specific_screen = true
  WHERE name ILIKE '%inspecci%n'
     OR name ILIKE '%coordinaci%n%inspecci%n%'
     OR name ILIKE '%solicitud%despacho%';
