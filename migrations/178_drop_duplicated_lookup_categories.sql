-- Migration 178: Eliminar categorias duplicadas de lookup_catalog
--
-- Estas 3 categorias en lookup_catalog tienen tabla individual propia
-- y los claims referencian las tablas individuales, no lookup_catalog.
-- Los registros en lookup_catalog son basura residual sin referencias.
--
-- Categorias a eliminar (10 registros total):
-- - damage_classification (1)  → tabla individual: damage_classifications
-- - housing_destination (2)    → tabla individual: housing_destinations
-- - property_type (7)          → tabla individual: property_classifications
--
-- Verificacion previa: 0 FKs formales referencian estos IDs,
-- y 0 filas en claims.damage_classification_id / property_risk.property_type
-- los referencian. Autorizacion explicita del usuario.

BEGIN;

DELETE FROM lookup_catalog
WHERE category IN ('damage_classification', 'housing_destination', 'property_type');

-- Verificar que se eliminaron las 3 categorias
DO $$
DECLARE
  restantes int;
BEGIN
  SELECT count(*) INTO restantes
  FROM lookup_catalog
  WHERE category IN ('damage_classification', 'housing_destination', 'property_type');

  IF restantes > 0 THEN
    RAISE EXCEPTION 'Quedan % registros en categorias duplicadas. Migracion abortada.', restantes;
  END IF;
END$$;

COMMIT;

-- Resumen final
SELECT 'categorias_restantes' as check,
  string_agg(DISTINCT category, ', ' ORDER BY category) as categorias
FROM lookup_catalog;
