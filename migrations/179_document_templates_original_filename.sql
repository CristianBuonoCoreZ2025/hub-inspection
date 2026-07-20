-- Migration 179: Agregar original_filename a document_templates
--
-- El campo file_name queda con el nombre CODIFICADO (ej: HIFL-00001.docx)
-- El nuevo campo original_filename guarda el nombre original del archivo
-- subido por el usuario (ej: "Informe Final Personas-Standard.docx")
-- como referencia/display.

ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS original_filename text;
