-- 232_lookup_catalog_requires_detail.sql
-- Agrega flag para que un item de lookup_catalog exija aclaración/detalle al ser seleccionado.

ALTER TABLE lookup_catalog
  ADD COLUMN IF NOT EXISTS requires_detail BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN lookup_catalog.requires_detail IS 'Si es true, el formulario que usa este catálogo debe pedir un detalle/texto libre cuando se selecciona este ítem';