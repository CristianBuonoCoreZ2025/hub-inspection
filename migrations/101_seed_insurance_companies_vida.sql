-- ============================================================
-- Hub Inspections — Migracion 101: Companias de Seguros de Vida
-- Listado oficial de la Superintendencia de Valores y Seguros (SVS)
-- Companias de Seguros de Vida vigentes en Chile.
--
-- Estrategia (respeta REGLA #1 — NUNCA borrar datos):
--   1. INSERT de las 34 companias oficiales con type='Vida'
--   2. ON CONFLICT(rut) → solo actualiza nombre y reactiva
--      (NO toca type, para no sobrescribir entradas ya clasificadas)
--
-- Caso especial: MUTUALIDAD DE CARABINEROS (99024000-0) aparece en
-- ambos listados (Generales y Vida). Ya existe con type='Generales'
-- desde la migracion 100. Se mantiene intacta — el ON CONFLICT solo
-- refresca name/is_active/updated_at.
-- ============================================================

INSERT INTO insurance_companies (name, rut, type, country_id, is_active)
SELECT o.name, o.rut, 'Vida', (SELECT id FROM countries WHERE code = 'CL' LIMIT 1), true
FROM (VALUES
  ('76418751-2', '4 LIFE SEGUROS DE VIDA S.A.'),
  ('76511423-3', 'ALEMANA SEGUROS S.A.'),
  ('76632384-7', 'AUGUSTAR SEGUROS DE VIDA S.A.'),
  ('96573600-K', 'BCI SEGUROS VIDA S.A.'),
  ('96656410-5', 'BICE VIDA COMPAÑIA DE SEGUROS S.A.'),
  ('96837630-6', 'BNP PARIBAS CARDIF SEGUROS DE VIDA S.A.'),
  ('76282191-5', 'BUPA COMPAÑIA DE SEGUROS DE VIDA S.A.'),
  ('76477116-8', 'CF SEGUROS DE VIDA S.A.'),
  ('99588060-1', 'CHUBB SEGUROS DE VIDA CHILE S.A.'),
  ('96579280-5', 'CN LIFE, COMPAÑIA DE SEGUROS DE VIDA S.A.'),
  ('76408757-7', 'COLMENA COMPAÑIA DE SEGUROS DE VIDA S.A.'),
  ('96571890-7', 'COMPAÑIA DE SEGUROS CONFUTURO S.A.'),
  ('99003000-6', 'COMPAÑIA DE SEGUROS DE VIDA CAMARA S.A.'),
  ('99012000-5', 'COMPAÑIA DE SEGUROS DE VIDA CONSORCIO NACIONAL DE SEGUROS S.A.'),
  ('76650151-6', 'COMPAÑIA DE SEGUROS DE VIDA PRINCIPAL S.A.'),
  ('77205281-2', 'DIVINA PASTORA SEGUROS DE VIDA S.A.'),
  ('99279000-8', 'EUROAMERICA SEGUROS DE VIDA S.A.'),
  ('76213329-6', 'HELP SEGUROS DE VIDA S.A.'),
  ('96933030-K', 'MAPFRE COMPAÑIA DE SEGUROS DE VIDA DE CHILE S.A.'),
  ('99289000-2', 'METLIFE CHILE SEGUROS DE VIDA S.A.'),
  ('70015730-K', 'MUTUAL DE SEGUROS DE CHILE'),
  ('99024000-0', 'MUTUALIDAD DE CARABINEROS'),
  ('99025000-6', 'MUTUALIDAD DEL EJERCITO Y AVIACION'),
  ('96812960-0', 'PENTA VIDA COMPAÑIA DE SEGUROS DE VIDA S.A.'),
  ('96588080-1', 'PRINCIPAL COMPAÑIA DE SEGUROS DE VIDA CHILE S.A.'),
  ('78340993-3', 'PRINCIPAL SEGUROS DE VIDA S.A.'),
  ('94716000-1', 'RENTA NACIONAL COMPAÑIA DE SEGUROS DE VIDA S.A.'),
  ('76034737-K', 'SAVE COMPAÑÍA DE SEGUROS DE VIDA S.A.'),
  ('76573480-0', 'SEGUROS CLC S.A.'),
  ('96549050-7', 'SEGUROS DE VIDA SURA S.A.'),
  ('76263414-7', 'SEGUROS DE VIDA SURAMERICANA S.A.'),
  ('76632553-K', 'SEGUROS DE VIDA Y SALUD UC CHRISTUS S.A.'),
  ('99185000-7', 'ZURICH CHILE SEGUROS DE VIDA S.A.'),
  ('96819630-8', 'ZURICH SANTANDER SEGUROS DE VIDA CHILE S.A.')
) AS o(rut, name)
ON CONFLICT (rut) WHERE rut IS NOT NULL AND rut <> '' DO UPDATE
  SET name = EXCLUDED.name,
      is_active = true,
      updated_at = NOW();
