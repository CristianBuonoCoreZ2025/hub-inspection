-- ============================================================
-- Migración 204: Backfill user_clients desde profiles.company_id
-- ============================================================
-- PROBLEMA: Hay 32 perfiles con company_id que NO tienen su fila
-- correspondiente en user_clients. Esto causa que:
--   - El modal "usuarios autorizados" de empresas muestre 1 en vez de 33
--   - El filtro de inspectores/adjusters por empresa en claims muestre 1
--   - La lista de usuarios muestre "clientes" vacíos para la mayoría
--
-- CAUSA: Al invitar un usuario, profiles.company_id se setea directamente,
-- pero user_clients solo se popula si se pasan clientIds explícitamente.
--
-- FIX: Insertar las filas faltantes en user_clients para cada profile
-- que tenga company_id y no tenga su fila correspondiente.
-- ============================================================

INSERT INTO user_clients (user_id, company_id)
SELECT p.user_id, p.company_id
FROM profiles p
WHERE p.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_clients uc
    WHERE uc.user_id = p.user_id AND uc.company_id = p.company_id
  )
ON CONFLICT (user_id, company_id) DO NOTHING;
