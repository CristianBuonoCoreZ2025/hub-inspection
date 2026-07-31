-- ═══════════════════════════════════════════════════════════════
-- Migración 241: Matriz Marca ↔ Tipo de Bien
-- ═══════════════════════════════════════════════════════════════
--
-- Relación N:M entre marcas y tipos de bien. Permite filtrar qué
-- marcas son válidas para un tipo de bien (ej: Chery/Volvo no
-- aparecen en Joyas, solo en Vehículos).
--
-- Se genera automáticamente a partir del pivote producto↔marca:
-- cada marca asociada a un producto hereda el tipo de bien de ese
-- producto.
--
-- Dependencias: migraciones 238 y 239 (content_good_types,
-- content_good_brands, content_good_products, content_good_product_brands)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS content_good_type_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_good_type_id UUID NOT NULL REFERENCES content_good_types(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES content_good_brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (content_good_type_id, brand_id)
);

ALTER TABLE content_good_type_brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "content_good_type_brands_select" ON content_good_type_brands;
DROP POLICY IF EXISTS "content_good_type_brands_all" ON content_good_type_brands;
CREATE POLICY "content_good_type_brands_select" ON content_good_type_brands FOR SELECT USING (true);
CREATE POLICY "content_good_type_brands_all" ON content_good_type_brands FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_content_good_type_brands_type ON content_good_type_brands(content_good_type_id);
CREATE INDEX IF NOT EXISTS idx_content_good_type_brands_brand ON content_good_type_brands(brand_id);

-- ═══════════════════════════════════════════════════════════════
-- SEED: genera la matriz marca↔tipo desde el pivote producto↔marca
-- ═══════════════════════════════════════════════════════════════

INSERT INTO content_good_type_brands (content_good_type_id, brand_id)
SELECT DISTINCT p.content_good_type_id, pb.brand_id
FROM content_good_products p
JOIN content_good_product_brands pb ON pb.product_id = p.id
ON CONFLICT DO NOTHING;
