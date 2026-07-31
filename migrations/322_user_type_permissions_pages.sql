-- ═══════════════════════════════════════════════════════════════
-- Migration 322: Permisos para todas las páginas del catálogo
--
-- Crea filas en user_type_permissions para cada combinación de
-- perfil y página. Solo "internal" arranca con todos los permisos.
-- No sobrescribe filas existentes.
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO user_type_permissions (
  id,
  user_type,
  section,
  can_view,
  can_edit,
  can_create,
  can_delete,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  r.r,
  p.code,
  (r.r::text = 'internal'),
  (r.r::text = 'internal'),
  (r.r::text = 'internal'),
  (r.r::text = 'internal'),
  NOW(),
  NOW()
FROM (
  SELECT unnest(enum_range(NULL::user_role)) AS r
) r
CROSS JOIN (
  SELECT code FROM pages
) p
WHERE NOT EXISTS (
  SELECT 1
  FROM user_type_permissions utp
  WHERE utp.user_type = r.r::text AND utp.section = p.code
);
