-- Migration 139: Tabla de dependencias entre plantillas de gestion
-- Define paquetes globales: cobertura→reserva→ajuste, solicitud→recepcion, etc.
-- Estas dependencias son independientes de pais/evento/linea.

CREATE TABLE IF NOT EXISTS action_template_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_template_id UUID NOT NULL REFERENCES action_template(id) ON DELETE CASCADE,
  child_template_id UUID NOT NULL REFERENCES action_template(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_template_id, child_template_id),
  CHECK (parent_template_id != child_template_id)
);

-- Indice para buscar hijos de un template
CREATE INDEX IF NOT EXISTS idx_atd_parent ON action_template_dependencies(parent_template_id);
CREATE INDEX IF NOT EXISTS idx_atd_child ON action_template_dependencies(child_template_id);

-- RLS
ALTER TABLE action_template_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_template_dependencies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "action_template_dependencies_all" ON action_template_dependencies;
CREATE POLICY "action_template_dependencies_all" ON action_template_dependencies
  FOR ALL TO public USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_atd_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_atd_updated ON action_template_dependencies;
CREATE TRIGGER trg_atd_updated BEFORE UPDATE ON action_template_dependencies
FOR EACH ROW EXECUTE FUNCTION update_atd_updated_at();

-- Migrar dependencias intrinsecas existentes (hardcoded en codigo)
-- RES depende de COB, PCA depende de RES, RTA depende de NSA, INS depende de COI
INSERT INTO action_template_dependencies (parent_template_id, child_template_id)
SELECT p.id, c.id
FROM action_template p, action_template c
WHERE p.code = 'COB' AND c.code = 'RES'
   OR p.code = 'RES' AND c.code = 'PCA'
   OR p.code = 'NSA' AND c.code = 'RTA'
   OR p.code = 'COI' AND c.code = 'INS'
ON CONFLICT (parent_template_id, child_template_id) DO NOTHING;
