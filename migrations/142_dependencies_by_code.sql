-- Migration 142: Dependencias por CODIGO, no por template ID
-- Los paquetes son globales (COB->RES->PCA) pero al crear la gestion
-- se busca el template hijo por codigo + business_line del claim.

-- 1. Limpiar tabla
DELETE FROM action_template_dependencies;

-- 2. Cambiar columnas: usar codes en lugar de template IDs
ALTER TABLE action_template_dependencies DROP COLUMN IF EXISTS parent_template_id;
ALTER TABLE action_template_dependencies DROP COLUMN IF EXISTS child_template_id;

ALTER TABLE action_template_dependencies ADD COLUMN IF NOT EXISTS
  parent_code VARCHAR(50) NOT NULL;
ALTER TABLE action_template_dependencies ADD COLUMN IF NOT EXISTS
  child_code VARCHAR(50) NOT NULL;

-- 3. Unique constraint por par de codigos
DROP INDEX IF EXISTS idx_atd_unique_codes;
CREATE UNIQUE INDEX idx_atd_unique_codes
  ON action_template_dependencies(parent_code, child_code);

-- 4. Check: no puede depender de si mismo
ALTER TABLE action_template_dependencies DROP CONSTRAINT IF EXISTS action_template_dependencies_check;
ALTER TABLE action_template_dependencies ADD CONSTRAINT action_template_dependencies_check
  CHECK (parent_code != child_code);

-- 5. Indices
DROP INDEX IF EXISTS idx_atd_parent;
DROP INDEX IF EXISTS idx_atd_child;
CREATE INDEX IF NOT EXISTS idx_atd_parent ON action_template_dependencies(parent_code);
CREATE INDEX IF NOT EXISTS idx_atd_child ON action_template_dependencies(child_code);

-- 6. Migrar dependencias intrinsecas (una sola fila por par de codigos)
INSERT INTO action_template_dependencies (parent_code, child_code)
VALUES
  ('COB', 'RES'),
  ('RES', 'PCA'),
  ('NSA', 'RTA'),
  ('COI', 'INS')
ON CONFLICT (parent_code, child_code) DO NOTHING;
