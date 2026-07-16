-- ============================================================
-- Hub Inspections — Migracion 147: Fix audit trigger para Supabase
--
-- PROBLEMA: get_current_user_id() lee current_setting('hasura.user')
-- que es una variable de Hasura. Con Supabase NUNCA existe, por lo
-- que performed_by siempre es NULL y el log muestra "Sistema".
--
-- SOLUCION:
-- 1. get_current_user_id() ahora usa auth.uid() (Supabase) primero,
--    luego intenta Hasura como fallback.
-- 2. Agregar columna updated_by a claims para que el frontend pueda
--    pasar explicitamente quien modifica (fallback para service role).
-- 3. audit_trigger_func() usa COALESCE(auth.uid(), NEW.updated_by,
--    OLD.updated_by, get_current_user_id()).
-- ============================================================

-- ── 1. Fix get_current_user_id ──
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
DECLARE
  v_user_id TEXT;
  v_setting TEXT;
  v_hasura_user JSONB;
BEGIN
  -- Metodo 1: Supabase auth.uid()
  BEGIN
    v_user_id := auth.uid()::TEXT;
    IF v_user_id IS NOT NULL AND v_user_id != '' THEN
      RETURN v_user_id::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- auth.uid() no disponible, continuar
  END;

  -- Metodo 2: Hasura (fallback para compatibilidad)
  v_setting := current_setting('hasura.user', true);
  IF v_setting IS NOT NULL AND v_setting != '' THEN
    BEGIN
      v_hasura_user := v_setting::jsonb;
      v_user_id := v_hasura_user->>'x-hasura-user-id';
      IF v_user_id IS NOT NULL AND v_user_id != '' THEN
        RETURN v_user_id::UUID;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Agregar updated_by a claims ──
ALTER TABLE claims ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
COMMENT ON COLUMN claims.updated_by IS 'Usuario que realizo la ultima modificacion (para auditoria)';

-- ── 3. Fix audit_trigger_func ──
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_user_exists BOOLEAN;
BEGIN
  -- Intentar auth.uid() (Supabase) primero
  v_user_id := get_current_user_id();

  -- Si no hay user_id de sesion, usar updated_by del registro
  IF v_user_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      v_user_id := OLD.updated_by;
    ELSE
      v_user_id := NEW.updated_by;
    END IF;
  END IF;

  -- Validar que el usuario exista en profiles
  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = v_user_id) INTO v_user_exists;
    IF NOT v_user_exists THEN
      v_user_id := NULL;
    END IF;
  END IF;

  -- Resolver company_id
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
