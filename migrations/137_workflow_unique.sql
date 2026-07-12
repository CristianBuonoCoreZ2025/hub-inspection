-- Migration 137: Workflow — unique per combination, no nulls, no name/description
-- Los workflows son unicos por (estado + pais + evento + linea)
-- Todo es especifico, no hay "todos"

-- 1. Limpiar datos existentes (fresh start)
DELETE FROM workflow_steps;
DELETE FROM workflow_configs;

-- 2. Hacer campos NOT NULL
ALTER TABLE workflow_configs ALTER COLUMN country_id SET NOT NULL;
ALTER TABLE workflow_configs ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE workflow_configs ALTER COLUMN business_line_id SET NOT NULL;

-- 3. Eliminar columnas name y description (no se necesitan)
ALTER TABLE workflow_configs DROP COLUMN IF EXISTS name;
ALTER TABLE workflow_configs DROP COLUMN IF EXISTS description;
ALTER TABLE workflow_configs DROP COLUMN IF EXISTS sort_order;

-- 4. Unique constraint: no se pueden tener dos workflows para la misma combinacion
DROP INDEX IF EXISTS idx_workflow_configs_unique;
CREATE UNIQUE INDEX idx_workflow_configs_unique
  ON workflow_configs(claim_status_id, country_id, event_id, business_line_id);
