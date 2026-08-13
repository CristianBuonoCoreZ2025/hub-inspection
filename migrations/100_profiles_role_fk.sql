-- Migración 100: Agregar FK entre profiles.role y user_type_data_access.user_type
-- Esto permite que PostgREST haga joins entre profiles y user_type_data_access
-- sin retornar error 400.
--
-- La tabla user_type_data_access tiene user_type como PRIMARY KEY (enum user_role).
-- La tabla profiles tiene role como columna (enum user_role).
-- Al agregar esta FK, PostgREST puede resolver la relación:
--   profiles.role → user_type_data_access.user_type

-- Verificar si la FK ya existe antes de crearla
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_user_type_data_access_fkey'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_role_user_type_data_access_fkey
    FOREIGN KEY (role) REFERENCES user_type_data_access(user_type)
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
