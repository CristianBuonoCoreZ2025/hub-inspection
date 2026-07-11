-- ═══════════════════════════════════════════════════════════════
-- 96: Enriquecer gestion_screens con descripción de campos
-- para que el usuario sepa qué contiene cada pantalla al asociarla.
-- ═══════════════════════════════════════════════════════════════

UPDATE gestion_screens
SET form_schema = CASE code
  WHEN 'email' THEN '{"component": "EmailScreen", "fields": ["Contacto", "Tipo de Contacto", "Aviso (fecha/hora)", "Detalles de Contacto", "Plantilla", "Preview del mensaje"]}'::jsonb
  WHEN 'coordinacion' THEN '{"component": "CoordinacionScreen", "fields": ["Inspector", "Ubicación", "Fecha y Hora de Inspección", "Tipo de Contacto", "Contacto", "Comentarios", "Tipo Coordinación"]}'::jsonb
  WHEN 'coberturas' THEN '{"component": "CoberturasScreen", "fields": ["Cobertura", "Subcobertura", "Monto Asegurado", "Monto Afectado", "Aplica/No aplica"]}'::jsonb
  WHEN 'reserva' THEN '{"component": "ReservaScreen", "fields": ["Monto Reservado", "Moneda", "Cuenta Bancaria", "Fecha Pago", "Instrucción de Pago"]}'::jsonb
  WHEN 'solicitud_docs' THEN '{"component": "SolicitudDocumentosScreen", "fields": ["Documento", "Solicitado", "Recibido", "Fecha Recibido"]}'::jsonb
  WHEN 'liquidacion' THEN '{"component": "LiquidacionScreen", "fields": ["N° Informe", "Monto Indemnización", "Deducible", "Coaseguro", "Monto Final", "Resumen del Informe"]}'::jsonb
  WHEN 'cierre' THEN '{"component": "CierreScreen", "fields": ["Motivo de Cierre", "Fecha Cierre", "Monto Final", "Comentarios"]}'::jsonb
  WHEN 'reapertura' THEN '{"component": "ReaperturaScreen", "fields": ["Motivo de Reapertura", "Fecha Reapertura", "Comentarios"]}'::jsonb
  WHEN 'prorroga' THEN '{"component": "ProrrogaScreen", "fields": ["Motivo de Prórroga", "Nueva Fecha Límite", "Comentarios"]}'::jsonb
  WHEN 'impugnacion' THEN '{"component": "ImpugnacionScreen", "fields": ["Motivo de Impugnación", "Respuesta", "Fecha Respuesta", "Comentarios"]}'::jsonb
  WHEN 'indemnizacion' THEN '{"component": "IndemnizacionScreen", "fields": ["Monto Indemnización", "Moneda", "Cuenta Bancaria", "Instrucción de Pago"]}'::jsonb
  WHEN 'generica' THEN '{"component": "GenericaScreen", "fields": ["Editor JSON libre para datos específicos de la gestión"]}'::jsonb
  ELSE form_schema
END
WHERE code IN ('email','coordinacion','coberturas','reserva','solicitud_docs','liquidacion','cierre','reapertura','prorroga','impugnacion','indemnizacion','generica');
