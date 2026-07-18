-- Unique constraint: un documento no puede estar duplicado en una misma solicitud
-- Previene race conditions en el autoguardado que insertaban items duplicados
CREATE UNIQUE INDEX IF NOT EXISTS uq_claim_doc_items_request_code
  ON claim_document_request_items(request_id, document_type_code);
