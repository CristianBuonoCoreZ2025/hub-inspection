-- ═══════════════════════════════════════════════════════════════
-- Migration 339: Fix handle_new_user() — cast explicito v_role::user_role
--
-- Problema: La funcion declara v_role TEXT pero lo inserta en
--           profiles.role que es tipo user_role (enum).
--           PostgreSQL no auto-castea TEXT a enum en INSERT dentro
--           de funciones PL/pgSQL, causando error 42804:
--           "column "role" is of type user_role but expression is of type text"
--           Esto rompe TODA creacion de usuarios (invite, signup, admin).
--
-- Solucion: Agregar cast explicito v_role::user_role en el INSERT.
--           No se borran datos. Solo se corrige la funcion del trigger.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_role TEXT;
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  v_company_id := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::UUID;
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'adjuster');
  v_full_name := NEW.raw_user_meta_data->>'full_name';

  -- first_name: metadata explicita, o derivado de full_name
  v_first_name := NULLIF(NEW.raw_user_meta_data->>'first_name', '');
  IF v_first_name IS NULL AND v_full_name IS NOT NULL AND v_full_name <> '' THEN
    v_first_name := split_part(v_full_name, ' ', 1);
  END IF;

  -- last_name: metadata explicita, o derivado de full_name (resto)
  v_last_name := NULLIF(NEW.raw_user_meta_data->>'last_name', '');
  IF v_last_name IS NULL AND v_full_name IS NOT NULL AND v_full_name <> '' THEN
    v_last_name := NULLIF(
                     trim(substring(v_full_name from strpos(v_full_name, ' ') + 1)),
                     ''
                   );
  END IF;

  INSERT INTO public.profiles (
    user_id, email, full_name, first_name, last_name, role, company_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_first_name,
    v_last_name,
    v_role::user_role,
    v_company_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    -- Solo sobreescribir first_name/last_name si vienen nuevos;
    -- si no traen valor, conservar lo que ya tenia el perfil.
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name  = COALESCE(EXCLUDED.last_name,  profiles.last_name),
    role = EXCLUDED.role,
    company_id = EXCLUDED.company_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar que el trigger sigue activo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
