-- Migration 333: Búsqueda insensible a acentos en siniestros
-- Habilita la extensión unaccent y expone una función RPC para buscar claims
-- sin distinguir tildes/mayúsculas.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION search_claims_unaccent(p_q text)
RETURNS TABLE(claim_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
AS $$
  SELECT DISTINCT c.id AS claim_id
  FROM claims c
  LEFT JOIN claims_participants p ON p.claim_id = c.id
  WHERE
    p_q IS NOT NULL
    AND p_q <> ''
    AND (
      unaccent(c.claim_number) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(c.client_reference) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(c.liquidation_number) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(c.company_report_number) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(c.claim_address) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.full_name) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.first_name) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.last_name) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.rut) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.address) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.city) ILIKE unaccent('%' || p_q || '%')
      OR unaccent(p.commune) ILIKE unaccent('%' || p_q || '%')
      OR c.city_id IN (SELECT id FROM cities WHERE unaccent(name) ILIKE unaccent('%' || p_q || '%'))
      OR c.commune_id IN (SELECT id FROM communes WHERE unaccent(name) ILIKE unaccent('%' || p_q || '%'))
    )
$$;
