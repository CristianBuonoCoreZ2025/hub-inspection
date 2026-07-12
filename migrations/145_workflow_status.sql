-- Migration 145: Ciclo de vida de workflow_configs (draft/online/suspended)
--
-- draft:     en construccion, editable, NO crea gestiones
-- online:    activo, NO editable, crea gestiones al entrar en el estado
-- suspended: editable, NO crea gestiones (pero las existentes se mantienen)
--
-- El usuario construye el workflow en draft, lo pone online cuando termina,
-- y puede suspenderlo para modificarlo. Online = bloqueado.

ALTER TABLE workflow_configs ADD COLUMN IF NOT EXISTS
  status VARCHAR(20) NOT NULL DEFAULT 'draft';

-- Migrar workflows existentes: los que tienen is_active=true pasan a 'online'
UPDATE workflow_configs SET status = 'online' WHERE is_active = true AND status = 'draft';

-- Indice para busqueda rapida
CREATE INDEX IF NOT EXISTS idx_workflow_configs_status ON workflow_configs(status);

-- Check constraint
ALTER TABLE workflow_configs DROP CONSTRAINT IF EXISTS workflow_configs_status_check;
ALTER TABLE workflow_configs ADD CONSTRAINT workflow_configs_status_check
  CHECK (status IN ('draft', 'online', 'suspended'));
