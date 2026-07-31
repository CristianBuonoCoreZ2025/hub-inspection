-- ═══════════════════════════════════════════════════════════════
-- Migration 323: Ajustar catálogo de páginas para gestiones
--
-- 1. catalogos_gestiones pasa a ser sub-grupo de catalogos.
-- 2. Se crean las páginas faltantes de Gestiones (tipos, características,
--    pantallas, workflows, etc.) y se les asigna parent_code = catalogos_gestiones.
-- 3. Se crean permisos para esas páginas nuevas (internal todo, el resto nada).
--
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

-- Mover catalogos_gestiones bajo catalogos
UPDATE pages
SET parent_code = 'catalogos', sort_order = 124
WHERE code = 'catalogos_gestiones';

-- Páginas faltantes de gestiones
INSERT INTO pages (code, label, category, actions, parent_code, sort_order) VALUES
  ('catalogos_gestiones_tipos', 'Tipos De Gestión', 'Catálogos', ARRAY['view','edit','create','delete'], 'catalogos_gestiones', 1241),
  ('catalogos_gestiones_caracteristicas', 'Características', 'Catálogos', ARRAY['view','edit','create','delete'], 'catalogos_gestiones', 1242),
  ('catalogos_gestiones_gestiones', 'Gestiones', 'Catálogos', ARRAY['view','edit','create','delete'], 'catalogos_gestiones', 1243),
  ('catalogos_gestiones_email_templates', 'Plantillas E-mail', 'Catálogos', ARRAY['view','edit','create','delete'], 'catalogos_gestiones', 1244),
  ('catalogos_gestiones_prompts', 'Prompts IA', 'Catálogos', ARRAY['view','edit','create','delete'], 'catalogos_gestiones', 1245),
  ('catalogos_gestiones_dependencias', 'Dependencias', 'Catálogos', ARRAY['view','edit','create','delete'], 'catalogos_gestiones', 1246),
  ('catalogos_gestiones_campos', 'Campos Plantillas', 'Catálogos', ARRAY['view','edit','create','delete'], 'catalogos_gestiones', 1247),
  ('catalogos_pantallas', 'Pantallas', 'Catálogos', ARRAY['view','edit','create','delete'], 'catalogos_gestiones', 1248),
  ('catalogos_workflows', 'Workflows', 'Catálogos', ARRAY['view','edit','create','delete'], 'catalogos_gestiones', 1249)
ON CONFLICT (code) DO NOTHING;

-- Sembrar user_type_permissions para las páginas nuevas
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
  SELECT code FROM pages WHERE code IN (
    'catalogos_gestiones_tipos',
    'catalogos_gestiones_caracteristicas',
    'catalogos_gestiones_gestiones',
    'catalogos_gestiones_email_templates',
    'catalogos_gestiones_prompts',
    'catalogos_gestiones_dependencias',
    'catalogos_gestiones_campos',
    'catalogos_pantallas',
    'catalogos_workflows'
  )
) p
WHERE NOT EXISTS (
  SELECT 1
  FROM user_type_permissions utp
  WHERE utp.user_type = r.r::text AND utp.section = p.code
);
