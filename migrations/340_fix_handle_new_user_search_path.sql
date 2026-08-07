-- ═══════════════════════════════════════════════════════════════
-- Migration 340: Fix handle_new_user() — search_path explicito
--
-- Problema: La funcion handle_new_user() es SECURITY DEFINER pero
--           NO tiene search_path configurado. Usa v_role::user_role
--           y el tipo user_role esta en public schema.
--           Cuando GoTrue ejecuta el trigger, su search_path puede
--           no incluir public, causando que el cast falle.
--
-- Sintoma: "Database error creating new user" (500) en toda creacion.
--           GoTrue atrapa el error y devuelve mensaje generico.
--
-- Solucion: Agregar SET search_path=public al inicio de la funcion.
--           Esto es best practice para SECURITY DEFINER functions.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name  = COALESCE(EXCLUDED.last_name,  profiles.last_name),
    role = EXCLUDED.role,
    company_id = EXCLUDED.company_id;
  RETURN NEW;
END;
$$;

-- Verificar que el trigger sigue activo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
