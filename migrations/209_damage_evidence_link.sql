-- Vincular evidencias con daños de inspección (comprobantes de contenido)
ALTER TABLE inspection_evidences
  ADD COLUMN IF NOT EXISTS damage_id uuid REFERENCES inspection_damages(id) ON DELETE SET NULL;
