-- ============================================================
-- Hub Inspections -- Migracion 42: Crear catálogo de Eventos con país
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE events IS 'Catálogo de eventos/causas raíz por país para siniestros';

CREATE INDEX IF NOT EXISTS idx_events_country ON events(country_id);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active);

DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Agregar FK event_id a claims (si aún no existe la columna event_id)
ALTER TABLE claims
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- Seed de eventos comunes para Chile
INSERT INTO events (country_id, code, name, is_active) VALUES
  ((SELECT id FROM countries WHERE code = 'CL'), 'incendio', 'Incendio', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'inundacion', 'Inundación', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'terremoto', 'Terremoto', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'robo', 'Robo / Hurto', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'accidente', 'Accidente', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'caida_arbol', 'Caída de árbol', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'granizo', 'Granizo', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'vandalismo', 'Vandalismo', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'averia', 'Avería de maquinaria', true),
  ((SELECT id FROM countries WHERE code = 'CL'), 'otro', 'Otro', true)
ON CONFLICT DO NOTHING;
