-- Migración 188: Solo ILI (pantalla generica) tiene has_template=true
--
-- Regla: por ahora, la única característica que soporta templates es ILI
-- (Informe de Liquidación), que tiene asociada la pantalla "generica".
-- Todas las demás características quedan con has_template=false.

UPDATE action_features
SET has_template = (code = 'ILI'),
    updated_at = now();

-- Verificación
DO $$
DECLARE
  total_true int;
BEGIN
  SELECT count(*) INTO total_true FROM action_features WHERE has_template = true;
  RAISE NOTICE 'Features con has_template=true: % (debe ser 1)', total_true;
END $$;
