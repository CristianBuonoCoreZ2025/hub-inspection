-- ═══════════════════════════════════════════════════════════════
-- Migración 115: document_url en coverage_catalog y subcoverage_catalog
--
-- Agrega columna document_url para enlazar al documento depositado
-- en la CMF (Comisión para el Mercado Financiero de Chile).
-- La URL se construye desde el código POL/CAD:
--   https://www.cmfchile.cl/institucional/inc/seguros_deposito_consulta.php?poliza={code_lower}
--
-- También limpia las 3 descriptions que tenían URLs mezcladas.
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columnas
ALTER TABLE coverage_catalog ADD COLUMN IF NOT EXISTS document_url text;
ALTER TABLE subcoverage_catalog ADD COLUMN IF NOT EXISTS document_url text;

-- 2. Construir URL de la CMF desde el código (para los que no tienen URL)
UPDATE coverage_catalog
SET document_url = 'https://www.cmfchile.cl/institucional/inc/seguros_deposito_consulta.php?poliza=' || lower(code)
WHERE document_url IS NULL AND is_active = true;

UPDATE subcoverage_catalog
SET document_url = 'https://www.cmfchile.cl/institucional/inc/seguros_deposito_consulta.php?poliza=' || lower(code)
WHERE document_url IS NULL AND is_active = true;

-- 3. Limpiar descriptions que tenían URLs mezcladas (mover a document_url si no existe)
UPDATE coverage_catalog
SET document_url = description,
    description = NULL
WHERE document_url IS NULL
  AND description ILIKE 'https://www.cmfchile.cl%'
  AND is_active = true;

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_coverage_catalog_doc_url ON coverage_catalog(document_url) WHERE document_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subcoverage_catalog_doc_url ON subcoverage_catalog(document_url) WHERE document_url IS NOT NULL;
