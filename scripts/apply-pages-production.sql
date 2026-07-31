-- ═══════════════════════════════════════════════════════════════
-- Script de producción: catálogo de páginas y permisos
--
-- Ejecutar en Nhost / Supabase SQL Editor ANTES de deploy.
-- Es idempotente: puede correrse más de una vez sin duplicar datos.
--
-- Orden:
--   1. Crear tabla pages y poblar recursos.
--   2. Crear user_type_permissions para todas las páginas.
--   3. Ajustar sub-grupo de Gestiones y páginas faltantes.
--
-- NO borra datos de user_type_permissions existentes.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1) Tabla pages y seed
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pages (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  actions TEXT[] NOT NULL DEFAULT '{}',
  parent_code TEXT REFERENCES pages(code) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pages_select" ON pages;
CREATE POLICY "pages_select" ON pages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pages_manage" ON pages;
CREATE POLICY "pages_manage" ON pages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN user_type_data_access da ON da.user_type = p.role
      WHERE p.user_id = auth.uid() AND da.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN user_type_data_access da ON da.user_type = p.role
      WHERE p.user_id = auth.uid() AND da.is_admin = true
    )
  );

GRANT SELECT ON pages TO authenticated;

INSERT INTO pages (code, label, category, actions, sort_order) VALUES
  ('dashboard', 'Dashboard', 'Principales', ARRAY['view'], 10),
  ('claims', 'Siniestros', 'Principales', ARRAY['view','edit','create','delete'], 20),
  ('inspecciones', 'Inspecciones', 'Principales', ARRAY['view','edit','create','delete'], 30),
  ('agenda', 'Agenda', 'Principales', ARRAY['view'], 40),
  ('informes', 'Informes', 'Principales', ARRAY['view'], 50),
  ('supervision', 'Supervisión', 'Principales', ARRAY['view'], 60)
ON CONFLICT (code) DO NOTHING;

INSERT INTO pages (code, label, category, actions, sort_order) VALUES
  ('catalogos', 'Catálogos', 'Catálogos', ARRAY['view','edit','create','delete'], 100),
  ('catalogos_gestiones', 'Gestiones', 'Catálogos', ARRAY['view','edit','create','delete'], 101),
  ('catalogos_ubicaciones', 'Ubicaciones', 'Catálogos', ARRAY['view','edit','create','delete'], 102),
  ('catalogos_causas', 'Causas', 'Catálogos', ARRAY['view','edit','create','delete'], 103),
  ('catalogos_tipos_siniestros', 'Tipos De Siniestros', 'Catálogos', ARRAY['view','edit','create','delete'], 104),
  ('catalogos_eventos', 'Eventos', 'Catálogos', ARRAY['view','edit','create','delete'], 105),
  ('catalogos_companias', 'Compañías', 'Catálogos', ARRAY['view','edit','create','delete'], 106),
  ('catalogos_corredores', 'Corredores', 'Catálogos', ARRAY['view','edit','create','delete'], 107),
  ('catalogos_asesores', 'Asesores', 'Catálogos', ARRAY['view','edit','create','delete'], 108),
  ('catalogos_lineas_negocio', 'Líneas De Negocio', 'Catálogos', ARRAY['view','edit','create','delete'], 109),
  ('catalogos_productos', 'Productos', 'Catálogos', ARRAY['view','edit','create','delete'], 110),
  ('catalogos_tipos_polizas', 'Tipos De Pólizas', 'Catálogos', ARRAY['view','edit','create','delete'], 111),
  ('catalogos_polizas', 'Pólizas', 'Catálogos', ARRAY['view','edit','create','delete'], 112),
  ('catalogos_coberturas', 'Coberturas', 'Catálogos', ARRAY['view','edit','create','delete'], 113),
  ('catalogos_parentescos', 'Parentescos', 'Catálogos', ARRAY['view','edit','create','delete'], 114),
  ('catalogos_tipos_documentos', 'Tipos De Documentos', 'Catálogos', ARRAY['view','edit','create','delete'], 115),
  ('catalogos_antiguedades', 'Antigüedades', 'Catálogos', ARRAY['view','edit','create','delete'], 116),
  ('catalogos_clasificacion_bien', 'Clasificación Bien', 'Catálogos', ARRAY['view','edit','create','delete'], 117),
  ('catalogos_clasificacion_danos', 'Clasificación Daños', 'Catálogos', ARRAY['view','edit','create','delete'], 118),
  ('catalogos_destinos_vivienda', 'Destinos Vivienda', 'Catálogos', ARRAY['view','edit','create','delete'], 119),
  ('catalogos_monedas', 'Monedas', 'Catálogos', ARRAY['view','edit','create','delete'], 120),
  ('catalogos_tipos_cambio', 'Tipos De Cambio', 'Catálogos', ARRAY['view','edit','create','delete'], 121),
  ('catalogos_tempario', 'Tempario', 'Catálogos', ARRAY['view','edit','create','delete'], 122),
  ('catalogos_marcas', 'Marcas', 'Catálogos', ARRAY['view','edit','create','delete'], 123)
ON CONFLICT (code) DO NOTHING;

UPDATE pages SET parent_code = 'catalogos', sort_order = 124 WHERE code = 'catalogos_gestiones';

INSERT INTO pages (code, label, category, actions, sort_order) VALUES
  ('catalogos_inspeccion', 'Catálogos Inspección', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 200),
  ('catalogos_inspeccion_relacion_asegurado', 'Relación Asegurado', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 201),
  ('catalogos_inspeccion_muros', 'Muros', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 202),
  ('catalogos_inspeccion_cubierta', 'Cubierta / Techumbre', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 203),
  ('catalogos_inspeccion_pavimentos', 'Pavimentos Interiores', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 204),
  ('catalogos_inspeccion_cielos', 'Cielos Interiores', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 205),
  ('catalogos_inspeccion_terminaciones_interiores', 'Terminaciones Interiores', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 206),
  ('catalogos_inspeccion_terminaciones_exteriores', 'Terminaciones Exteriores', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 207),
  ('catalogos_inspeccion_cierre_perimetral', 'Cierre Perimetral', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 208),
  ('catalogos_inspeccion_espacios_dano', 'Espacios De Daño', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 209),
  ('catalogos_inspeccion_tipos_bien', 'Tipos De Bien', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 210),
  ('catalogos_inspeccion_productos', 'Productos De Bien', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 211),
  ('catalogos_inspeccion_categorias_evidencia', 'Categorías Evidencia', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 212),
  ('catalogos_inspeccion_motivos_fallida', 'Motivos Reagendamiento', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 213),
  ('catalogos_inspeccion_motivos_desistida', 'Motivos Cancelación', 'Catálogos Inspección', ARRAY['view','edit','create','delete'], 214)
ON CONFLICT (code) DO NOTHING;

INSERT INTO pages (code, label, category, actions, sort_order) VALUES
  ('operaciones', 'Operaciones', 'Operaciones', ARRAY['view','edit','create','delete'], 300),
  ('operaciones_carga_siniestros', 'Carga Siniestros', 'Operaciones', ARRAY['view','create'], 301),
  ('operaciones_carga_catalogos', 'Carga Catálogos', 'Operaciones', ARRAY['view','create'], 302),
  ('operaciones_gestiones', 'Gestiones', 'Operaciones', ARRAY['view','edit','delete'], 303),
  ('operaciones_inhabilitar', 'Inhabilitar', 'Operaciones', ARRAY['view','edit','delete'], 304),
  ('operaciones_reabrir', 'Reabrir', 'Operaciones', ARRAY['view','edit'], 305),
  ('operaciones_reasignar_inspecciones', 'Reasignar Inspecciones', 'Operaciones', ARRAY['view','edit'], 306)
ON CONFLICT (code) DO NOTHING;

INSERT INTO pages (code, label, category, actions, sort_order) VALUES
  ('administracion', 'Administración', 'Administración', ARRAY['view','edit','create','delete'], 400),
  ('users', 'Usuarios', 'Administración', ARRAY['view','edit','create'], 401),
  ('companies', 'Empresas', 'Administración', ARRAY['view','edit','create','delete'], 402),
  ('perfiles', 'Perfiles', 'Administración', ARRAY['view','edit'], 403),
  ('configuracion', 'Configuración', 'Administración', ARRAY['view','edit'], 404)
ON CONFLICT (code) DO NOTHING;

INSERT INTO pages (code, label, category, actions, parent_code, sort_order) VALUES
  ('claims_listado', 'Listado De Siniestros', 'Siniestros', ARRAY['view','create'], 'claims', 21),
  ('claims_detalle', 'Detalle De Siniestro', 'Siniestros', ARRAY['view','edit'], 'claims', 22),
  ('claims_participantes', 'Participantes', 'Siniestros', ARRAY['view','edit','create'], 'claims', 23),
  ('claims_incidente', 'Incidente', 'Siniestros', ARRAY['view','edit'], 'claims', 24),
  ('claims_gestiones', 'Gestiones', 'Siniestros', ARRAY['view'], 'claims', 25),
  ('claims_documentos', 'Documentos', 'Siniestros', ARRAY['view','create','delete'], 'claims', 26),
  ('claims_log', 'Log De Auditoría', 'Siniestros', ARRAY['view'], 'claims', 27)
ON CONFLICT (code) DO NOTHING;

INSERT INTO pages (code, label, category, actions, parent_code, sort_order) VALUES
  ('inspecciones_listado', 'Listado De Inspecciones', 'Inspecciones', ARRAY['view','create'], 'inspecciones', 31),
  ('inspecciones_detalle', 'Detalle De Inspección', 'Inspecciones', ARRAY['view','edit'], 'inspecciones', 32),
  ('inspecciones_acta', 'Acta', 'Inspecciones', ARRAY['view','edit','create'], 'inspecciones', 33),
  ('inspecciones_danos', 'Daños', 'Inspecciones', ARRAY['view','edit','create','delete'], 'inspecciones', 34),
  ('inspecciones_evidencias', 'Evidencias', 'Inspecciones', ARRAY['view','create','delete'], 'inspecciones', 35),
  ('inspecciones_croquis', 'Croquis', 'Inspecciones', ARRAY['view','edit','create','delete'], 'inspecciones', 36),
  ('inspecciones_firmas', 'Firmas', 'Inspecciones', ARRAY['view','create','delete'], 'inspecciones', 37),
  ('inspecciones_informe', 'Informe', 'Inspecciones', ARRAY['view','edit'], 'inspecciones', 38)
ON CONFLICT (code) DO NOTHING;

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

-- ═══════════════════════════════════════════════════════════════
-- 2) Permisos para todas las páginas
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
