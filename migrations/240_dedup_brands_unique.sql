-- ═══════════════════════════════════════════════════════════════
-- Migración 240: Deduplicar marcas + unique constraint
-- ═══════════════════════════════════════════════════════════════
--
-- El seed de la migración 238 insertó marcas con ON CONFLICT DO NOTHING,
-- pero como no había unique constraint en name, algunas marcas duplicadas
-- en brands.json (Stanley, Corona) se insertaron dos veces.
--
-- Esta migración:
-- 1. Deduplica: para cada nombre duplicado, mantiene la primera fila
--    (por created_at) y elimina las demás.
-- 2. Agrega unique constraint en name para prevenir futuros duplicados.
--
-- Nota: las relaciones en content_good_product_brands usan LIMIT 1 al
-- resolver brand_id, así que apuntan a la primera marca encontrada.
-- Después de esta migración, queda una sola marca por nombre.
-- ═══════════════════════════════════════════════════════════════

-- 1. Eliminar duplicados: para cada nombre con más de una fila,
--    mantener la de menor created_at (o menor id como desempate).
DELETE FROM content_good_brands
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM content_good_brands
  ORDER BY name, created_at ASC, id ASC
);

-- 2. Agregar unique constraint en name
ALTER TABLE content_good_brands
  ADD CONSTRAINT content_good_brands_name_key UNIQUE (name);
