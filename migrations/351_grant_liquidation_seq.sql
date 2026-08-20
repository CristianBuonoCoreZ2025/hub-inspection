-- Migración 351: Grant USAGE on claims_liquidation_seq to authenticated/anon
--
-- El trigger trg_claims_liquidation_number llama a nextval('claims_liquidation_seq')
-- al hacer INSERT en claims. Si el rol no tiene USAGE sobre la secuencia,
-- PostgREST devuelve "permission denied for sequence claims_liquidation_seq".
--
-- La migración 05 solo otorgó permisos a rol "user" (Hasura), no a los roles
-- de Supabase (authenticated, anon). Esta migración lo corrige.

GRANT USAGE, SELECT ON SEQUENCE claims_liquidation_seq TO authenticated, anon;
