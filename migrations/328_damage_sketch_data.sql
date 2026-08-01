-- Agrega sketch_data JSONB a damage_sketches para guardar el estado editable del canvas.
-- Permite recargar un croquis como objetos de Fabric en lugar de imagen plana.

ALTER TABLE damage_sketches
  ADD COLUMN IF NOT EXISTS sketch_data JSONB;

COMMENT ON COLUMN damage_sketches.sketch_data IS 'JSON con el canvas de Fabric (objects, backgroundImage, etc.)';
