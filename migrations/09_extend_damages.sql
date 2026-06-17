-- ============================================================
-- Hub Inspections — Migración: Extender inspection_damages
-- Agrega campos del Acta de Inspección McLarens (tabla de daños)
-- ============================================================

ALTER TABLE inspection_damages
  ADD COLUMN IF NOT EXISTS dependency TEXT,
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS materiality_type TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS quantity INTEGER,
  ADD COLUMN IF NOT EXISTS damage_type TEXT DEFAULT 'building' CHECK (damage_type IN ('building','content')),
  ADD COLUMN IF NOT EXISTS product TEXT,
  ADD COLUMN IF NOT EXISTS brand_model TEXT,
  ADD COLUMN IF NOT EXISTS purchase_date DATE,
  ADD COLUMN IF NOT EXISTS estimated_amount NUMERIC(15,2);

COMMENT ON COLUMN inspection_damages.dependency IS 'Dependencia afectada (ej: Edificio comunidad Lyon)';
COMMENT ON COLUMN inspection_damages.sector IS 'Sector específico (ej: Dpto 606, Sala Calderas)';
COMMENT ON COLUMN inspection_damages.materiality_type IS 'Tipo-Materialidad del daño';
COMMENT ON COLUMN inspection_damages.unit IS 'Unidad de medida';
COMMENT ON COLUMN inspection_damages.quantity IS 'Cantidad';
COMMENT ON COLUMN inspection_damages.damage_type IS 'Tipo de daño: building (edificio) o content (contenido)';
COMMENT ON COLUMN inspection_damages.product IS 'Nombre del producto dañado (solo contenido)';
COMMENT ON COLUMN inspection_damages.brand_model IS 'Marca/Modelo del producto (solo contenido)';
COMMENT ON COLUMN inspection_damages.purchase_date IS 'Fecha de compra del producto (solo contenido)';
COMMENT ON COLUMN inspection_damages.estimated_amount IS 'Monto estimado del daño / observaciones monto';
