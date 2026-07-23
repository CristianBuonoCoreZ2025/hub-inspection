-- ============================================================
-- Migración 205: Trigger sync_user_clients_on_profile_company_change
-- ============================================================
-- Mantiene user_clients sincronizado con profiles.company_id.
--
-- Cuando se crea o actualiza un profile con company_id, asegura que
-- exista la fila correspondiente en user_clients (INSERT ON CONFLICT).
--
-- No elimina filas antiguas: user_clients es many-to-many y el usuario
-- puede seguir asociado a otras empresas además de la principal.
-- ============================================================

-- Función: sincronizar user_clients cuando profiles.company_id cambia
CREATE OR REPLACE FUNCTION sync_user_clients_on_profile_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo actuar si company_id está seteado (no NULL)
  IF NEW.company_id IS NOT NULL THEN
    -- Insertar si no existe (ON CONFLICT evita duplicados)
    INSERT INTO user_clients (user_id, company_id)
    VALUES (NEW.user_id, NEW.company_id)
    ON CONFLICT (user_id, company_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger AFTER INSERT en profiles
DROP TRIGGER IF EXISTS trg_sync_uc_on_profile_insert ON profiles;
CREATE TRIGGER trg_sync_uc_on_profile_insert
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_clients_on_profile_change();

-- Trigger AFTER UPDATE de company_id en profiles
DROP TRIGGER IF EXISTS trg_sync_uc_on_profile_update ON profiles;
CREATE TRIGGER trg_sync_uc_on_profile_update
  AFTER UPDATE OF company_id ON profiles
  FOR EACH ROW
  WHEN (OLD.company_id IS DISTINCT FROM NEW.company_id)
  EXECUTE FUNCTION sync_user_clients_on_profile_change();
