-- Migration 133: Pantalla fija de Inspeccion
-- Agrega is_dynamic para distinguir pantallas dinamicas (editables) de fijas (hardcoded)
-- Crea la pantalla "inspeccion" como fija y la asigna al feature INS

-- 1. Agregar columna is_dynamic (default true para compatibilidad con pantallas existentes)
ALTER TABLE gestion_screens ADD COLUMN IF NOT EXISTS is_dynamic BOOLEAN NOT NULL DEFAULT true;

-- 2. Crear pantalla fija de Inspeccion
INSERT INTO gestion_screens (id, code, name, description, icon, is_active, sort_order, is_dynamic, form_schema)
VALUES (
  'd1000001-0000-0000-0000-000000000010',
  'inspeccion',
  'Inspección',
  'Pantalla fija de inspección (presencial/remota). No editable — componente hardcoded con tabs, wizard de acta, evidencias, daños, croquis, firmas e informe.',
  'search',
  true,
  14,
  false,
  '{"component": "InspectionScreen"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  is_dynamic = EXCLUDED.is_dynamic,
  form_schema = EXCLUDED.form_schema;

-- 3. Asignar la pantalla de inspeccion al feature INS
UPDATE action_features
SET screen_id = 'd1000001-0000-0000-0000-000000000010'
WHERE code = 'INS';
