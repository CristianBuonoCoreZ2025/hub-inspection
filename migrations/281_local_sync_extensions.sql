-- Migración 281: Sincronizar extensiones y funciones de Supabase cloud en local
-- pg_net: HTTP client para PostgreSQL (usado por Supabase)
-- citext: tipo de texto case-insensitive (usado por Supabase auth)
-- fix_auth_user_nulls: trigger function de mantenimiento de auth
-- fix_identities_email: function de mantenimiento de auth

-- 1. Crear extensión pg_net (HTTP client)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Crear extensión citext (case-insensitive text)
CREATE EXTENSION IF NOT EXISTS citext;

-- 3. Función fix_auth_user_nulls (trigger de auth de Supabase)
CREATE OR REPLACE FUNCTION public.fix_auth_user_nulls()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
  BEGIN
    IF NEW.confirmation_token IS NULL THEN
      NEW.confirmation_token := '';
    END IF;
    IF NEW.email_change IS NULL THEN
      NEW.email_change := '';
    END IF;
    IF NEW.email_change_token_new IS NULL THEN
      NEW.email_change_token_new := '';
    END IF;
    IF NEW.recovery_token IS NULL THEN
      NEW.recovery_token := '';
    END IF;
    RETURN NEW;
  END;
$function$;

-- 4. Función fix_identities_email (mantenimiento de auth de Supabase)
CREATE OR REPLACE FUNCTION public.fix_identities_email()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
    BEGIN
      EXECUTE 'ALTER TABLE auth.identities ALTER COLUMN email DROP EXPRESSION';
    END;
$function$;
