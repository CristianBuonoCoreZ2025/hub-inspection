-- Migración 187: Activar has_template en CIN (Coordinación de Inspección)
--
-- CIN sí debe soportar templates (la migración 186 la dejó en false por error).
-- SOL y AVI siguen en false (no tienen nada que ver con templates).

UPDATE action_features
SET has_template = true, updated_at = now()
WHERE code = 'CIN';

-- Verificación
DO $$
DECLARE
  cin boolean;
BEGIN
  SELECT has_template INTO cin FROM action_features WHERE code = 'CIN';
  RAISE NOTICE 'CIN.has_template=% (debe ser true)', cin;
END $$;
