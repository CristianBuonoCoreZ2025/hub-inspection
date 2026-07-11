-- ═══════════════════════════════════════════════════════════════
-- 97: Convertir form_schema a formato de constructor de pantallas
-- Cada pantalla define un array de fields con tipo, label, required, etc.
-- ═══════════════════════════════════════════════════════════════

UPDATE gestion_screens
SET form_schema = jsonb_build_object('fields', CASE code
  WHEN 'email' THEN jsonb_build_array(
    jsonb_build_object('id','contacto','type','select','label','Contacto','required',true,'placeholder','Seleccionar contacto...','options',jsonb_build_array(jsonb_build_object('value','asegurado','label','Asegurado - Nicanor Parra'),jsonb_build_object('value','contacto','label','Contacto'),jsonb_build_object('value','corredor','label','Corredor'))),
    jsonb_build_object('id','tipo_contacto','type','select','label','Tipo de Contacto','required',true,'options',jsonb_build_array(jsonb_build_object('value','email','label','Email'),jsonb_build_object('value','sms','label','SMS'),jsonb_build_object('value','whatsapp','label','WhatsApp'))),
    jsonb_build_object('id','aviso','type','datetime','label','Aviso','required',true),
    jsonb_build_object('id','detalles','type','textarea','label','Detalles de Contacto','required',true,'placeholder','Aviso de Asignación automático','rows',3),
    jsonb_build_object('id','plantilla_id','type','select','label','Plantilla','required',true,'placeholder','Seleccionar plantilla...','options',jsonb_build_array(jsonb_build_object('value','aviso-asignacion','label','Aviso de Asignación automática'))),
    jsonb_build_object('id','preview','type','preview','label','Preview del Mensaje','rows',6)
  )
  WHEN 'coordinacion' THEN jsonb_build_array(
    jsonb_build_object('id','section_1','type','section','label','Datos Coordinación'),
    jsonb_build_object('id','inspector','type','select','label','Inspector','placeholder','Seleccionar inspector...','options',jsonb_build_array(jsonb_build_object('value','torres-paula','label','Torres Pizarro, Paula'))),
    jsonb_build_object('id','ubicacion','type','text','label','Ubicación','required',true,'placeholder','domicilio asegurado'),
    jsonb_build_object('id','section_2','type','section','label','Datos Inspección'),
    jsonb_build_object('id','fecha_hora','type','datetime','label','Fecha y Hora de Inspección','required',true),
    jsonb_build_object('id','tipo_contacto','type','select','label','Tipo de Contacto','required',true,'options',jsonb_build_array(jsonb_build_object('value','sms','label','SMS'),jsonb_build_object('value','email','label','Email'),jsonb_build_object('value','whatsapp','label','WhatsApp'),jsonb_build_object('value','llamada','label','Llamada'))),
    jsonb_build_object('id','contacto','type','text','label','Contacto','required',true,'placeholder','Asegurado'),
    jsonb_build_object('id','comentarios','type','textarea','label','Comentarios','placeholder','coordinación por whatsapp','rows',2),
    jsonb_build_object('id','tipo_coordinacion','type','select','label','Tipo Coordinación','required',true,'options',jsonb_build_array(jsonb_build_object('value','pendiente','label','Pendiente'),jsonb_build_object('value','completada','label','Completada'),jsonb_build_object('value','reprogramada','label','Reprogramada'),jsonb_build_object('value','cancelada','label','Cancelada')))
  )
  WHEN 'coberturas' THEN jsonb_build_array(
    jsonb_build_object('id','coberturas','type','table','label','Coberturas Afectadas','required',false,'columns',jsonb_build_array('Cobertura','Subcobertura','Monto Asegurado','Monto Afectado','Aplica'))
  )
  WHEN 'reserva' THEN jsonb_build_array(
    jsonb_build_object('id','monto','type','number','label','Monto Reservado'),
    jsonb_build_object('id','moneda','type','select','label','Moneda','options',jsonb_build_array(jsonb_build_object('value','CLP','label','CLP'),jsonb_build_object('value','USD','label','USD'),jsonb_build_object('value','EUR','label','EUR'),jsonb_build_object('value','UF','label','UF'))),
    jsonb_build_object('id','cuentaBancaria','type','text','label','Cuenta Bancaria'),
    jsonb_build_object('id','fechaPago','type','date','label','Fecha Pago'),
    jsonb_build_object('id','instruccionPago','type','textarea','label','Instrucción de Pago','rows',3)
  )
  WHEN 'solicitud_docs' THEN jsonb_build_array(
    jsonb_build_object('id','documentos','type','table','label','Documentos Requeridos','columns',jsonb_build_array('Documento','Solicitado','Recibido','Fecha Recibido'))
  )
  WHEN 'liquidacion' THEN jsonb_build_array(
    jsonb_build_object('id','numeroInforme','type','text','label','N° Informe'),
    jsonb_build_object('id','montoIndemnizacion','type','number','label','Monto Indemnización'),
    jsonb_build_object('id','deducible','type','number','label','Deducible'),
    jsonb_build_object('id','coaseguro','type','number','label','Coaseguro'),
    jsonb_build_object('id','montoFinal','type','number','label','Monto Final'),
    jsonb_build_object('id','resumen','type','textarea','label','Resumen del Informe','rows',4)
  )
  WHEN 'cierre' THEN jsonb_build_array(
    jsonb_build_object('id','motivoCierre','type','select','label','Motivo de Cierre','options',jsonb_build_array(jsonb_build_object('value','acuerdo','label','Acuerdo comercial'),jsonb_build_object('value','sincobertura','label','Sin cobertura'),jsonb_build_object('value','desistimiento','label','Desistimiento'))),
    jsonb_build_object('id','fechaCierre','type','date','label','Fecha Cierre'),
    jsonb_build_object('id','montoFinal','type','number','label','Monto Final'),
    jsonb_build_object('id','comentarios','type','textarea','label','Comentarios','rows',3)
  )
  WHEN 'reapertura' THEN jsonb_build_array(
    jsonb_build_object('id','motivoReapertura','type','textarea','label','Motivo de Reapertura','required',true,'rows',3),
    jsonb_build_object('id','fechaReapertura','type','date','label','Fecha Reapertura'),
    jsonb_build_object('id','comentarios','type','textarea','label','Comentarios','rows',2)
  )
  WHEN 'prorroga' THEN jsonb_build_array(
    jsonb_build_object('id','motivoProrroga','type','textarea','label','Motivo de Prórroga','required',true,'rows',3),
    jsonb_build_object('id','nuevaFechaLimite','type','date','label','Nueva Fecha Límite','required',true),
    jsonb_build_object('id','comentarios','type','textarea','label','Comentarios','rows',2)
  )
  WHEN 'impugnacion' THEN jsonb_build_array(
    jsonb_build_object('id','motivoImpugnacion','type','textarea','label','Motivo de Impugnación','required',true,'rows',3),
    jsonb_build_object('id','respuesta','type','textarea','label','Respuesta','rows',3),
    jsonb_build_object('id','fechaRespuesta','type','date','label','Fecha Respuesta'),
    jsonb_build_object('id','comentarios','type','textarea','label','Comentarios','rows',2)
  )
  WHEN 'indemnizacion' THEN jsonb_build_array(
    jsonb_build_object('id','monto','type','number','label','Monto Indemnización','required',true),
    jsonb_build_object('id','moneda','type','select','label','Moneda','options',jsonb_build_array(jsonb_build_object('value','CLP','label','CLP'),jsonb_build_object('value','USD','label','USD'),jsonb_build_object('value','EUR','label','EUR'),jsonb_build_object('value','UF','label','UF'))),
    jsonb_build_object('id','cuentaBancaria','type','text','label','Cuenta Bancaria'),
    jsonb_build_object('id','instruccionPago','type','textarea','label','Instrucción de Pago','rows',3)
  )
  WHEN 'generica' THEN jsonb_build_array(
    jsonb_build_object('id','json','type','json','label','Datos JSON de la gestión','rows',8)
  )
  ELSE form_schema
END)
WHERE code IN ('email','coordinacion','coberturas','reserva','solicitud_docs','liquidacion','cierre','reapertura','prorroga','impugnacion','indemnizacion','generica');
