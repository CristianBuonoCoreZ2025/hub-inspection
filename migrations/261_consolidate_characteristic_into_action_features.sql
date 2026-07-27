-- ═══════════════════════════════════════════════════════════════════
-- Migración 261: Consolidar characteristic → action_features
-- ═══════════════════════════════════════════════════════════════════
-- Las características (characteristic) nunca debieron existir como tabla
-- separada. Como son 1:1 con action_features, consolidamos todo ahí.
--
-- 1. Agregar columnas faltantes a action_features
-- 2. Copiar datos desde characteristic (primera por feature) a action_features
-- 3. NO borramos characteristic (per AGENTS.md: nunca borrar sin autorización)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Agregar columnas faltantes a action_features ──
ALTER TABLE action_features
  ADD COLUMN IF NOT EXISTS color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS local_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS document_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS document_type boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN action_features.color IS 'Color hex (ej: #0095DA) para identificar la característica visualmente';
COMMENT ON COLUMN action_features.local_name IS 'Nombre local/traducido de la característica';
COMMENT ON COLUMN action_features.document_template IS 'Si esta característica genera documentos desde template';
COMMENT ON COLUMN action_features.email_template IS 'Si esta característica envía emails desde template';
COMMENT ON COLUMN action_features.document_type IS 'Si esta característica define tipos de documento';

-- ── 2. Copiar datos desde characteristic a action_features ──
-- Solo la primera characteristic por feature (la que se usa en la grilla)
UPDATE action_features af
SET
  color = sub.color,
  local_name = sub.local_name,
  document_template = sub.document_template,
  email_template = sub.email_template,
  document_type = sub.document_type
FROM (
  SELECT
    ch.action_feature_id,
    ch.color,
    ch.local_name,
    ch.document_template,
    ch.email_template,
    ch.document_type
  FROM characteristic ch
  WHERE ch.id = (
    SELECT c2.id
    FROM characteristic c2
    WHERE c2.action_feature_id = ch.action_feature_id
      AND c2.is_active = true
    ORDER BY c2.sort_order ASC, c2.created_at ASC
    LIMIT 1
  )
) sub
WHERE af.id = sub.action_feature_id
  -- Solo actualizar si action_features.color es NULL (no sobrescribir)
  AND af.color IS NULL;
