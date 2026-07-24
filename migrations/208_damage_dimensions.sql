-- Agregar dimensiones a los daños para calcular m2 y m3
-- length x width = m2, length x width x height = m3
ALTER TABLE inspection_damages
  ADD COLUMN IF NOT EXISTS length numeric,
  ADD COLUMN IF NOT EXISTS width numeric,
  ADD COLUMN IF NOT EXISTS height numeric;
