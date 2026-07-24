-- ═════════════════════════════════════════════════════════════════
-- Migration 219: eliminar sesiones huérfanas y forzar FK con CASCADE
--
-- Regla de negocio: una inspección siempre debe estar asociada a un
-- siniestro (claim_id) y a una gestión (claim_action_id).
--
-- 1. Pone ON DELETE CASCADE en todas las FK que apuntan a inspection_sessions.id
--    para que borrar una sesión borre sus hijos (evidencias, daños, etc.).
-- 2. Borra sesiones que quedaron sin gestión o sin siniestro.
-- 3. Pone claim_action_id y claim_id NOT NULL.
-- 4. Cambia la FK claim_action_id a ON DELETE CASCADE: si se borra la gestión
--    INS, se borra la sesión y nunca queda huérfana.
--
-- SIN borrar siniestros, claims ni catálogos.
-- ═════════════════════════════════════════════════════════════════

-- 1. FKs hijas de inspection_sessions con ON DELETE CASCADE
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      tc.table_name AS child_table,
      tc.constraint_name AS fk_name,
      kcu.column_name AS child_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'inspection_sessions'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I;', r.child_table, r.fk_name);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES inspection_sessions(id) ON DELETE CASCADE;',
      r.child_table, r.fk_name, r.child_column
    );
  END LOOP;
END $$;

-- 2. Eliminar sesiones huérfanas (y por cascade todo su contenido)
DELETE FROM inspection_sessions
WHERE claim_action_id IS NULL OR claim_id IS NULL;

-- 3. Vínculos obligatorios
ALTER TABLE inspection_sessions
  ALTER COLUMN claim_action_id SET NOT NULL;

ALTER TABLE inspection_sessions
  ALTER COLUMN claim_id SET NOT NULL;

-- 4. Recrear FK claim_action_id con ON DELETE CASCADE
ALTER TABLE inspection_sessions
  DROP CONSTRAINT IF EXISTS inspection_sessions_claim_action_id_fkey;

ALTER TABLE inspection_sessions
  ADD CONSTRAINT inspection_sessions_claim_action_id_fkey
  FOREIGN KEY (claim_action_id)
  REFERENCES claim_actions(id)
  ON DELETE CASCADE;

INSERT INTO _migrations (filename) VALUES ('219_enforce_inspection_session_links.sql')
ON CONFLICT (filename) DO NOTHING;
