-- ═══════════════════════════════════════════════════════════════
-- Migration 278: Función can_delete_user + RPC de eliminación suave
--
-- - can_delete_user(p_profile_id): retorna true si el usuario no tiene
--   ningún registro asociado en claims, claim_actions, inspection_*,
--   audit_logs, user_secondary_roles.
-- - soft_delete_user(p_profile_id): marca deleted_at + is_active=false.
--   No borra filas. Banea en auth.users vía admin API (desde la app).
-- - reactivate_user(p_profile_id): revierte la eliminación suave.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.can_delete_user(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = 'off'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM claims c
    WHERE c.assigned_adjuster_id = p_profile_id
       OR c.inspector_id = p_profile_id
       OR c.adjuster_id = p_profile_id
       OR c.auditor_id = p_profile_id
       OR c.dispatcher_id = p_profile_id
       OR c.assistant_id = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM claim_actions ca
    WHERE ca.issuer_id = p_profile_id
       OR ca.reviewer_id = p_profile_id
       OR ca.approver_id = p_profile_id
       OR ca.dispatcher_id = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM inspection_sessions ins
    WHERE ins.inspector_id = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM inspection_chat_messages icm
    WHERE icm.sender_id = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM inspection_notes ins2
    WHERE ins2.author_id = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM inspection_signatures ins3
    WHERE ins3.signer_id = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM inspection_reports ir
    WHERE ir.generated_by = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM audit_logs al
    WHERE al.performed_by = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_secondary_roles usr
    WHERE usr.profile_id = p_profile_id
  );
$function$;

COMMENT ON FUNCTION public.can_delete_user(uuid) IS 'Retorna true si el usuario no tiene registros asociados y puede eliminarse (suave).';

-- Eliminación suave: marca deleted_at + is_active = false
CREATE OR REPLACE FUNCTION public.soft_delete_user(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = 'off'
AS $function$
BEGIN
  UPDATE profiles
  SET deleted_at = now(),
      is_active = false,
      updated_at = now()
  WHERE id = p_profile_id
    AND deleted_at IS NULL;
END;
$function$;

COMMENT ON FUNCTION public.soft_delete_user(uuid) IS 'Marcado suave de eliminación. No borra filas. El ban de auth.users se hace desde la app vía admin API.';

-- Reactivación: revierte deleted_at + is_active = true
CREATE OR REPLACE FUNCTION public.reactivate_user(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = 'off'
AS $function$
BEGIN
  UPDATE profiles
  SET deleted_at = NULL,
      is_active = true,
      updated_at = now()
  WHERE id = p_profile_id
    AND deleted_at IS NOT NULL;
END;
$function$;

COMMENT ON FUNCTION public.reactivate_user(uuid) IS 'Reactiva un usuario eliminado suavemente o desactivado.';
