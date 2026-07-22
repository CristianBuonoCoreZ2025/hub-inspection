-- Migración 186: Revertir has_template en features que no deben soportar templates
--
-- La migración 185 activó has_template=true en SOL, AVI y CIN porque tenían
-- document_templates vinculados. Pero por regla de negocio, estas 3 características
-- NO deben soportar templates:
--   · SOL (Solicitud de Antecedentes) — no genera documentos desde template
--   · AVI (Aviso Asignación) — no genera documentos desde template
--   · CIN (Coordinación Inspección) — no genera documentos desde template
--
-- Los document_templates vinculados a estas características son un error
-- de configuración y deberían eliminarse (pero no se borran aquí sin autorización).

UPDATE action_features
SET has_template = false, updated_at = now()
WHERE code IN ('SOL', 'AVI', 'CIN');

-- Verificación
DO $$
DECLARE
  sol boolean; avi boolean; cin boolean;
BEGIN
  SELECT has_template INTO sol FROM action_features WHERE code = 'SOL';
  SELECT has_template INTO avi FROM action_features WHERE code = 'AVI';
  SELECT has_template INTO cin FROM action_features WHERE code = 'CIN';
  RAISE NOTICE 'SOL.has_template=% (debe ser false)', sol;
  RAISE NOTICE 'AVI.has_template=% (debe ser false)', avi;
  RAISE NOTICE 'CIN.has_template=% (debe ser false)', cin;
END $$;
