-- ═══════════════════════════════════════════════════════════════
-- 102: Corregir pantalla de Reserva con campos completos
-- ═══════════════════════════════════════════════════════════════

UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  -- Datos del siniestro (solo vista)
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
  jsonb_build_object('id','liquidation_number','category','simple_entity','type','liquidation_number','label','N° Liquidación'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado'),
  -- Campos propios del formulario de reserva
  jsonb_build_object('id','section_reserva','category','own','type','section','label','Datos de la Reserva'),
  jsonb_build_object('id','capital_siniestro','category','own','type','number','label','Capital Siniestro','required',true),
  jsonb_build_object('id','reclamado_siniestro','category','own','type','number','label','Reclamado Siniestro','required',true),
  jsonb_build_object('id','deducible_siniestro','category','own','type','number','label','Deducible Siniestro'),
  jsonb_build_object('id','moneda','category','own','type','select','label','Tipo Moneda Pago','required',true,'options',jsonb_build_array(jsonb_build_object('value','CLP','label','CLP'),jsonb_build_object('value','USD','label','USD'),jsonb_build_object('value','EUR','label','EUR'),jsonb_build_object('value','UF','label','UF'))),
  jsonb_build_object('id','valor_moneda','category','own','type','number','label','Valor Moneda Pago'),
  jsonb_build_object('id','reserva','category','own','type','number','label','Reserva','required',true),
  jsonb_build_object('id','prevision_final','category','own','type','number','label','Previsión Final','required',true),
  jsonb_build_object('id','fecha_pago','category','own','type','date','label','Fecha de Pago','dateType','date','dateValidation',jsonb_build_object('type','greater_than_today')),
  jsonb_build_object('id','instruccion_pago','category','own','type','textarea','label','Instrucción de Pago','rows',3,'maxLength',500),
  -- Coberturas del siniestro (entidad compleja, solo vista)
  jsonb_build_object('id','coberturas','category','complex_entity','type','claim_coverages','label','Coberturas del Siniestro')
))
WHERE code = 'reserva';
