-- ═══════════════════════════════════════════════════════════════
-- Migración 109: Campos generales de reserva/ajuste a primer nivel
--
-- Los campos generales (moneda, fecha pago, observaciones) eran
-- parte de la entidad compleja claim_reserve_form. Ahora son
-- campos de primer nivel (own) en el schema de la pantalla,
-- al mismo nivel que claim_number, claim_status y review_levels.
--
-- El ReserveEditorForm los recibe como props desde DynamicScreen
-- y ya no los renderiza por separado.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. Actualizar pantalla 'reserva'
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  -- Fila 1: Datos del siniestro (2 columnas)
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado','width','half'),
  -- Niveles de revisión (entidad compleja, full width)
  jsonb_build_object('id','review_levels','category','complex_entity','type','review_levels','label','Niveles de Revisión'),
  -- Fila 2: Campos generales de la reserva (2 columnas)
  jsonb_build_object('id','reserve_currency','category','own','type','select','label','Moneda','width','half','options',jsonb_build_array(
    jsonb_build_object('value','CLP','label','CLP'),
    jsonb_build_object('value','USD','label','USD'),
    jsonb_build_object('value','EUR','label','EUR'),
    jsonb_build_object('value','UF','label','UF')
  )),
  jsonb_build_object('id','reserve_payment_date','category','own','type','date','label','Fecha Pago','width','half','dateType','date'),
  -- Fila 3: Observaciones (full width)
  jsonb_build_object('id','reserve_notes','category','own','type','textarea','label','Observaciones','width','full','rows',3,'maxLength',500),
  -- Editor de reserva por cobertura (entidad compleja, solo campos por cobertura)
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
    )
  )
))
WHERE code = 'reserva';

-- ═══════════════════════════════════════════════════════════════
-- 2. Actualizar pantalla 'ajuste'
-- El ajuste depende de la reserva:
--   - Moneda y fecha de pago vienen de la reserva (no editables)
--   - Los montos reservados se muestran como solo lectura
--   - Solo se editan: adjusted_amount, adjusted_deductible, adjustment_notes
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  -- Fila 1: Datos del siniestro (2 columnas)
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado','width','half'),
  -- Niveles de revisión (entidad compleja, full width)
  jsonb_build_object('id','review_levels','category','complex_entity','type','review_levels','label','Niveles de Revisión'),
  -- Fila 2: Datos de la reserva origen (3 columnas, solo lectura)
  jsonb_build_object('id','reserve_number','category','simple_entity','type','reserve_number','label','N° Reserva','width','third'),
  jsonb_build_object('id','reserve_currency','category','simple_entity','type','reserve_currency','label','Moneda','width','third'),
  jsonb_build_object('id','reserve_payment_date','category','simple_entity','type','reserve_payment_date','label','Fecha Pago','width','third'),
  -- Fila 3: Observaciones del ajuste (full width)
  jsonb_build_object('id','adjustment_notes','category','own','type','textarea','label','Observaciones del Ajuste','width','full','rows',3,'maxLength',500),
  -- Editor de ajuste por cobertura (entidad compleja)
  -- Arrastra los campos de la reserva (reservado, deducible) como solo lectura
  -- y agrega los campos del ajuste (ajustado, ded. ajuste, notas) como editables
  jsonb_build_object(
    'id','ajuste_coberturas',
    'category','complex_entity',
    'type','claim_adjustment_form',
    'label','Ajuste por Cobertura',
    'fields', jsonb_build_array(
      jsonb_build_object('id','coverage_name','label','Cobertura','type','text','editable',false),
      jsonb_build_object('id','subcoverage_name','label','Subcobertura','type','text','editable',false),
      -- Campos arrastrados de la reserva (solo lectura)
      jsonb_build_object('id','reserved_amount','label','Reservado','type','number','editable',false,'column','Reservado'),
      jsonb_build_object('id','deductible_amount','label','Deducible','type','number','editable',false,'column','Deducible'),
      -- Campos del ajuste (editables)
      jsonb_build_object('id','adjusted_amount','label','Ajustado','type','number','editable',true,'column','Ajustado'),
      jsonb_build_object('id','adjusted_deductible','label','Ded. Ajuste','type','number','editable',true,'column','Ded. Ajuste'),
      jsonb_build_object('id','adjusted_net','label','Final','type','number','editable',false,'column','Final','formula','adjusted_amount - adjusted_deductible'),
      jsonb_build_object('id','adjustment_notes','label','Notas Ajuste','type','text','editable',true,'column','Notas Ajuste')
    )
  )
))
WHERE code = 'ajuste';
