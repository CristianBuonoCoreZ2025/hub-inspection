-- 237_content_good_types_requires_detail.sql
-- Agrega flag para que un Tipo de Bien exija aclaración/detalle al ser seleccionado
-- en el formulario de daños de contenido (igual que lookup_catalog.requires_detail).

ALTER TABLE content_good_types
  ADD COLUMN IF NOT EXISTS requires_detail BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN content_good_types.requires_detail IS 'Si es true, el formulario de daños de contenido debe pedir un detalle/texto libre cuando se selecciona este Tipo de Bien (ej: "Otros")';
