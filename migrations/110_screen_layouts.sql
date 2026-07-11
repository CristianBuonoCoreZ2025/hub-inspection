-- ═══════════════════════════════════════════════════════════════
-- Migración 110: Ajustar layouts multi-columna de todas las pantallas
--
-- Agrupa campos en filas de 2, 3 o 4 columnas para aprovechar
-- mejor el espacio horizontal de la pantalla.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- cierre: N° Siniestro + Motivo en fila, Monto + Comentarios
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado','width','half'),
  jsonb_build_object('id','cierre_motivo','category','own','type','select','label','Motivo de Cierre','width','half','options',jsonb_build_array(
    jsonb_build_object('value','pagado','label','Pagado'),
    jsonb_build_object('value','rechazado','label','Rechazado'),
    jsonb_build_object('value','sin_dano','label','Sin Daño'),
    jsonb_build_object('value','acordado','label','Acordado'),
    jsonb_build_object('value','otro','label','Otro')
  )),
  jsonb_build_object('id','cierre_monto','category','own','type','number','label','Monto Final','width','half'),
  jsonb_build_object('id','cierre_comentarios','category','own','type','textarea','label','Comentarios','width','full','rows',3,'maxLength',500)
))
WHERE code = 'cierre';

-- ═══════════════════════════════════════════════════════════════
-- coordinacion: Inspector + Fecha en fila, Ubicación + Contacto en fila
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado','width','half'),
  jsonb_build_object('id','coord_adjuster','category','simple_entity','type','adjuster_name','label','Inspector / Liquidador','width','half'),
  jsonb_build_object('id','coord_fecha','category','own','type','date','label','Fecha/Hora Inspección','width','half','dateType','datetime'),
  jsonb_build_object('id','coord_ubicacion','category','own','type','text','label','Ubicación','width','half','maxLength',200),
  jsonb_build_object('id','coord_contacto','category','own','type','text','label','Contacto','width','half','maxLength',100),
  jsonb_build_object('id','coord_comentarios','category','own','type','textarea','label','Comentarios','width','full','rows',3,'maxLength',500)
))
WHERE code = 'coordinacion';

-- ═══════════════════════════════════════════════════════════════
-- email: Contacto + Tipo en fila, Fecha full, Detalles full
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado','width','half'),
  jsonb_build_object('id','email_contacto','category','own','type','text','label','Contacto','width','half','maxLength',100),
  jsonb_build_object('id','email_tipo','category','own','type','select','label','Tipo de Contacto','width','half','options',jsonb_build_array(
    jsonb_build_object('value','email','label','Email'),
    jsonb_build_object('value','telefono','label','Teléfono'),
    jsonb_build_object('value','whatsapp','label','WhatsApp'),
    jsonb_build_object('value','carta','label','Carta')
  )),
  jsonb_build_object('id','email_fecha','category','own','type','date','label','Fecha/Hora de Aviso','width','half','dateType','datetime'),
  jsonb_build_object('id','email_detalles','category','own','type','textarea','label','Detalles del Aviso','width','full','rows',4,'maxLength',1000)
))
WHERE code = 'email';

-- ═══════════════════════════════════════════════════════════════
-- generica: Nombre + Descripción
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado','width','half'),
  jsonb_build_object('id','gen_nombre','category','own','type','text','label','Nombre / Referencia','width','half','maxLength',100),
  jsonb_build_object('id','gen_descripcion','category','own','type','textarea','label','Descripción','width','full','rows',4,'maxLength',1000)
))
WHERE code = 'generica';

-- ═══════════════════════════════════════════════════════════════
-- impugnacion: N° Siniestro + Fecha Respuesta, Motivo + Respuesta full
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado','width','half'),
  jsonb_build_object('id','impugnacion_fecha','category','own','type','date','label','Fecha Respuesta','width','half','dateType','date'),
  jsonb_build_object('id','impugnacion_motivo','category','own','type','textarea','label','Motivo de Impugnación','width','full','rows',4,'maxLength',1000),
  jsonb_build_object('id','impugnacion_respuesta','category','own','type','textarea','label','Respuesta','width','full','rows',4,'maxLength',1000)
))
WHERE code = 'impugnacion';

-- ═══════════════════════════════════════════════════════════════
-- indemnizacion: N° Siniestro + N° Liquidación, Monto + Moneda, Instrucción full
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','liquidation_number','category','simple_entity','type','liquidation_number','label','N° Liquidación','width','half'),
  jsonb_build_object('id','indem_monto','category','own','type','number','label','Monto Indemnización','width','half'),
  jsonb_build_object('id','indem_moneda','category','own','type','select','label','Moneda','width','half','options',jsonb_build_array(
    jsonb_build_object('value','CLP','label','CLP'),
    jsonb_build_object('value','USD','label','USD'),
    jsonb_build_object('value','EUR','label','EUR'),
    jsonb_build_object('value','UF','label','UF')
  )),
  jsonb_build_object('id','indem_instruccion','category','own','type','textarea','label','Instrucción de Pago','width','full','rows',4,'maxLength',1000)
))
WHERE code = 'indemnizacion';

-- ═══════════════════════════════════════════════════════════════
-- informe_liquidacion: agrupar datos del siniestro y gestión en filas
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  -- Fila 1: Datos gestión (3 columnas)
  jsonb_build_object('id','action_name','category','simple_entity','type','action_name','label','Acción','width','third'),
  jsonb_build_object('id','action_created_at','category','simple_entity','type','action_created_at','label','Fecha de Creación','width','third'),
  jsonb_build_object('id','action_updated_at','category','simple_entity','type','action_updated_at','label','Actualización','width','third'),
  -- Fila 2: Datos siniestro (2 columnas)
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','liquidation_number','category','simple_entity','type','liquidation_number','label','N° Liquidación','width','half'),
  -- Fila 3: Informe (2 columnas)
  jsonb_build_object('id','inf_titulo','category','own','type','text','label','Informe Liquidación','width','half','maxLength',200),
  jsonb_build_object('id','inf_palabras','category','own','type','text','label','Palabras Clave','width','half','maxLength',200),
  -- Fila 4: Fechas (3 columnas)
  jsonb_build_object('id','inf_fecha_entrega','category','own','type','date','label','Fecha de Entrega','width','third'),
  jsonb_build_object('id','inf_en_proceso','category','own','type','select','label','En Proceso','width','third','options',jsonb_build_array(
    jsonb_build_object('value','si','label','Sí'),
    jsonb_build_object('value','no','label','No')
  )),
  jsonb_build_object('id','inf_compromiso','category','own','type','date','label','Compromiso Término','width','third'),
  -- Fila 5: Observación (full)
  jsonb_build_object('id','inf_observacion','category','own','type','textarea','label','Observación','width','full','rows',4,'maxLength',1000),
  -- Entidades complejas (full)
  jsonb_build_object('id','review_levels','category','complex_entity','type','review_levels','label','Niveles de Revisión'),
  jsonb_build_object('id','inf_fuentes','category','complex_entity','type','claim_documents','label','Fuentes'),
  jsonb_build_object('id','inf_historia','category','complex_entity','type','claim_history','label','Historia')
))
WHERE code = 'informe_liquidacion';

-- ═══════════════════════════════════════════════════════════════
-- liquidacion: N° Siniestro + N° Liquidación, 4 montos en una fila
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  -- Fila 1: Datos siniestro (2 columnas)
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','liquidation_number','category','simple_entity','type','liquidation_number','label','N° Liquidación','width','half'),
  -- Fila 2: Acción (full)
  jsonb_build_object('id','action_name','category','simple_entity','type','action_name','label','Informe de Liquidación','width','full'),
  -- Fila 3: 4 montos en una fila (quarter cada uno)
  jsonb_build_object('id','liq_monto','category','own','type','number','label','Monto Indemnización','width','quarter'),
  jsonb_build_object('id','liq_deducible','category','own','type','number','label','Deducible','width','quarter'),
  jsonb_build_object('id','liq_coaseguro','category','own','type','number','label','Coaseguro','width','quarter'),
  jsonb_build_object('id','liq_final','category','own','type','number','label','Monto Final','width','quarter'),
  -- Fila 4: Resumen (full)
  jsonb_build_object('id','liq_resumen','category','own','type','textarea','label','Resumen del Informe','width','full','rows',4,'maxLength',1000)
))
WHERE code = 'liquidacion';

-- ═══════════════════════════════════════════════════════════════
-- prorroga: N° Siniestro + Nueva Fecha, Motivo full
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado','width','half'),
  jsonb_build_object('id','prorroga_fecha','category','own','type','date','label','Nueva Fecha Límite','width','half','dateType','date'),
  jsonb_build_object('id','prorroga_motivo','category','own','type','textarea','label','Motivo de Prórroga','width','full','rows',4,'maxLength',1000)
))
WHERE code = 'prorroga';

-- ═══════════════════════════════════════════════════════════════
-- reapertura: N° Siniestro + Estado, Motivo + Comentarios
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado','width','half'),
  jsonb_build_object('id','reap_motivo','category','own','type','textarea','label','Motivo de Reapertura','width','full','rows',3,'maxLength',500),
  jsonb_build_object('id','reap_comentarios','category','own','type','textarea','label','Comentarios','width','full','rows',3,'maxLength',500)
))
WHERE code = 'reapertura';

-- ═══════════════════════════════════════════════════════════════
-- coberturas: agregar datos del siniestro arriba
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado','width','half'),
  jsonb_build_object('id','review_levels','category','complex_entity','type','review_levels','label','Niveles de Revisión'),
  jsonb_build_object('id','coberturas','category','complex_entity','type','claim_coverages','label','Coberturas del Siniestro')
))
WHERE code = 'coberturas';

-- ═══════════════════════════════════════════════════════════════
-- solicitud_docs: agregar datos del siniestro arriba
-- ═══════════════════════════════════════════════════════════════
UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', jsonb_build_array(
  jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro','width','half'),
  jsonb_build_object('id','claim_status','category','simple_entity','type','claim_status','label','Estado','width','half'),
  jsonb_build_object('id','review_levels','category','complex_entity','type','review_levels','label','Niveles de Revisión'),
  jsonb_build_object('id','sol_docs','category','complex_entity','type','claim_documents','label','Documentos del Siniestro')
))
WHERE code = 'solicitud_docs';
