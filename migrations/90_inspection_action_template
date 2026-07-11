-- ═══════════════════════════════════════════════════════════════
-- 90: Vincular inspecciones a gestiones (action_template)
-- ═══════════════════════════════════════════════════════════════

-- Agregar FK de inspection_sessions → action_template
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS action_template_id UUID REFERENCES action_template(id) ON DELETE SET NULL;

-- Comentario para documentación
COMMENT ON COLUMN inspection_sessions.action_template_id IS
  'Gestión (action_template) que originó esta inspección. Determina qué campos/configuración aplica.';

-- Índice para buscar inspecciones por gestión
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_action_template
  ON inspection_sessions(action_template_id)
  WHERE action_template_id IS NOT NULL;
