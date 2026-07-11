-- ═══════════════════════════════════════════════════════════════
-- Migración 104: Reserva por coberturas + Ajuste (ex-liquidacion)
--
-- 1. Agregar payment_date a claim_reserves
-- 2. Renombrar pantalla 'liquidacion' → 'ajuste' y rediseñar
-- 3. Rediseñar pantalla 'reserva' con editor por coberturas
-- 4. Actualizar action_features: renombrar liquidacion → ajuste
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar payment_date a claim_reserves
ALTER TABLE claim_reserves ADD COLUMN IF NOT EXISTS payment_date date;

-- 2. Crear pantalla 'ajuste' (reemplaza a 'liquidacion')
INSERT INTO gestion_screens (code, name, description, icon, is_active, sort_order, form_schema)
VALUES (
  'ajuste',
  'Ajuste',
  'Ajuste por cobertura: toma los datos reservados y permite ajustar montos por cobertura.',
  'scale',
  true,
  110,
  jsonb_build_object('fields', jsonb_build_array(
    -- Datos del siniestro (solo vista)
    jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado'),
    -- Datos de la gestión (solo vista)
    jsonb_build_object('id','action_issuer','category','simple_entity','type','action_issuer','label','Emisor'),
    jsonb_build_object('id','action_reviewer','category','simple_entity','type','action_reviewer','label','Revisor'),
    jsonb_build_object('id','action_approver','category','simple_entity','type','action_approver','label','Aprobador'),
    -- Editor de ajuste por cobertura (entidad compleja interactiva)
    jsonb_build_object('id','ajuste_coberturas','category','complex_entity','type','claim_adjustment_form','label','Ajuste por Cobertura')
  ))
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  form_schema = EXCLUDED.form_schema;

-- Desactivar pantalla 'liquidacion' anterior
UPDATE gestion_screens SET is_active = false WHERE code = 'liquidacion' AND code != 'ajuste';

-- 3. Rediseñar pantalla 'reserva' con editor por coberturas
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  -- Datos del siniestro (solo vista)
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado'),
  -- Datos de la gestión (solo vista)
  jsonb_build_object('id','action_issuer','category','simple_entity','type','action_issuer','label','Emisor'),
  jsonb_build_object('id','action_reviewer','category','simple_entity','type','action_reviewer','label','Revisor'),
  jsonb_build_object('id','action_approver','category','simple_entity','type','action_approver','label','Aprobador'),
  -- Editor de reserva por cobertura (entidad compleja interactiva)
  jsonb_build_object('id','reserva_coberturas','category','complex_entity','type','claim_reserve_form','label','Reserva por Cobertura')
))
WHERE code = 'reserva';

-- 4. Actualizar action_features: crear 'AJUSTE' si no existe
INSERT INTO action_features (code, name, has_specific_screen, has_template, max_review_levels, has_control, has_issue, has_review, has_approve, is_active, sort_order, screen_id)
SELECT
  'AJUSTE',
  'Ajuste',
  true,
  false,
  3,
  false,
  true,
  true,
  true,
  true,
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM action_features),
  (SELECT id FROM gestion_screens WHERE code = 'ajuste' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM action_features WHERE code = 'AJUSTE');

-- Si existe action_feature con code 'INF_LIQ' o nombre 'Liquidación', actualizarla a 'Ajuste'
UPDATE action_features
SET code = 'AJUSTE', name = 'Ajuste', screen_id = (SELECT id FROM gestion_screens WHERE code = 'ajuste' LIMIT 1)
WHERE code = 'INF_LIQ';
