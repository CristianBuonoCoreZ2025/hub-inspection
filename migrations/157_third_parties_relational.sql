-- ═══════════════════════════════════════════════════════════════
-- Migration 157: Terceros como tabla relacional + asociación con daños
--
-- Problema: Los terceros están almacenados como JSON embebido en
-- inspection_sessions.third_parties, lo que impide asociar daños
-- específicos a terceros.
--
-- Solución:
-- 1. Agregar third_party_id a inspection_damages (FK a third_parties)
-- 2. Migrar datos existentes del JSON embebido a la tabla third_parties
-- 3. Actualizar party_type para usar valores consistentes
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columna third_party_id a inspection_damages
ALTER TABLE inspection_damages
  ADD COLUMN IF NOT EXISTS third_party_id UUID REFERENCES third_parties(id) ON DELETE SET NULL;

COMMENT ON COLUMN inspection_damages.third_party_id IS
  'Tercero asociado al daño (afectado o responsable). NULL si no hay tercero específico.';

-- 2. Actualizar el party_type de third_parties para usar valores en español
-- (la tabla ya existe con party_type TEXT, normalizamos valores)
UPDATE third_parties
SET party_type = 'afectado'
WHERE party_type = 'affected';

UPDATE third_parties
SET party_type = 'responsable'
WHERE party_type = 'responsible';

-- 3. Migrar datos del JSON embebido (inspection_sessions.third_parties)
-- a la tabla third_parties si no existen ya
INSERT INTO third_parties (id, session_id, party_type, full_name, rut, address, commune, phone, email, created_at, updated_at)
SELECT
  gen_random_uuid(),
  s.id,
  COALESCE(tp->>'party_type', 'afectado'),
  tp->>'full_name',
  tp->>'rut',
  tp->>'address',
  tp->>'commune',
  tp->>'phone',
  tp->>'email',
  now(),
  now()
FROM inspection_sessions s,
  jsonb_array_elements(s.third_parties) AS tp
WHERE s.third_parties IS NOT NULL
  AND s.third_parties::text <> '[]'
  AND s.third_parties::text <> 'null'
  AND NOT EXISTS (
    SELECT 1 FROM third_parties existing
    WHERE existing.session_id = s.id
      AND COALESCE(existing.full_name, '') = COALESCE(tp->>'full_name', '')
      AND COALESCE(existing.rut, '') = COALESCE(tp->>'rut', '')
  );

-- 4. Verificar que la tabla third_parties tenga los campos necesarios
-- (ya creada en migración 08_inspection_forms.sql)

-- 5. Índice para búsqueda por sesión
CREATE INDEX IF NOT EXISTS idx_third_parties_session_id ON third_parties(session_id);
CREATE INDEX IF NOT EXISTS idx_inspection_damages_third_party_id ON inspection_damages(third_party_id);
