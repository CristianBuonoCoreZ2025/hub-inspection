-- ═══════════════════════════════════════════════════════════════
-- 99: Migrar form_schema al nuevo modelo con categorías
--   - Campos propios (editables con validaciones)
--   - Entidades simples (solo vista, datos del siniestro)
--   - Entidades complejas (solo vista, estructuras del siniestro)
-- ═══════════════════════════════════════════════════════════════

UPDATE gestion_screens
SET form_schema = CASE code
  -- Email: campos propios simples
  WHEN 'email' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','contacto','category','own','type','text','label','Contacto','required',true,'inputType','alphanumeric','maxLength',100,'placeholder','Nombre o email del contacto'),
    jsonb_build_object('id','tipo_contacto','category','own','type','select','label','Tipo de Contacto','required',true,'options',jsonb_build_array(jsonb_build_object('value','asegurado','label','Asegurado'),jsonb_build_object('value','corredor','label','Corredor'),jsonb_build_object('value','tercero','label','Tercero'))),
    jsonb_build_object('id','aviso','category','own','type','date','label','Fecha/Hora de Aviso','required',true,'dateType','datetime'),
    jsonb_build_object('id','detalles','category','own','type','textarea','label','Detalles del Aviso','rows',3,'maxLength',500,'placeholder','Detalles del aviso enviado')
  ))

  -- Coordinación: entidad simple (inspector) + campos propios
  WHEN 'coordinacion' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','inspector','category','simple_entity','type','adjuster_name','label','Inspector / Liquidador'),
    jsonb_build_object('id','ubicacion','category','own','type','text','label','Ubicación','required',true,'inputType','alphanumeric','maxLength',200,'placeholder','Dirección de inspección'),
    jsonb_build_object('id','fecha_hora','category','own','type','date','label','Fecha/Hora de Inspección','required',true,'dateType','datetime'),
    jsonb_build_object('id','contacto','category','own','type','text','label','Contacto','inputType','alphanumeric','maxLength',100,'placeholder','Teléfono de contacto'),
    jsonb_build_object('id','comentarios','category','own','type','textarea','label','Comentarios','rows',2,'maxLength',300)
  ))

  -- Coberturas: entidad compleja (solo vista)
  WHEN 'coberturas' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','coberturas','category','complex_entity','type','claim_coverages','label','Coberturas del Siniestro')
  ))

  -- Reserva: entidades simples + campos propios
  WHEN 'reserva' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','liquidation_number','category','simple_entity','type','liquidation_number','label','N° Liquidación'),
    jsonb_build_object('id','monto','category','own','type','number','label','Monto Reservado','required',true),
    jsonb_build_object('id','moneda','category','own','type','select','label','Moneda','required',true,'options',jsonb_build_array(jsonb_build_object('value','CLP','label','CLP'),jsonb_build_object('value','USD','label','USD'),jsonb_build_object('value','EUR','label','EUR'),jsonb_build_object('value','UF','label','UF'))),
    jsonb_build_object('id','fecha_pago','category','own','type','date','label','Fecha Pago','dateType','date','dateValidation',jsonb_build_object('type','greater_than_today')),
    jsonb_build_object('id','instruccion_pago','category','own','type','textarea','label','Instrucción de Pago','rows',3,'maxLength',500)
  ))

  -- Solicitud de documentos: entidad compleja
  WHEN 'solicitud_docs' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','documentos','category','complex_entity','type','claim_documents','label','Documentos del Siniestro')
  ))

  -- Liquidación: entidades simples + campos propios
  WHEN 'liquidacion' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','liquidation_number','category','simple_entity','type','liquidation_number','label','N° Liquidación'),
    jsonb_build_object('id','monto_indemnizacion','category','own','type','number','label','Monto Indemnización','required',true),
    jsonb_build_object('id','deducible','category','own','type','number','label','Deducible'),
    jsonb_build_object('id','coaseguro','category','own','type','number','label','Coaseguro'),
    jsonb_build_object('id','monto_final','category','own','type','number','label','Monto Final'),
    jsonb_build_object('id','resumen','category','own','type','textarea','label','Resumen del Informe','rows',4,'maxLength',1000)
  ))

  -- Cierre
  WHEN 'cierre' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','motivo_cierre','category','own','type','select','label','Motivo de Cierre','required',true,'options',jsonb_build_array(jsonb_build_object('value','acuerdo','label','Acuerdo comercial'),jsonb_build_object('value','sincobertura','label','Sin cobertura'),jsonb_build_object('value','desistimiento','label','Desistimiento'))),
    jsonb_build_object('id','monto_final','category','own','type','number','label','Monto Final'),
    jsonb_build_object('id','comentarios','category','own','type','textarea','label','Comentarios','rows',3,'maxLength',500)
  ))

  -- Reapertura
  WHEN 'reapertura' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','motivo_reapertura','category','own','type','textarea','label','Motivo de Reapertura','required',true,'rows',3,'maxLength',500),
    jsonb_build_object('id','comentarios','category','own','type','textarea','label','Comentarios','rows',2,'maxLength',300)
  ))

  -- Prórroga
  WHEN 'prorroga' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','motivo_prorroga','category','own','type','textarea','label','Motivo de Prórroga','required',true,'rows',3,'maxLength',500),
    jsonb_build_object('id','nueva_fecha_limite','category','own','type','date','label','Nueva Fecha Límite','required',true,'dateType','date','dateValidation',jsonb_build_object('type','greater_than_today'))
  ))

  -- Impugnación
  WHEN 'impugnacion' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','motivo_impugnacion','category','own','type','textarea','label','Motivo de Impugnación','required',true,'rows',3,'maxLength',500),
    jsonb_build_object('id','respuesta','category','own','type','textarea','label','Respuesta','rows',3,'maxLength',500),
    jsonb_build_object('id','fecha_respuesta','category','own','type','date','label','Fecha Respuesta','dateType','date')
  ))

  -- Indemnización
  WHEN 'indemnizacion' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','category','simple_entity','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','liquidation_number','category','simple_entity','type','liquidation_number','label','N° Liquidación'),
    jsonb_build_object('id','monto','category','own','type','number','label','Monto Indemnización','required',true),
    jsonb_build_object('id','moneda','category','own','type','select','label','Moneda','required',true,'options',jsonb_build_array(jsonb_build_object('value','CLP','label','CLP'),jsonb_build_object('value','USD','label','USD'),jsonb_build_object('value','EUR','label','EUR'),jsonb_build_object('value','UF','label','UF'))),
    jsonb_build_object('id','instruccion_pago','category','own','type','textarea','label','Instrucción de Pago','rows',3,'maxLength',500)
  ))

  -- Genérica: campos propios básicos
  WHEN 'generica' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','nombre','category','own','type','text','label','Nombre / Referencia','required',true,'inputType','alphanumeric','maxLength',100),
    jsonb_build_object('id','descripcion','category','own','type','textarea','label','Descripción','rows',4,'maxLength',1000)
  ))

  ELSE form_schema
END
WHERE code IN ('email','coordinacion','coberturas','reserva','solicitud_docs','liquidacion','cierre','reapertura','prorroga','impugnacion','indemnizacion','generica');
