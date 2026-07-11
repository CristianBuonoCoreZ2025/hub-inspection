-- ═══════════════════════════════════════════════════════════════
-- 98: Simplificar pantallas base y usar campos del sistema
-- ═══════════════════════════════════════════════════════════════

UPDATE gestion_screens
SET form_schema = CASE code
  WHEN 'email' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','contacto','type','text','label','Contacto','placeholder','Nombre o email del contacto'),
    jsonb_build_object('id','tipo_contacto','type','select','label','Tipo de Contacto','options', jsonb_build_array(jsonb_build_object('value','asegurado','label','Asegurado'),jsonb_build_object('value','corredor','label','Corredor'),jsonb_build_object('value','tercero','label','Tercero'))),
    jsonb_build_object('id','aviso','type','datetime','label','Fecha/Hora de Aviso'),
    jsonb_build_object('id','detalles','type','textarea','label','Detalles del Aviso','rows',3)
  ))
  WHEN 'coordinacion' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','inspector_id','type','inspector','label','Inspector / Liquidador'),
    jsonb_build_object('id','ubicacion','type','text','label','Ubicación','placeholder','Dirección de inspección'),
    jsonb_build_object('id','fecha_hora','type','datetime','label','Fecha/Hora de Inspección'),
    jsonb_build_object('id','contacto','type','text','label','Contacto','placeholder','Teléfono de contacto'),
    jsonb_build_object('id','comentarios','type','textarea','label','Comentarios','rows',2)
  ))
  WHEN 'coberturas' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','coberturas','type','claim_coverages','label','Coberturas del Siniestro')
  ))
  WHEN 'reserva' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','liquidation_number','type','liquidation_number','label','N° Liquidación'),
    jsonb_build_object('id','monto','type','number','label','Monto Reservado'),
    jsonb_build_object('id','moneda','type','select','label','Moneda','options',jsonb_build_array(jsonb_build_object('value','CLP','label','CLP'),jsonb_build_object('value','USD','label','USD'),jsonb_build_object('value','EUR','label','EUR'),jsonb_build_object('value','UF','label','UF'))),
    jsonb_build_object('id','fecha_pago','type','date','label','Fecha Pago'),
    jsonb_build_object('id','instruccion_pago','type','textarea','label','Instrucción de Pago','rows',3)
  ))
  WHEN 'solicitud_docs' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','documentos','type','claim_documents','label','Documentos del Siniestro')
  ))
  WHEN 'liquidacion' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','liquidation_number','type','liquidation_number','label','N° Liquidación'),
    jsonb_build_object('id','monto_indemnizacion','type','number','label','Monto Indemnización'),
    jsonb_build_object('id','deducible','type','number','label','Deducible'),
    jsonb_build_object('id','coaseguro','type','number','label','Coaseguro'),
    jsonb_build_object('id','monto_final','type','number','label','Monto Final'),
    jsonb_build_object('id','resumen','type','textarea','label','Resumen del Informe','rows',4)
  ))
  WHEN 'cierre' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','motivo_cierre','type','select','label','Motivo de Cierre','options',jsonb_build_array(jsonb_build_object('value','acuerdo','label','Acuerdo comercial'),jsonb_build_object('value','sincobertura','label','Sin cobertura'),jsonb_build_object('value','desistimiento','label','Desistimiento'))),
    jsonb_build_object('id','monto_final','type','number','label','Monto Final'),
    jsonb_build_object('id','comentarios','type','textarea','label','Comentarios','rows',3)
  ))
  WHEN 'reapertura' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','motivo_reapertura','type','textarea','label','Motivo de Reapertura','required',true,'rows',3),
    jsonb_build_object('id','comentarios','type','textarea','label','Comentarios','rows',2)
  ))
  WHEN 'prorroga' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','motivo_prorroga','type','textarea','label','Motivo de Prórroga','required',true,'rows',3),
    jsonb_build_object('id','nueva_fecha_limite','type','date','label','Nueva Fecha Límite','required',true)
  ))
  WHEN 'impugnacion' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','motivo_impugnacion','type','textarea','label','Motivo de Impugnación','required',true,'rows',3),
    jsonb_build_object('id','respuesta','type','textarea','label','Respuesta','rows',3),
    jsonb_build_object('id','fecha_respuesta','type','date','label','Fecha Respuesta')
  ))
  WHEN 'indemnizacion' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','claim_number','type','claim_number','label','N° Siniestro'),
    jsonb_build_object('id','liquidation_number','type','liquidation_number','label','N° Liquidación'),
    jsonb_build_object('id','monto','type','number','label','Monto Indemnización','required',true),
    jsonb_build_object('id','moneda','type','select','label','Moneda','options',jsonb_build_array(jsonb_build_object('value','CLP','label','CLP'),jsonb_build_object('value','USD','label','USD'),jsonb_build_object('value','EUR','label','EUR'),jsonb_build_object('value','UF','label','UF'))),
    jsonb_build_object('id','instruccion_pago','type','textarea','label','Instrucción de Pago','rows',3)
  ))
  WHEN 'generica' THEN jsonb_build_object('fields', jsonb_build_array(
    jsonb_build_object('id','nombre','type','text','label','Nombre / Referencia'),
    jsonb_build_object('id','descripcion','type','textarea','label','Descripción','rows',4)
  ))
  ELSE form_schema
END
WHERE code IN ('email','coordinacion','coberturas','reserva','solicitud_docs','liquidacion','cierre','reapertura','prorroga','impugnacion','indemnizacion','generica');
