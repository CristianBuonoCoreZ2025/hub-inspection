-- ═══════════════════════════════════════════════════════════════
-- Migración 100 — Reactivación de magic link para sesión activa
-- ═══════════════════════════════════════════════════════════════
--
-- Cuando una inspección está en curso (status = 'active') pero el magic
-- link ya expiró, el inspector puede reactivarlo y obtener un nuevo
-- token válido por 3 horas desde el momento de la reactivación.
--
-- Comportamiento nuevo de renew_inspection_magic_link:
--   - Antes de la ventana: nuevo token, mismo rango (sin cambios)
--   - Dentro de la ventana: extender una sola vez (sin cambios)
--   - Link activo dentro del rango extendido: retorna 'active' (sin cambios)
--   - Link expirado Y status = 'active': NUEVO token, 3 horas de validez
--     → mensaje 'reactivated'
--   - Link expirado Y status != 'active': retorna 'expired' (sin cambios)
--
-- SIN borrar datos.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION renew_inspection_magic_link(p_session_id uuid)
RETURNS TABLE (token text, expires_at timestamptz, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
DECLARE
  v_session inspection_sessions%ROWTYPE;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_new_token text;
  v_new_expiry timestamptz;
BEGIN
  -- Autorización tenant
  IF NOT EXISTS (
    SELECT 1 FROM inspection_sessions s
    WHERE s.id = p_session_id AND is_session_tenant_allowed(s.id)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_session FROM inspection_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión no encontrada';
  END IF;

  IF v_session.inspection_type <> 'remote' THEN
    RAISE EXCEPTION 'Solo inspecciones remotas tienen magic link';
  END IF;

  IF v_session.scheduled_at IS NULL THEN
    RAISE EXCEPTION 'La inspección no tiene fecha/hora programada';
  END IF;

  IF v_session.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'La sesión está finalizada o cancelada';
  END IF;

  v_window_start := v_session.scheduled_at - interval '1 hour';
  v_window_end := v_session.scheduled_at + interval '1 hour';

  -- Fuera de la ventana (antes del inicio): nuevo token, mismo rango
  IF now() < v_window_start THEN
    v_new_token := replace(gen_random_uuid()::text, '-', '');
    UPDATE inspection_sessions
    SET magic_link_token = v_new_token,
        magic_link_expires_at = v_window_end,
        magic_link_extended = false,
        updated_at = now()
    WHERE id = p_session_id;
    RETURN QUERY SELECT v_new_token, v_window_end, 'new'::text;
    RETURN;
  END IF;

  -- Dentro de la ventana: extender una sola vez
  IF now() >= v_window_start AND now() <= v_window_end THEN
    IF v_session.magic_link_extended = true THEN
      RETURN QUERY SELECT v_session.magic_link_token, v_session.magic_link_expires_at, 'already-extended'::text;
      RETURN;
    END IF;
    UPDATE inspection_sessions
    SET magic_link_expires_at = v_window_end + interval '1 hour',
        magic_link_extended = true,
        updated_at = now()
    WHERE id = p_session_id;
    RETURN QUERY SELECT v_session.magic_link_token, v_window_end + interval '1 hour', 'extended'::text;
    RETURN;
  END IF;

  -- Dentro del rango extendido (ya extendido) o aún vigente
  IF now() <= v_session.magic_link_expires_at THEN
    RETURN QUERY SELECT v_session.magic_link_token, v_session.magic_link_expires_at, 'active'::text;
    RETURN;
  END IF;

  -- ── NUEVO: Link expirado Y sesión activa → reactivar con nuevo token por 3 horas ──
  IF v_session.status = 'active' THEN
    v_new_token := replace(gen_random_uuid()::text, '-', '');
    v_new_expiry := now() + interval '3 hours';
    UPDATE inspection_sessions
    SET magic_link_token = v_new_token,
        magic_link_expires_at = v_new_expiry,
        magic_link_extended = true,
        updated_at = now()
    WHERE id = p_session_id;
    RETURN QUERY SELECT v_new_token, v_new_expiry, 'reactivated'::text;
    RETURN;
  END IF;

  -- Link expirado y sesión no activa
  RETURN QUERY SELECT v_session.magic_link_token, v_session.magic_link_expires_at, 'expired'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION renew_inspection_magic_link(uuid) TO authenticated;

INSERT INTO _migrations (filename) VALUES ('100_reactivate_magic_link_active_session.sql')
ON CONFLICT (filename) DO NOTHING;
