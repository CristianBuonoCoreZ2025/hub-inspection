-- ═════════════════════════════════════════════════════════════════
-- Migración 262: Crear action_feature_screen y eliminar characteristic
--
-- 1. Crear tabla action_feature_screen (junction many-to-many)
-- 2. Migrar datos desde characteristic_screens → action_feature_screen
--    (mapeando characteristic_id → action_feature_id)
-- 3. DROP de characteristic_screens y characteristic (autorización explícita)
-- ═════════════════════════════════════════════════════════════════

-- ── 1. Crear action_feature_screen ──
CREATE TABLE IF NOT EXISTS action_feature_screen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_feature_id UUID NOT NULL REFERENCES action_features(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES gestion_screens(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE action_feature_screen IS 'Junction many-to-many entre action_features y gestion_screens. Reemplaza characteristic_screens (migración 262).';
COMMENT ON COLUMN action_feature_screen.is_default IS 'Si esta pantalla es la default para la action_feature';
COMMENT ON COLUMN action_feature_screen.is_active IS 'Soft-delete: false = desactivada';

CREATE INDEX IF NOT EXISTS idx_action_feature_screen_feature
  ON action_feature_screen(action_feature_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_action_feature_screen_screen
  ON action_feature_screen(screen_id);

-- UNIQUE: una action_feature no puede tener la misma pantalla dos veces
CREATE UNIQUE INDEX IF NOT EXISTS uq_action_feature_screen_feature_screen
  ON action_feature_screen(action_feature_id, screen_id)
  WHERE is_active = true;

-- ── 2. Migrar datos desde characteristic_screens ──
-- Mapear characteristic_id → action_feature_id via characteristic.action_feature_id
INSERT INTO action_feature_screen (action_feature_id, screen_id, is_default, is_active, created_at)
SELECT
  ch.action_feature_id,
  cs.screen_id,
  COALESCE(cs.is_default, false),
  COALESCE(cs.is_active, true),
  COALESCE(cs.created_at, now())
FROM characteristic_screens cs
JOIN characteristic ch ON ch.id = cs.characteristic_id
WHERE NOT EXISTS (
  SELECT 1 FROM action_feature_screen afs
  WHERE afs.action_feature_id = ch.action_feature_id
    AND afs.screen_id = cs.screen_id
);

-- ── 3. DROP de characteristic_screens y characteristic ──
-- Autorización explícita del usuario (migración 262).
-- Los datos ya fueron consolidados en action_features (migración 261)
-- y las relaciones migradas a action_feature_screen arriba.

DROP TABLE IF EXISTS characteristic_screens CASCADE;
DROP TABLE IF EXISTS characteristic CASCADE;
