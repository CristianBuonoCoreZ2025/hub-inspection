-- ═══════════════════════════════════════════════════════════════
-- Migration 338: Fix handle_new_user() — NEW.metadata → NEW.raw_user_meta_data
--
-- Problema: Las migraciones 274 y _PROD_250_278_consolidated cambiaron
--           handle_new_user() para usar NEW.metadata, pero la columna
--           real en auth.users se llama raw_user_meta_data.
--           Esto causa "Database error creating new user" (500)
--           cada vez que se intenta crear un usuario via admin API.
--
-- Solución: Recrear la función usando NEW.raw_user_meta_data.
--           No se borran datos. Solo se corrige la función del trigger.
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

  -- first_name: metadata explícita, o derivado de full_name
  v_first_name := NULLIF(NEW.raw_user_meta_data->>'first_name', '');
  IF v_first_name IS NULL AND v_full_name IS NOT NULL AND v_full_name <> '' THEN
    v_first_name := split_part(v_full_name, ' ', 1);
  END IF;

  -- last_name: metadata explícita, o derivado de full_name (resto)
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
    v_role,
    v_company_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    -- Solo sobreescribir first_name/last_name si vienen nuevos;
    -- si no traen valor, conservar lo que ya tenía el perfil.
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
