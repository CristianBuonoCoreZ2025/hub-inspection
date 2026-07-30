-- ═══════════════════════════════════════════════════════════════
-- Migration 277: Backfill de profiles.company_id faltante
--
-- Usuarios existentes con company_id = NULL pero con filas en
-- user_clients: se les setea company_id al cliente más antiguo
-- (menor created_at en user_clients, desempate por company_id).
--
-- NO BORRA NADA. Solo completa el campo que faltaba.
-- Respeta regla #1 del proyecto.
-- ═══════════════════════════════════════════════════════════════

-- Subquery: para cada user_id, el company_id del user_client más antiguo
WITH oldest_client AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    company_id,
    created_at
  FROM user_clients
  ORDER BY user_id, created_at ASC, company_id ASC
)
UPDATE profiles p
SET company_id = oc.company_id,
    updated_at = now()
FROM oldest_client oc
WHERE p.company_id IS NULL
  AND p.deleted_at IS NULL
  AND oc.user_id = p.user_id;

-- Verificación (informativa, no falla el script)
-- Cuenta cuántos profiles siguen sin company_id pero tienen user_clients
-- Debería ser 0 después de correr esto.
