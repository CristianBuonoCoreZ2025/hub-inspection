-- ═══════════════════════════════════════════════════════════════
-- Migración 347: Poblar inspection_number con el code del claim_action
-- ═══════════════════════════════════════════════════════════════
-- Objetivo: Guardar el código de la inspección (ej: L-000000141-HINS-003)
-- directamente en inspection_sessions.inspection_number para no tener
-- que hacer join con claim_actions cada vez.
--
-- NO se borran datos. Solo se hace UPDATE de inspection_number
-- donde está vacío y hay claim_action_id con code.
-- ═══════════════════════════════════════════════════════════════

-- 1. Poblar inspection_number desde claim_actions.code
UPDATE inspection_sessions s
  SET inspection_number = ca.code
  FROM claim_actions ca
  WHERE s.claim_action_id = ca.id
    AND ca.code IS NOT NULL
    AND (s.inspection_number IS NULL OR s.inspection_number = '');

-- 2. Verificación
-- SELECT id, inspection_number, claim_action_id
-- FROM inspection_sessions
-- WHERE inspection_number IS NOT NULL
-- ORDER BY inspection_number DESC
-- LIMIT 10;
