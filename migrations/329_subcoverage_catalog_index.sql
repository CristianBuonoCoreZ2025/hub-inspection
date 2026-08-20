-- ═══════════════════════════════════════════════════════════════
-- Migración 329: Índices en subcoverage_catalog
-- ═══════════════════════════════════════════════════════════════
-- Índices de performance para la tabla subcoverage_catalog.
-- No afectan estructura ni datos, solo optimizan consultas.
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_subcoverage_catalog_active
  ON subcoverage_catalog (is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subcoverage_catalog_code
  ON subcoverage_catalog (code);

CREATE INDEX IF NOT EXISTS idx_subcoverage_catalog_doc_url
  ON subcoverage_catalog (document_url)
  WHERE document_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subcoverage_catalog_parent
  ON subcoverage_catalog (coverage_catalog_id);

CREATE INDEX IF NOT EXISTS idx_subcoverage_catalog_parent_active
  ON subcoverage_catalog (coverage_catalog_id, is_active);
