-- ═══════════════════════════════════════════════════════════════
-- Migration 368: third_party_id en evidencias y croquis + FK RESTRICT
--
-- Objetivo:
--   1. Agregar third_party_id a inspection_evidences y damage_sketches
--      para identificar el dueño (asegurado=null vs tercero específico).
--   2. Cambiar las 3 FKs a ON DELETE RESTRICT para bloquear la
--      eliminación de un tercero que tiene daños/evidencias/croquis.
--
-- Regla de negocio:
--   third_party_id = NULL  →  el registro pertenece al asegurado.
--   third_party_id = <id>  →  el registro pertenece a ese tercero.
--   Si no hay terceros en la sesión, todo es del asegurado (NULL).
--
-- No se borran datos. Solo se agregan columnas y constraints.
-- ═══════════════════════════════════════════════════════════════

-- 1. inspection_evidences: agregar third_party_id
ALTER TABLE inspection_evidences
  ADD COLUMN IF NOT EXISTS third_party_id UUID;

COMMENT ON COLUMN inspection_evidences.third_party_id IS
  'Tercero asociado a la evidencia. NULL = pertenece al asegurado.';

-- 2. damage_sketches: agregar third_party_id
ALTER TABLE damage_sketches
  ADD COLUMN IF NOT EXISTS third_party_id UUID;

COMMENT ON COLUMN damage_sketches.third_party_id IS
  'Tercero asociado al croquis. NULL = pertenece al asegurado.';

-- 3. inspection_damages: cambiar FK de SET NULL a RESTRICT
ALTER TABLE inspection_damages
  DROP CONSTRAINT IF EXISTS inspection_damages_third_party_id_fkey;

ALTER TABLE inspection_damages
  ADD CONSTRAINT inspection_damages_third_party_id_fkey
    FOREIGN KEY (third_party_id) REFERENCES third_parties(id)
    ON DELETE RESTRICT;

-- 4. inspection_evidences: FK RESTRICT
ALTER TABLE inspection_evidences
  DROP CONSTRAINT IF EXISTS inspection_evidences_third_party_id_fkey;

ALTER TABLE inspection_evidences
  ADD CONSTRAINT inspection_evidences_third_party_id_fkey
    FOREIGN KEY (third_party_id) REFERENCES third_parties(id)
    ON DELETE RESTRICT;

-- 5. damage_sketches: FK RESTRICT
ALTER TABLE damage_sketches
  DROP CONSTRAINT IF EXISTS damage_sketches_third_party_id_fkey;

ALTER TABLE damage_sketches
  ADD CONSTRAINT damage_sketches_third_party_id_fkey
    FOREIGN KEY (third_party_id) REFERENCES third_parties(id)
    ON DELETE RESTRICT;

-- 6. Índices para búsqueda por tercero
CREATE INDEX IF NOT EXISTS idx_inspection_evidences_third_party_id
  ON inspection_evidences(third_party_id)
  WHERE third_party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_damage_sketches_third_party_id
  ON damage_sketches(third_party_id)
  WHERE third_party_id IS NOT NULL;
