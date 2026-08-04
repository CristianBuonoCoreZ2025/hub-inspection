-- Agregar dimensiones separadas para el area de daño
-- Los campos length/width/height/quantity existentes representan la SUPERFICIE TOTAL.
-- Los nuevos damage_* representan el area afectada por el daño.
ALTER TABLE public.inspection_damages
  ADD COLUMN IF NOT EXISTS damage_length numeric,
  ADD COLUMN IF NOT EXISTS damage_width numeric,
  ADD COLUMN IF NOT EXISTS damage_height numeric,
  ADD COLUMN IF NOT EXISTS damage_quantity numeric;

-- Migrar datos existentes: copiar superficie total al area de daño
UPDATE public.inspection_damages
SET damage_length = length,
    damage_width = width,
    damage_height = height,
    damage_quantity = quantity
WHERE damage_length IS NULL
  AND damage_width IS NULL
  AND damage_height IS NULL
  AND damage_quantity IS NULL;
