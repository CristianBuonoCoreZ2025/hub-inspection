-- ═══════════════════════════════════════════════════════════════
-- Migration 274: Backfill de first_name / last_name desde full_name
--
-- Problema: La migración 123 añadió las columnas first_name y last_name
--           a profiles, pero el trigger handle_new_user() solo setea
--           full_name. Los registros existentes (y los nuevos hasta
--           ahora) quedaron con first_name = NULL y last_name = NULL.
--
-- Solución:
--   1. Backfill de registros existentes: splitear full_name solo cuando
--      first_name y last_name estén AMBOS vacíos (NULL o '').
--      Regla: 1ª palabra = first_name, resto = last_name (mismo patrón
--      que la migración 34 para contacts).
--   2. Actualizar handle_new_user() para que los usuarios nuevos también
--      deriven first_name / last_name desde metadata (si vienen) o, en
--      su defecto, desde full_name con el mismo split.
--
-- REGLA #1 del proyecto: NO se borran datos. Solo se hace UPDATE sobre
-- filas donde first_name IS NULL/'' AND last_name IS NULL/''. Si un
-- usuario ya cargó manualmente su nombre/apellido, no se toca.
-- ═══════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------
-- 1. Backfill de registros existentes
--    Solo se actualizan filas donde AMBOS campos están vacíos.
--    Si solo uno está vacío, se respeta el otro (no se sobreescribe).
-- ---------------------------------------------------------------
UPDATE profiles
SET first_name = split_part(full_name, ' ', 1),
    last_name  = NULLIF(
                   trim(substring(full_name from strpos(full_name, ' ') + 1)),
                   ''
                 ),
    updated_at = now()
WHERE full_name IS NOT NULL
  AND full_name <> ''
  AND COALESCE(first_name, '') = ''
  AND COALESCE(last_name, '') = '';

-- ---------------------------------------------------------------
-- 2. Actualizar handle_new_user() para que los usuarios nuevos
--    también traigan first_name / last_name.
--    Prioridad:
--      a) Si metadata trae first_name / last_name explícitos, usarlos.
--      b) Si no, derivarlos de full_name con el mismo split.
--      c) Si no hay full_name, dejar NULL.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_role TEXT;
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  v_company_id := NULLIF(NEW.metadata->>'company_id', '')::UUID;
  v_role := COALESCE(NEW.metadata->>'role', 'adjuster');
  v_full_name := NEW.metadata->>'full_name';

  -- first_name: metadata explícita, o derivado de full_name
  v_first_name := NULLIF(NEW.metadata->>'first_name', '');
  IF v_first_name IS NULL AND v_full_name IS NOT NULL AND v_full_name <> '' THEN
    v_first_name := split_part(v_full_name, ' ', 1);
  END IF;

  -- last_name: metadata explícita, o derivado de full_name (resto)
  v_last_name := NULLIF(NEW.metadata->>'last_name', '');
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
