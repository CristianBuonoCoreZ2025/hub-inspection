-- ============================================================
-- Hub Inspections — Migracion 14: Audit Log Triggers
-- ============================================================
-- Nota: La funcion audit_trigger_func usa SECURITY DEFINER
-- porque es una funcion de sistema controlada que solo escribe
-- en audit_logs. No expone datos ni permite bypass de RLS
-- en tablas de negocio.
-- ============================================================

-- Helper: extraer user_id de la sesion Hasura actual
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
DECLARE
  v_setting TEXT;
  v_hasura_user JSONB;
  v_user_id TEXT;
BEGIN
  v_setting := current_setting('hasura.user', true);
  IF v_setting IS NULL OR v_setting = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    v_hasura_user := v_setting::jsonb;
    v_user_id := v_hasura_user->>'x-hasura-user-id';
    IF v_user_id IS NOT NULL AND v_user_id != '' THEN
      RETURN v_user_id::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Main audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
BEGIN
  v_user_id := get_current_user_id();

  IF TG_TABLE_NAME = 'claims' THEN
    IF TG_OP = 'DELETE' THEN
      v_company_id := OLD.company_id;
    ELSE
      v_company_id := NEW.company_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'inspection_sessions' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT company_id INTO v_company_id FROM claims WHERE id = OLD.claim_id;
    ELSE
      SELECT company_id INTO v_company_id FROM claims WHERE id = NEW.claim_id;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (table_name, record_id, action, new_data, performed_by, company_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), v_user_id, v_company_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, performed_by, company_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_user_id, v_company_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, performed_by, company_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), v_user_id, v_company_id);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
DROP TRIGGER IF EXISTS claims_audit_trigger ON claims;
CREATE TRIGGER claims_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON claims
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS inspection_sessions_audit_trigger ON inspection_sessions;
CREATE TRIGGER inspection_sessions_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON inspection_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Index for faster record lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_id, table_name);
