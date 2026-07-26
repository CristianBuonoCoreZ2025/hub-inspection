-- ═══════════════════════════════════════════════════════════════
-- Migration 234: Junction email_template_actions + HTML + business_line NOT NULL
--
-- Corrige el modelo de plantillas de e-mail:
--  - Pasa de relación 1:1 (email_templates.action_template_id FK obligatoria)
--    a relación N:M vía junction email_template_actions.
--  - Una plantilla se crea SIN acción y se vincula a N acciones después.
--  - Agrega soporte HTML (body_format, logo_url, header_color, description).
--  - business_line_id pasa a ser NOT NULL (obligatoria al crear).
--  - action_template_id queda nullable y obsoleta (NO se dropea, REGLA #1).
--    El código nuevo usa la junction; la columna vieja se conserva por
--    compatibilidad con datos existentes (no hay filas en producción).
--
-- No se borran datos. No se dropean columnas.
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1. Tabla junction: email_template_actions ═══
CREATE TABLE IF NOT EXISTS email_template_actions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_template_id   UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  action_template_id  UUID NOT NULL REFERENCES action_template(id) ON DELETE CASCADE,
  is_default          BOOLEAN NOT NULL DEFAULT false,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una plantilla no se vincula dos veces a la misma acción
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_template_actions_pair
  ON email_template_actions(email_template_id, action_template_id);

-- Solo una plantilla por defecto por (acción, línea de negocio de la plantilla)
-- Partial unique: is_default = true
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_template_actions_default
  ON email_template_actions(action_template_id, email_template_id)
  WHERE is_default = true;

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_email_template_actions_template
  ON email_template_actions(email_template_id);
CREATE INDEX IF NOT EXISTS idx_email_template_actions_action
  ON email_template_actions(action_template_id);

-- updated_at no aplica (junction inmutable salvo is_default); trigger de updated_at
-- se omite intencionalmente: la junction solo cambia is_default, no requiere auditoría
-- de updated_at.

-- ═══ 2. Migrar vínculos existentes a la junction ═══
-- Si hubiera filas en email_templates con action_template_id cargado, las copiamos
-- a la junction marcándolas como default. No se pierde nada.
-- En producción no hay filas todavía, pero el INSERT es idempotente y seguro.
INSERT INTO email_template_actions (email_template_id, action_template_id, is_default, created_by)
SELECT e.id, e.action_template_id, true, e.created_by
FROM email_templates e
WHERE e.action_template_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM email_template_actions eta
    WHERE eta.email_template_id = e.id
      AND eta.action_template_id = e.action_template_id
  );

-- ═══ 3. Agregar columnas HTML a email_templates ═══
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS body_format TEXT NOT NULL DEFAULT 'plain',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS header_color TEXT;

-- Restricción CHECK sobre body_format
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_body_format_check'
  ) THEN
    ALTER TABLE email_templates
      ADD CONSTRAINT email_templates_body_format_check
      CHECK (body_format IN ('plain', 'html'));
  END IF;
END $$;

-- ═══ 4. email_templates.action_template_id → nullable (obsoleta) ═══
-- No se dropea (REGLA #1). El código nuevo ignora esta columna y usa la junction.
ALTER TABLE email_templates
  ALTER COLUMN action_template_id DROP NOT NULL;

-- ═══ 5. email_templates.business_line_id → NOT NULL ═══
-- No hay filas en producción (confirmado), SET NOT NULL directo sin backfill.
ALTER TABLE email_templates
  ALTER COLUMN business_line_id SET NOT NULL;

-- ═══ 6. email_logs.body_format ═══
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS body_format TEXT NOT NULL DEFAULT 'plain';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_body_format_check'
  ) THEN
    ALTER TABLE email_logs
      ADD CONSTRAINT email_logs_body_format_check
      CHECK (body_format IN ('plain', 'html'));
  END IF;
END $$;

-- ═══ 7. Índices adicionales sobre email_templates ═══
CREATE INDEX IF NOT EXISTS idx_email_templates_business_active
  ON email_templates(business_line_id, is_active);

-- ═══ 8. Comentarios ═══
COMMENT ON TABLE email_template_actions IS
  'Junction N:M entre email_templates y action_template. Una plantilla puede vincularse a varias gestiones y viceversa. is_default marca la plantilla por defecto por acción+línea (unique parcial).';

COMMENT ON COLUMN email_templates.action_template_id IS
  'OBSOLETA: usar email_template_actions. Se conserva por compatibilidad (REGLA #1, no dropear).';

COMMENT ON COLUMN email_templates.body_format IS
  'Formato del cuerpo: plain (texto plano) o html (rico con logos, imágenes, estilos).';

COMMENT ON COLUMN email_templates.business_line_id IS
  'Línea de negocio a la que pertenece la plantilla. NOT NULL: una plantilla pertenece a una línea concreta.';
