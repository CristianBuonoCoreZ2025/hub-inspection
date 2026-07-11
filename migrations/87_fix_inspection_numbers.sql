-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 87: Fix inspection_numbers — reconstruir desde claim
--
-- La migración 86 extrajo incorrectamente el número del inspection_number.
-- Reconstruimos desde el liquidation_number actual del claim + correlativo.
-- ═══════════════════════════════════════════════════════════════

-- Reconstruir inspection_number desde el claim + correlativo por created_at
DO $$
DECLARE
  r RECORD;
  v_liquidation text;
  v_seq int;
  v_new_seq text;
BEGIN
  FOR r IN
    SELECT id, claim_id FROM inspection_sessions
    ORDER BY created_at ASC
  LOOP
    SELECT liquidation_number INTO v_liquidation
    FROM claims WHERE id = r.claim_id;

    IF v_liquidation IS NULL THEN
      v_liquidation := 'UNKNOWN';
    END IF;

    -- Contar inspecciones previas para este claim
    SELECT count(*) INTO v_seq
    FROM inspection_sessions
    WHERE claim_id = r.claim_id AND created_at < (SELECT created_at FROM inspection_sessions WHERE id = r.id);

    v_new_seq := LPAD((v_seq + 1)::text, 3, '0');

    UPDATE inspection_sessions
    SET inspection_number = v_liquidation || '-I-' || v_new_seq
    WHERE id = r.id;

  END LOOP;
END$$;
