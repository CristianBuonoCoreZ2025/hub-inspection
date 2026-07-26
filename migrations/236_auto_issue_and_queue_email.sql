-- ═══════════════════════════════════════════════════════════════
-- Migration 236: Auto-emisión + cola de auto-envío de e-mail
--
-- Cuando el workflow crea una claim_action cuyo action_template tiene
-- auto_complete = true, la acción se emite automáticamente (status = issued).
-- Si además auto_email = true, se inserta un registro en email_logs con
-- status = 'queued' para que el endpoint /api/email/process-queue lo procese
-- (renderice placeholders con datos del claim y envíe vía proveedor).
--
-- El renderizado del body se hace en TypeScript (no en SQL) porque requiere
-- cargar perfiles, participantes y action_data complejo.
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1. Función: auto_issue_and_queue_email ═══
-- Se llama AFTER INSERT en claim_actions cuando el action_template tiene
-- auto_complete = true. Emite la acción y, si auto_email = true, encola el envío.
CREATE OR REPLACE FUNCTION auto_issue_and_queue_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET row_security TO 'off' AS $$
DECLARE
  v_template RECORD;
  v_issued_status UUID;
  v_default_template_id UUID;
  v_claim_company_id UUID;
  v_claim_business_line UUID;
  v_system_user UUID;
BEGIN
  -- Solo procesar gestiones nuevas creadas por workflow (origin = 'W')
  -- o manualmente que tengan auto_complete
  IF NEW.is_active = false THEN RETURN NEW; END IF;

  -- Cargar el action_template con flags de auto-emisión/envío
  SELECT
    at.auto_complete,
    at.auto_email,
    at.auto_email_template_id,
    at.auto_email_recipients,
    at.auto_field_mapping
  INTO v_template
  FROM action_template at
  WHERE at.id = NEW.action_template_id;

  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_template.auto_complete IS NOT TRUE THEN RETURN NEW; END IF;

  -- ID del status "issued" en lookup_catalog
  SELECT id INTO v_issued_status
  FROM lookup_catalog
  WHERE category = 'action_status' AND code = 'issued'
  LIMIT 1;

  IF v_issued_status IS NULL THEN
    -- No se puede emitir sin status. Loguear y salir.
    RAISE NOTICE 'auto_issue: no se encontró status issued en lookup_catalog';
    RETURN NEW;
  END IF;

  -- Buscar un usuario "sistema" para issued_by. Si no hay, usar created_by.
  -- Por ahora usamos created_by de la acción (que en workflow es el claim.updated_by).
  v_system_user := COALESCE(NEW.created_by, NEW.updated_by);

  -- Emitir la acción
  UPDATE claim_actions
  SET
    action_status_id = v_issued_status,
    issued_on = now(),
    issued_by = v_system_user,
    updated_on = now()
  WHERE id = NEW.id;

  -- Si auto_email = true, encolar el envío
  IF v_template.auto_email IS TRUE THEN
    -- Buscar la plantilla por defecto: primero auto_email_template_id directo,
    -- si no, buscar en la junction email_template_actions la que tenga
    -- is_default = true para esta acción.
    v_default_template_id := v_template.auto_email_template_id;

    IF v_default_template_id IS NULL THEN
      SELECT eta.email_template_id INTO v_default_template_id
      FROM email_template_actions eta
      WHERE eta.action_template_id = NEW.action_template_id
        AND eta.is_default = true
      LIMIT 1;
    END IF;

    IF v_default_template_id IS NULL THEN
      RAISE NOTICE 'auto_issue: auto_email=true pero no hay plantilla por defecto para action_template %', NEW.action_template_id;
      RETURN NEW;
    END IF;

    -- Cargar company_id del claim
    SELECT company_id, business_line_id
    INTO v_claim_company_id, v_claim_business_line
    FROM claims WHERE id = NEW.claim_id;

    -- Insertar en email_logs con status='queued'.
    -- El body se renderiza después en /api/email/process-queue.
    INSERT INTO email_logs (
      company_id, claim_id, claim_action_id, email_template_id,
      to_address, cc_address, bcc_address,
      subject, body, body_format,
      status, sent_by, sent_at
    ) VALUES (
      v_claim_company_id,
      NEW.claim_id,
      NEW.id,
      v_default_template_id,
      COALESCE(v_template.auto_email_recipients, '{}')::text[],
      '{}'::text[],
      '{}'::text[],
      '',  -- subject se renderiza después
      '',  -- body se renderiza después
      'plain',  -- body_format se actualiza después
      'queued',
      v_system_user,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ═══ 2. Trigger AFTER INSERT en claim_actions ═══
DROP TRIGGER IF EXISTS trigger_auto_issue_and_queue_email ON claim_actions;
CREATE TRIGGER trigger_auto_issue_and_queue_email
  AFTER INSERT ON claim_actions
  FOR EACH ROW
  EXECUTE FUNCTION auto_issue_and_queue_email();

-- ═══ 3. Índice para procesar la cola ═══
CREATE INDEX IF NOT EXISTS idx_email_logs_queued
  ON email_logs(sent_at)
  WHERE status = 'queued';

COMMENT ON FUNCTION auto_issue_and_queue_email IS
  'Emite automáticamente claim_actions cuyo action_template tiene auto_complete=true. Si auto_email=true, encola el envío en email_logs con status=queued para procesamiento asíncrono.';
