-- ═══════════════════════════════════════════════════════════════
-- 181: Configuración dinámica del menú lateral de navegación
--
-- Tabla singleton (un solo registro id=1) que guarda la estructura
-- del menú como JSON. Permite reordenar y anidar items sin tocar código.
--
-- La estructura del JSON:
-- {
--   "items": [
--     { "type": "link", "key": "/dashboard" },
--     { "type": "group", "key": "catalogos", "children": [
--       { "type": "link", "key": "/dashboard/catalogos/ubicaciones" },
--       ...
--     ]}
--   ]
-- }
--
-- - type "link": item individual, key = href
-- - type "group": grupo con submenu, key = section, children = items anidados
-- - Los metadatos (label, icon) se resuelven desde nav-data.ts en runtime
-- - Si un item de la config no existe en nav-data.ts, se omite
-- - Si un item de nav-data.ts no está en la config, se agrega al final
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nav_menu_config (
  id INT PRIMARY KEY DEFAULT 1,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT nav_menu_config_singleton CHECK (id = 1)
);

COMMENT ON TABLE nav_menu_config IS 'Configuración singleton del menú lateral. El campo config guarda la estructura jerárquica como JSON. Solo existe un registro (id=1).';
COMMENT ON COLUMN nav_menu_config.config IS 'JSON con la estructura del menú: { items: [{ type: "link"|"group", key, children? }] }';

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION set_nav_menu_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nav_menu_config_updated_at ON nav_menu_config;
CREATE TRIGGER trg_nav_menu_config_updated_at
  BEFORE UPDATE ON nav_menu_config
  FOR EACH ROW
  EXECUTE FUNCTION set_nav_menu_config_updated_at();

-- RLS: todos pueden leer, solo 'internal' (rol con más privilegios) puede escribir
ALTER TABLE nav_menu_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nav_menu_config_read_all" ON nav_menu_config;
CREATE POLICY "nav_menu_config_read_all" ON nav_menu_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "nav_menu_config_write_admin" ON nav_menu_config;
CREATE POLICY "nav_menu_config_write_admin" ON nav_menu_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'internal'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'internal'
    )
  );

-- Insert default empty config (usa orden hardcoded de nav-data.ts como fallback)
INSERT INTO nav_menu_config (id, config) VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
