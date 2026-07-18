-- ═══════════════════════════════════════════════════════════════
-- Migración 160: Sincronizar document_requirements con document_types
--
-- Problema: la migración 111 insertó document_requirements con nombres
-- inventados ("Póliza Vigente", "Fotografías del Daño", etc.) y códigos
-- que no existen en document_types ("licencia", "circulacion", "fotos").
--
-- Solución:
-- 1. Eliminar document_requirements con códigos que no existen en document_types
-- 2. Sincronizar document_name con el name de document_types
-- 3. Sincronizar claim_document_request_items con los nombres correctos
-- ═══════════════════════════════════════════════════════════════

-- 1. Eliminar requirements con códigos inválidos
DELETE FROM document_requirements
WHERE document_type_code NOT IN (
  SELECT code FROM document_types WHERE code IS NOT NULL
);

-- 2. Sincronizar document_name con document_types.name
UPDATE document_requirements dr
SET document_name = dt.name,
    updated_at = now()
FROM document_types dt
WHERE dr.document_type_code = dt.code
  AND dr.document_name <> dt.name;

-- 3. Sincronizar claim_document_request_items con los nombres correctos
UPDATE claim_document_request_items it
SET document_name = dt.name,
    updated_at = now()
FROM document_types dt
WHERE it.document_type_code = dt.code
  AND it.document_name <> dt.name;
