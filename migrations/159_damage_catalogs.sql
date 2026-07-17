-- ═══════════════════════════════════════════════════════════════
-- Migración 159: Catálogos de Daños
-- ═══════════════════════════════════════════════════════════════
--
-- Crea 3 catálogos para el registro estructurado de daños:
-- 1. damage_spaces — Espacios/Recintos (para daños constructivos)
-- 2. content_good_types — Tipos de Bien (para daños de contenido)
-- 3. building_damage_categories — Categorías de daño constructivo
--
-- También agrega columnas a inspection_damages:
-- - space_id (FK a damage_spaces, para constructivo)
-- - content_good_type_id (FK a content_good_types, para contenido)
-- - building_damage_category_id (FK a building_damage_categories)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. damage_spaces (Espacios/Recintos) ──
CREATE TABLE IF NOT EXISTS damage_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE damage_spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "damage_spaces_select" ON damage_spaces FOR SELECT USING (true);
CREATE POLICY "damage_spaces_all" ON damage_spaces FOR ALL USING (true) WITH CHECK (true);

-- Datos iniciales: Espacios/Recintos
INSERT INTO damage_spaces (name, description) VALUES
  ('Cocina', 'Cocina / Kitchen'),
  ('Baño', 'Baño / Bathroom'),
  ('Dormitorio Principal', 'Dormitorio principal'),
  ('Dormitorio Secundario', 'Dormitorio secundario / infantil'),
  ('Living / Comedor', 'Living y comedor'),
  ('Pasillo', 'Pasillo / Circulación'),
  ('Hall', 'Hall de acceso'),
  ('Lavadero', 'Lavadero / Logia'),
  ('Bodega', 'Bodega / Baulera'),
  ('Garage', 'Garage / Estacionamiento'),
  ('Exterior', 'Exterior / Jardín / Patio'),
  ('Terraza', 'Terraza / Balcón'),
  ('Azotea', 'Azotea / Techo'),
  ('Sótano', 'Sótano / Subterráneo'),
  ('Oficina', 'Oficina / Escritorio'),
  ('Sala Reuniones', 'Sala de reuniones'),
  ('Recepción', 'Recepción / Hall de espera'),
  ('Bodega Industrial', 'Bodega industrial / Almacén'),
  ('Área Común', 'Área común de condominio'),
  ('Escaleras', 'Escaleras / Escalera'),
  ('Estacionamiento Común', 'Estacionamiento común'),
  ('Otro', 'Otro espacio no listado')
ON CONFLICT DO NOTHING;

-- ── 2. content_good_types (Tipos de Bien para contenido) ──
CREATE TABLE IF NOT EXISTS content_good_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_good_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_good_types_select" ON content_good_types FOR SELECT USING (true);
CREATE POLICY "content_good_types_all" ON content_good_types FOR ALL USING (true) WITH CHECK (true);

-- Datos iniciales: Tipos de Bien
INSERT INTO content_good_types (name, description) VALUES
  ('Electrodomésticos', 'Refrigerador, lavadora, secadora, cocina, horno, microondas, etc.'),
  ('Electrónica', 'TV, notebook, PC, tablet, consolas, audio, etc.'),
  ('Móviles', 'Celulares, smartphones, tablets pequeñas'),
  ('Muebles', 'Muebles de living, dormitorio, oficina, cocina'),
  ('Ropa / Vestuario', 'Ropa, calzado, accesorios de vestir'),
  ('Joyas / Bisutería', 'Joyas, relojes, bisutería de valor'),
  ('Maquinaria', 'Maquinaria industrial, herramientas, equipos de trabajo'),
  ('Vehículos', 'Autos, motos, bicicletas, vehículos menores'),
  ('Equipamiento Oficina', 'Impresoras, escáneres, mobiliario de oficina, suministros'),
  ('Equipamiento Deportivo', 'Bicicletas, gimnasio, equipos deportivos'),
  ('Instrumentos Musicales', 'Guitarras, pianos, equipos de sonido profesional'),
  ('Arte / Colecciones', 'Cuadros, esculturas, colecciones de valor'),
  ('Libros / Documentos', 'Libros, documentos importantes, archivos'),
  ('Equipamiento Médico', 'Equipos médicos, sillas de ruedas, etc.'),
  ('Enseres Generales', 'Enseres de casa no clasificados arriba'),
  ('Otros', 'Otros bienes no clasificados')
ON CONFLICT DO NOTHING;

-- ── 3. building_damage_categories (Categorías de daño constructivo) ──
CREATE TABLE IF NOT EXISTS building_damage_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE building_damage_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "building_damage_categories_select" ON building_damage_categories FOR SELECT USING (true);
CREATE POLICY "building_damage_categories_all" ON building_damage_categories FOR ALL USING (true) WITH CHECK (true);

-- Datos iniciales: Categorías de daño constructivo
INSERT INTO building_damage_categories (name, description) VALUES
  ('Muros / Paramentos', 'Muros interiores y exteriores, tabiques'),
  ('Pisos', 'Pisos flotantes, cerámicos, parquet, alfombras'),
  ('Cielos', 'Cielos falsos, cielos rígidos, estructuras de cielo'),
  ('Cubierta / Techumbre', 'Tejados, cubiertas, estructuras de techumbre'),
  ('Estructura', 'Vigas, columnas, fundaciones, estructura general'),
  ('Inst. Eléctricas', 'Instalación eléctrica, tableros, circuitos'),
  ('Inst. Sanitarias / Gas', 'Cañerías, válvulas, instalación de gas, agua'),
  ('Aberturas', 'Ventanas, puertas, marcos, celosías'),
  ('Terminaciones', 'Pintura, papel mural, revestimientos decorativos'),
  ('Cielo Falso', 'Cielos falsos / suspendidos (americano)'),
  ('Revestimientos', 'Revestimientos de muros, cerámicos, piedra'),
  ('Impermeabilización', 'Impermeabilización, membranas, sellados'),
  ('Otros', 'Otros daños constructivos no clasificados')
ON CONFLICT DO NOTHING;

-- ── 4. Agregar columnas a inspection_damages ──
ALTER TABLE inspection_damages
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES damage_spaces(id),
  ADD COLUMN IF NOT EXISTS content_good_type_id UUID REFERENCES content_good_types(id),
  ADD COLUMN IF NOT EXISTS building_damage_category_id UUID REFERENCES building_damage_categories(id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inspection_damages_space_id ON inspection_damages(space_id);
CREATE INDEX IF NOT EXISTS idx_inspection_damages_content_good_type_id ON inspection_damages(content_good_type_id);
CREATE INDEX IF NOT EXISTS idx_inspection_damages_building_damage_category_id ON inspection_damages(building_damage_category_id);

-- Trigger updated_at para las nuevas tablas
CREATE TRIGGER set_updated_at_damage_spaces BEFORE UPDATE ON damage_spaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_content_good_types BEFORE UPDATE ON content_good_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_building_damage_categories BEFORE UPDATE ON building_damage_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
