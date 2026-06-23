-- ============================================================
-- Hub Inspections -- Migracion 48: Corregir audit trigger performed_by
-- El trigger obtiene user_id de la sesión Hasura, pero si el usuario
-- no existe en profiles, la FK falla. Validar antes de asignar.
-- ============================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_user_exists BOOLEAN;
BEGIN
  v_user_id := get_current_user_id();

  -- Validar que el usuario exista en profiles antes de usarlo
  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = v_user_id) INTO v_user_exists;
    IF NOT v_user_exists THEN
      v_user_id := NULL;
    END IF;
  END IF;

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
