-- ═══════════════════════════════════════════════════════════════
-- Migración 108: Unificar emisor/revisor/aprobador en entidad compleja
--
-- Problema: action_issuer, action_reviewer, action_approver estaban
-- como 3 simple_entity separados. Se mostraban siempre los 3,
-- incluso si la gestión solo tenía emisión.
--
-- Solución: Reemplazar los 3 campos por un solo complex_entity
-- de tipo 'review_levels' que muestra dinámicamente 1, 2 o 3
-- niveles según la configuración de action_features
-- (has_issue, has_review, has_approve).
--
-- También agrega metadatos de campos a claim_reserve_form y
-- claim_adjustment_form para documentar qué campos tiene cada
-- fila de cobertura.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. Actualizar pantalla 'reserva'
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  -- Datos del siniestro (solo vista)
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado'),
  -- Niveles de revisión (entidad compleja, muestra 1-3 niveles según config)
  jsonb_build_object('id','review_levels','category','complex_entity','type','review_levels','label','Niveles de Revisión'),
  -- Editor de reserva por cobertura (entidad compleja interactiva)
  jsonb_build_object(
    'id','reserva_coberturas',
    'category','complex_entity',
    'type','claim_reserve_form',
    'label','Reserva por Cobertura',
    'fields', jsonb_build_array(
      jsonb_build_object('id','coverage_name','label','Cobertura','type','text','editable',false),
      jsonb_build_object('id','subcoverage_name','label','Subcobertura','type','text','editable',false),
      jsonb_build_object('id','claimed_amount','label','Reclamado','type','number','editable',true,'column','Reclamado'),
      jsonb_build_object('id','reserved_amount','label','Reserva','type','number','editable',true,'column','Reserva'),
      jsonb_build_object('id','deductible_amount','label','Deducible','type','number','editable',true,'column','Deducible'),
      jsonb_build_object('id','net_reserve','label','Neta','type','number','editable',false,'column','Neta','formula','reserved_amount - deductible_amount')
    ),
    'general_fields', jsonb_build_array(
      jsonb_build_object('id','currency','label','Moneda','type','select','options','CLP,USD,EUR,UF','editable',true),
      jsonb_build_object('id','payment_date','label','Fecha Pago','type','date','editable',true),
      jsonb_build_object('id','notes','label','Observaciones','type','textarea','editable',true)
    )
  )
))
WHERE code = 'reserva';

-- ═══════════════════════════════════════════════════════════════
-- 2. Actualizar pantalla 'ajuste'
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  -- Datos del siniestro (solo vista)
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
  -- Niveles de revisión (entidad compleja)
  jsonb_build_object('id','review_levels','category','complex_entity','type','review_levels','label','Niveles de Revisión'),
  -- Editor de ajuste por cobertura (entidad compleja interactiva)
  jsonb_build_object(
    'id','ajuste_coberturas',
    'category','complex_entity',
    'type','claim_adjustment_form',
    'label','Ajuste por Cobertura',
    'fields', jsonb_build_array(
      jsonb_build_object('id','coverage_name','label','Cobertura','type','text','editable',false),
      jsonb_build_object('id','subcoverage_name','label','Subcobertura','type','text','editable',false),
      jsonb_build_object('id','reserved_amount','label','Reservado','type','number','editable',false,'column','Reservado'),
      jsonb_build_object('id','deductible_amount','label','Deducible','type','number','editable',false,'column','Deducible'),
      jsonb_build_object('id','adjusted_amount','label','Ajustado','type','number','editable',true,'column','Ajustado'),
      jsonb_build_object('id','adjusted_deductible','label','Ded. Ajuste','type','number','editable',true,'column','Ded. Ajuste'),
      jsonb_build_object('id','adjusted_net','label','Final','type','number','editable',false,'column','Final','formula','adjusted_amount - adjusted_deductible'),
      jsonb_build_object('id','adjustment_notes','label','Notas Ajuste','type','text','editable',true,'column','Notas Ajuste')
    ),
    'general_fields', jsonb_build_array(
      jsonb_build_object('id','currency','label','Moneda','type','text','editable',false),
      jsonb_build_object('id','payment_date','label','Fecha Pago','type','date','editable',false),
      jsonb_build_object('id','adjustment_notes','label','Observaciones del Ajuste','type','textarea','editable',true)
    )
  )
))
WHERE code = 'ajuste';

-- ═══════════════════════════════════════════════════════════════
-- 3. Limpiar pantalla 'informe_liquidacion' si existe activa
--    (quitar los 3 campos separados, agregar review_levels)
-- ═══════════════════════════════════════════════════════════════
-- Solo si la pantalla existe y está activa, reemplazar los 3 campos
-- por review_levels al final del array
DO $$
DECLARE
  fs jsonb;
  new_fields jsonb;
BEGIN
  SELECT form_schema INTO fs FROM gestion_screens WHERE code = 'informe_liquidacion' AND is_active = true LIMIT 1;
  IF fs IS NOT NULL THEN
    -- Filtrar los 3 campos y agregar review_levels
    SELECT jsonb_agg(elem) INTO new_fields
    FROM jsonb_array_elements(fs->'fields') AS elem
    WHERE elem->>'type' NOT IN ('action_issuer','action_reviewer','action_approver');

    new_fields := COALESCE(new_fields, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('id','review_levels','category','complex_entity','type','review_levels','label','Niveles de Revisión')
    );

    UPDATE gestion_screens
    SET form_schema = jsonb_build_object('fields', new_fields)
    WHERE code = 'informe_liquidacion' AND is_active = true;
  END IF;
END $$;

