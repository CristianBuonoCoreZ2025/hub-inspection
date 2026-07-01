-- ============================================================
-- Migracion 56: Inspeccion rediseñada
--
-- 1. inspection_sessions: agregar inspection_type (onsite/remote)
-- 2. lookup_catalog: catálogos de materialidades, tipos de riesgo, relaciones, categorías de evidencia
-- 3. inspection_evidences: agregar category
-- 4. Index para magic link lookup
-- ============================================================

-- 1. inspection_sessions: agregar tipo de inspección
ALTER TABLE inspection_sessions ADD COLUMN IF NOT EXISTS inspection_type text NOT NULL DEFAULT 'onsite';
ALTER TABLE inspection_sessions DROP CONSTRAINT IF EXISTS inspection_sessions_type_check;
ALTER TABLE inspection_sessions ADD CONSTRAINT inspection_sessions_type_check
  CHECK (inspection_type IN ('onsite','remote'));

-- 2. Catálogos en lookup_catalog (sin country_id = aplican a todos los países)
-- Nota: lookup_catalog usa columnas: category, code, name, sort_order, is_active
INSERT INTO lookup_catalog (category, code, name, sort_order) VALUES
  -- Materialidad muros
  ('materiality_walls', 'concrete', 'Hormigón Armado', 1),
  ('materiality_walls', 'brick', 'Albañilería', 2),
  ('materiality_walls', 'adobe', 'Adobe', 3),
  ('materiality_walls', 'wood', 'Madera', 4),
  ('materiality_walls', 'steel', 'Estructura Metálica', 5),
  ('materiality_walls', 'mixed', 'Mixta', 6),
  ('materiality_walls', 'other', 'Otra', 99),
  -- Materialidad cubierta/techumbre
  ('materiality_roof', 'concrete_slab', 'Loseta Hormigón', 1),
  ('materiality_roof', 'metal_sheet', 'Plancha Metálica', 2),
  ('materiality_roof', 'tile', 'Teja', 3),
  ('materiality_roof', 'wood', 'Madera', 4),
  ('materiality_roof', 'membrane', 'Membrana Asfáltica', 5),
  ('materiality_roof', 'other', 'Otra', 99),
  -- Materialidad pisos interiores
  ('materiality_flooring', 'tile', 'Cerámica/Porcelanato', 1),
  ('materiality_flooring', 'wood', 'Madera', 2),
  ('materiality_flooring', 'carpet', 'Alfombra', 3),
  ('materiality_flooring', 'vinyl', 'Vinílico', 4),
  ('materiality_flooring', 'concrete', 'Hormigón', 5),
  ('materiality_flooring', 'floating', 'Piso Flotante', 6),
  ('materiality_flooring', 'other', 'Otro', 99),
  -- Materialidad cielos interiores
  ('materiality_ceiling', 'gypsum', 'Yeso', 1),
  ('materiality_ceiling', 'wood', 'Madera', 2),
  ('materiality_ceiling', 'metal_frame', 'Estructura Metálica', 3),
  ('materiality_ceiling', 'concrete', 'Hormigón', 4),
  ('materiality_ceiling', 'other', 'Otro', 99),
  -- Terminaciones interiores
  ('materiality_interior_finish', 'paint', 'Pintura', 1),
  ('materiality_interior_finish', 'wallpaper', 'Cortina de Papel', 2),
  ('materiality_interior_finish', 'ceramic', 'Cerámica', 3),
  ('materiality_interior_finish', 'wood_panel', 'Panel Madera', 4),
  ('materiality_interior_finish', 'other', 'Otra', 99),
  -- Terminaciones exteriores
  ('materiality_exterior_finish', 'paint', 'Pintura', 1),
  ('materiality_exterior_finish', 'mortar', 'Estuco/Mortero', 2),
  ('materiality_exterior_finish', 'stone', 'Piedra', 3),
  ('materiality_exterior_finish', 'metal_panel', 'Panel Metálico', 4),
  ('materiality_exterior_finish', 'other', 'Otra', 99),
  -- Cierre perimetral
  ('materiality_closure', 'concrete_wall', 'Muro Hormigón', 1),
  ('materiality_closure', 'brick_wall', 'Muro Albañilería', 2),
  ('materiality_closure', 'metal_fence', 'Reja Metálica', 3),
  ('materiality_closure', 'wood_fence', 'Cerca Madera', 4),
  ('materiality_closure', 'none', 'Sin Cierre', 5),
  ('materiality_closure', 'other', 'Otro', 99),
  -- Tipos de riesgo
  ('risk_type', 'house', 'Casa', 1),
  ('risk_type', 'apartment', 'Departamento', 2),
  ('risk_type', 'commercial', 'Local Comercial', 3),
  ('risk_type', 'warehouse', 'Bodega/Industrial', 4),
  ('risk_type', 'office', 'Oficina', 5),
  ('risk_type', 'building', 'Edificio', 6),
  ('risk_type', 'other', 'Otro', 99),
  -- Clases de riesgo
  ('risk_class', 'residential', 'Residencial', 1),
  ('risk_class', 'commercial', 'Comercial', 2),
  ('risk_class', 'industrial', 'Industrial', 3),
  ('risk_class', 'mixed', 'Mixto', 4),
  -- Tipos de inmueble
  ('property_type', 'single_family', 'Unifamiliar', 1),
  ('property_type', 'multi_family', 'Multifamiliar', 2),
  ('property_type', 'condo', 'Condominio', 3),
  ('property_type', 'commercial_local', 'Local Comercial', 4),
  ('property_type', 'warehouse', 'Bodega', 5),
  ('property_type', 'office_building', 'Edificio de Oficinas', 6),
  ('property_type', 'other', 'Otro', 99),
  -- Relación con el asegurado (para entrevista)
  ('interviewed_relationship', 'owner', 'Propietario', 1),
  ('interviewed_relationship', 'tenant', 'Arrendatario', 2),
  ('interviewed_relationship', 'administrator', 'Administrador', 3),
  ('interviewed_relationship', 'family', 'Familiar', 4),
  ('interviewed_relationship', 'employee', 'Empleado', 5),
  ('interviewed_relationship', 'other', 'Otro', 99),
  -- Categorías de evidencias
  ('evidence_category', 'facade', 'Fachada', 1),
  ('evidence_category', 'interior', 'Interior', 2),
  ('evidence_category', 'damage', 'Daño', 3),
  ('evidence_category', 'structural', 'Estructural', 4),
  ('evidence_category', 'detail', 'Detalle', 5),
  ('evidence_category', 'context', 'Contexto/Entorno', 6),
  ('evidence_category', 'document', 'Documento', 7),
  ('evidence_category', 'other', 'Otra', 99)
ON CONFLICT DO NOTHING;

-- 3. inspection_evidences: agregar categoría manual
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS category text;

-- 4. Index para magic link lookup (búsqueda rápida por token)
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_magic_link
  ON inspection_sessions(magic_link_token) WHERE magic_link_token IS NOT NULL;

-- 5. Verificación
DO $$
BEGIN
  RAISE NOTICE 'Migracion 56: inspección rediseñada';
  RAISE NOTICE '  - inspection_sessions: +inspection_type (onsite/remote)';
  RAISE NOTICE '  - lookup_catalog: materialidades, riesgos, relaciones, evidencias';
  RAISE NOTICE '  - inspection_evidences: +category';
  RAISE NOTICE '  - index magic_link_token';
END $$;
