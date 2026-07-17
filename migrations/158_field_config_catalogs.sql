-- ═══════════════════════════════════════════════════════════════
-- Migration 158: Configuración dinámica de campos por catálogo
--
-- Agrega columna field_config (JSONB) a property_classifications y
-- housing_destinations para configurar qué campos del acta mostrar
-- y qué labels usar, según la clasificación y destino del bien.
--
-- Estructura del JSON:
-- {
--   "show": ["floor_count", "built_surface", ...],  -- campos a mostrar
--   "hide": ["apartment_number", ...],               -- campos a ocultar
--   "labels": { "age_years": "Antigüedad del Producto", ... }
-- }
--
-- Lógica de merge en el frontend:
-- 1. Campos por defecto visibles: age_years, owner_name, worker_resident_count
-- 2. Aplicar classification.show (agregar) y classification.hide (quitar)
-- 3. Aplicar destination.show (agregar) y destination.hide (quitar)
-- 4. Label: classification.labels > destination.labels > default
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columna field_config a property_classifications
ALTER TABLE property_classifications
  ADD COLUMN IF NOT EXISTS field_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN property_classifications.field_config IS
  'Configuración de campos del acta visibles para esta clasificación. JSON: { show: [], hide: [], labels: {} }';

-- 2. Agregar columna field_config a housing_destinations
ALTER TABLE housing_destinations
  ADD COLUMN IF NOT EXISTS field_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN housing_destinations.field_config IS
  'Configuración de campos del acta visibles para este destino. JSON: { show: [], hide: [], labels: {} }';

-- 3. Seed configs para property_classifications
-- Campos por defecto siempre visibles: age_years, owner_name, worker_resident_count

-- Casa: residencial estándar
UPDATE property_classifications SET field_config = '{
  "show": ["floor_count", "built_surface", "room_count", "bathroom_count", "is_habitable"],
  "labels": { "age_years": "Antigüedad del Inmueble", "owner_name": "Nombre Propietario(s)", "worker_resident_count": "N° Habitantes" }
}' WHERE name = 'Casa';

-- Departamento: incluye número de dpto
UPDATE property_classifications SET field_config = '{
  "show": ["apartment_number", "floor_count", "built_surface", "room_count", "bathroom_count", "is_habitable"],
  "labels": { "age_years": "Antigüedad del Inmueble", "owner_name": "Nombre Propietario(s)", "worker_resident_count": "N° Habitantes" }
}' WHERE name = 'Departamento';

-- Oficinas: incluye número de oficinas, no habitable
UPDATE property_classifications SET field_config = '{
  "show": ["floor_count", "built_surface", "office_count"],
  "labels": { "age_years": "Antigüedad del Inmueble", "owner_name": "Representante Legal", "worker_resident_count": "N° Trabajadores" }
}' WHERE name = 'Oficinas';

-- Edificio: incluye oficinas y bodegas
UPDATE property_classifications SET field_config = '{
  "show": ["floor_count", "built_surface", "office_count", "warehouse_count"],
  "labels": { "age_years": "Antigüedad del Inmueble", "owner_name": "Representante Legal", "worker_resident_count": "N° Trabajadores" }
}' WHERE name = 'Edificio';

-- Galpón: incluye bodegas, no habitable
UPDATE property_classifications SET field_config = '{
  "show": ["floor_count", "built_surface", "warehouse_count"],
  "labels": { "age_years": "Antigüedad del Inmueble", "owner_name": "Representante Legal", "worker_resident_count": "N° Trabajadores" }
}' WHERE name = 'Galpón';

-- Maquinaria: campos mínimos, sin inmueble
UPDATE property_classifications SET field_config = '{
  "show": ["business_line"],
  "hide": ["apartment_number", "floor_count", "built_surface", "room_count", "bathroom_count", "is_habitable", "office_count", "warehouse_count", "branch_count"],
  "labels": { "age_years": "Antigüedad del Producto", "owner_name": "Nombre Propietario(s)", "worker_resident_count": "N° Operadores" }
}' WHERE name = 'Maquinaria';

-- Otros: campos básicos
UPDATE property_classifications SET field_config = '{
  "show": ["floor_count", "built_surface"],
  "labels": { "age_years": "Antigüedad del Inmueble", "owner_name": "Nombre Propietario(s)" }
}' WHERE name = 'Otros';

-- No Ingresado: desactivado (no debería aparecer)
UPDATE property_classifications SET is_active = false WHERE name = 'No Ingresado';

-- 4. Seed configs para housing_destinations

-- Habitacional: muestra espacios, baños, habitable; oculta sucursales, rubro
UPDATE housing_destinations SET field_config = '{
  "show": ["room_count", "bathroom_count", "is_habitable"],
  "hide": ["branch_count", "business_line"],
  "labels": { "owner_name": "Nombre Propietario(s)", "worker_resident_count": "N° Habitantes" }
}' WHERE name = 'Habitacional';

-- Comercial: muestra sucursales, rubro; oculta espacios, baños, habitable
UPDATE housing_destinations SET field_config = '{
  "show": ["branch_count", "business_line"],
  "hide": ["room_count", "bathroom_count", "is_habitable"],
  "labels": { "owner_name": "Representante Legal", "worker_resident_count": "N° Trabajadores" }
}' WHERE name = 'Comercial';
