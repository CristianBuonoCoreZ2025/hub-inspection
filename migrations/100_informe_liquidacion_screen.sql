-- ═══════════════════════════════════════════════════════════════
-- 100: Agregar pantalla base "Informe de Liquidación" y entidades
-- de usuarios (emisor, revisor, aprobador) para mostrar en pantallas.
-- ═══════════════════════════════════════════════════════════════

-- Insertar nueva pantalla base Informe de Liquidación
INSERT INTO gestion_screens (code, name, description, icon, is_active, sort_order, form_schema)
VALUES (
  'informe_liquidacion',
  'Informe de Liquidación',
  'Pantalla para ingresar el informe de liquidación con datos de la gestión, emisor, revisor, aprobador, fuentes e historia.',
  'file-text',
  true,
  100,
  jsonb_build_object('fields', jsonb_build_array(
    -- Entidades simples (datos del sistema / gestión)
    jsonb_build_object('id','action_name','category','simple_entity','type','action_name','label','Acción'),
    jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','liquidation_number','category','simple_entity','type','liquidation_number','label','N° Liquidación'),
    jsonb_build_object('id','created_at','category','simple_entity','type','action_created_at','label','Fecha de Creación'),
    jsonb_build_object('id','updated_at','category','simple_entity','type','action_updated_at','label','Actualización'),
    jsonb_build_object('id','issuer','category','simple_entity','type','action_issuer','label','Emisor'),
    jsonb_build_object('id','reviewer','category','simple_entity','type','action_reviewer','label','Revisor'),
    jsonb_build_object('id','approver','category','simple_entity','type','action_approver','label','Aprobador'),
    -- Campos propios editables
    jsonb_build_object('id','nombre_informe','category','own','type','text','label','Informe Liquidación','required',true,'inputType','alphanumeric','maxLength',150),
    jsonb_build_object('id','palabras_clave','category','own','type','text','label','Palabras Clave','inputType','alphanumeric','maxLength',200),
    jsonb_build_object('id','fecha_entrega','category','own','type','date','label','Fecha de Entrega','dateType','date','dateValidation',jsonb_build_object('type','greater_than','compareField','created_at')),
    jsonb_build_object('id','estado_proceso','category','own','type','select','label','En Proceso','options',jsonb_build_array(jsonb_build_object('value','inicio','label','Inicio'),jsonb_build_object('value','en_proceso','label','En Proceso'),jsonb_build_object('value','en_revision','label','En Revisión'),jsonb_build_object('value','aprobado','label','Aprobado'),jsonb_build_object('value','rechazado','label','Rechazado'))),
    jsonb_build_object('id','compromiso_termino','category','own','type','date','label','Compromiso Término','dateType','date'),
    jsonb_build_object('id','observacion','category','own','type','textarea','label','Observación','rows',4,'maxLength',1000),
    -- Entidades complejas (vista)
    jsonb_build_object('id','documentos','category','complex_entity','type','claim_documents','label','Fuentes'),
    jsonb_build_object('id','historia','category','complex_entity','type','claim_history','label','Historia')
  ))
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  form_schema = EXCLUDED.form_schema;

-- Actualizar también la pantalla "liquidacion" para que sea más específica (opcional)
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
  jsonb_build_object('id','liquidation_number','category','simple_entity','type','liquidation_number','label','N° Liquidación'),
  jsonb_build_object('id','nombre_informe','category','simple_entity','type','action_name','label','Informe de Liquidación'),
  jsonb_build_object('id','monto_indemnizacion','category','own','type','number','label','Monto Indemnización','required',true),
  jsonb_build_object('id','deducible','category','own','type','number','label','Deducible'),
  jsonb_build_object('id','coaseguro','category','own','type','number','label','Coaseguro'),
  jsonb_build_object('id','monto_final','category','own','type','number','label','Monto Final'),
  jsonb_build_object('id','resumen','category','own','type','textarea','label','Resumen del Informe','rows',4,'maxLength',1000)
))
WHERE code = 'liquidacion';

-- Crear característica base "Informe de Liquidación" de tipo Pantalla + Templates
INSERT INTO action_features (code, name, has_specific_screen, has_template, max_review_levels, has_control, has_issue, has_review, has_approve, is_active, sort_order, screen_id)
SELECT
  'INF_LIQ',
  'Informe de Liquidación',
  true,
  true,
  3,
  false,
  false,
  true,
  true,
  true,
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM action_features),
  (SELECT id FROM gestion_screens WHERE code = 'informe_liquidacion' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM action_features WHERE code = 'INF_LIQ');
