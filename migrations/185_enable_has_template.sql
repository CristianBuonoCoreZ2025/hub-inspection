-- Migración 185: Activar has_template en características que tienen document_templates
--
-- PROBLEMA: 4 características (ILI, SOL, AVI, CIN) tienen document_templates
-- vinculados via action_template, pero su flag has_template=false.
-- Esto hace que la UI muestre "Esta característica no soporta templates"
-- cuando en realidad sí tienen templates asociados.
--
-- SOLUCIÓN: Setear has_template=true en toda característica que tenga
-- al menos un document_template vinculado (via action_template).
--
-- También se setea has_template=true en características que por definición
-- del negocio deben poder generar documentos (aunque hoy no tengan templates):
--   · ILI (Informe de Liquidación) — genera el informe en Word/PDF
--   · PCA (Carta Propuesta al Asegurado) — genera carta
--   · RIM (Respuesta de Impugnación) — genera respuesta
--   · RPR (Reporte Preliminar) — genera reporte
--   · RPA (Recepción de Prórroga CMF) — genera documento
--   · DES (Solicitud de Despacho) — genera solicitud
--   · PRO (Prórroga) — genera documento
--   · ADD (Addendum) — genera addendum

-- 1. has_template=true para toda feature con al menos 1 document_template vinculado
UPDATE action_features af
SET has_template = true, updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM action_template at
  JOIN document_templates dt ON dt.action_template_id = at.id
  WHERE at.action_features_id = af.id
)
AND af.has_template = false;

-- 2. has_template=true para features que por negocio deben soportar templates
UPDATE action_features
SET has_template = true, updated_at = now()
WHERE code IN ('ILI', 'PCA', 'RIM', 'RPR', 'RPA', 'DES', 'PRO', 'ADD')
  AND has_template = false;

-- 3. Verificación
DO $$
DECLARE
  malos int;
BEGIN
  SELECT count(*) INTO malos
  FROM action_features af
  WHERE af.has_template = false
  AND EXISTS (
    SELECT 1 FROM action_template at
    JOIN document_templates dt ON dt.action_template_id = at.id
    WHERE at.action_features_id = af.id
  );
  RAISE NOTICE 'Features con docs pero has_template=false: % (debe ser 0)', malos;
END $$;
