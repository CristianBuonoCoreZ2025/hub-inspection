-- ============================================================
-- Hub Inspections — Migracion 100: Catalogo oficial de companias de seguros
-- Listado oficial de la Superintendencia de Valores y Seguros (SVS)
-- Companias de Seguros Generales vigentes en Chile.
--
-- Estrategia (respeta REGLA #1 — NUNCA borrar datos):
--   1. Crear indice UNIQUE parcial sobre rut (excluye NULL y '')
--   2. Normalizar rut='' a NULL
--   3. UPDATE de entradas existentes que coinciden por nombre (exacto case-insensitive)
--      para asignarles su RUT oficial y nombre formal
--   4. INSERT de las 25 companias oficiales con ON CONFLICT(rut) DO UPDATE
--      — las que ya tienen RUT (por step 3) se actualizan; las nuevas se insertan
--
-- Las entradas existentes que no aparecen en el listado oficial (ej: Colmena,
-- Confuturo, Cruz del Sur, etc.) NO se borran ni se desactivan — se conservan
-- intactas para no romper referencias historicas en claims.
-- ============================================================

-- 1. Indice UNIQUE parcial sobre rut
CREATE UNIQUE INDEX IF NOT EXISTS insurance_companies_rut_uniq
  ON insurance_companies (rut)
  WHERE rut IS NOT NULL AND rut <> '';

-- 2. Normalizar rut='' a NULL
UPDATE insurance_companies SET rut = NULL WHERE rut = '';

-- 3. UPDATE por match exacto de nombre (case-insensitive)
--    Mapeo: nombre_existente → (rut_oficial, nombre_oficial)
WITH matches AS (
  SELECT ic.id, o.rut, o.name
  FROM insurance_companies ic
  JOIN (VALUES
    -- Nombres ya oficiales (solo falta RUT)
    ('BCI SEGUROS GENERALES S.A.',                                              '99147000-K', 'BCI SEGUROS GENERALES S.A.'),
    ('BNP PARIBAS CARDIF SEGUROS GENERALES S.A.',                               '96837640-3', 'BNP PARIBAS CARDIF SEGUROS GENERALES S.A.'),
    ('COMPAÑIA DE SEGUROS GENERALES CONSORCIO NACIONAL DE SEGUROS S.A.',        '96654180-6', 'COMPAÑIA DE SEGUROS GENERALES CONSORCIO NACIONAL DE SEGUROS S.A.'),
    ('FID CHILE SEGUROS GENERALES S.A.',                                        '77096952-2', 'FID CHILE SEGUROS GENERALES S.A.'),
    ('HDI SEGUROS S.A.',                                                        '99061000-2', 'HDI SEGUROS S.A.'),
    ('LIBERTY MUTUAL SURETY SEGUROS CHILE S.A.',                                '78027718-1', 'LIBERTY MUTUAL SURETY SEGUROS CHILE S.A.'),
    ('Seguros Generales Suramericana S.A',                                      '99017000-2', 'SEGUROS GENERALES SURAMERICANA S.A.'),
    -- Nombres cortos legacy → oficiales
    ('ACE Seguros',                                                             '99225000-3', 'CHUBB SEGUROS CHILE S.A.'),
    ('Mapfre Seguros',                                                          '96508210-7', 'MAPFRE COMPAÑIA DE SEGUROS GENERALES DE CHILE S.A.'),
    ('MetLife',                                                                 '76328793-9', 'METLIFE CHILE SEGUROS GENERALES S.A.'),
    ('Reale Seguros',                                                           '76743492-8', 'REALE CHILE SEGUROS GENERALES S.A.'),
    ('Renta Nacional',                                                          '94510000-1', 'RENTA NACIONAL COMPAÑIA DE SEGUROS GENERALES S.A.'),
    ('Unnio Seguros',                                                           '76173258-7', 'UNNIO SEGUROS GENERALES S.A.'),
    ('Zurich Santander',                                                        '76590840-K', 'ZURICH SANTANDER SEGUROS GENERALES CHILE S.A.')
  ) AS o(existing_name, rut, name)
  ON lower(ic.name) = lower(o.existing_name)
)
UPDATE insurance_companies ic
SET rut = m.rut,
    name = m.name,
    is_active = true,
    updated_at = NOW()
FROM matches m
WHERE ic.id = m.id;

-- 4. INSERT de las 25 companias oficiales (listado SVS — Seguros Generales vigentes)
--    ON CONFLICT(rut) → si el RUT ya existe (por step 3), actualiza nombre y reactiva
INSERT INTO insurance_companies (name, rut, type, country_id, is_active)
SELECT o.name, o.rut, 'Generales', (SELECT id FROM countries WHERE code = 'CL' LIMIT 1), true
FROM (VALUES
  ('76598625-7', 'ASEGURADORA PORVENIR S.A.'),
  ('76212519-6', 'ASSURANT CHILE COMPAÑIA DE SEGUROS GENERALES S.A.'),
  ('99147000-K', 'BCI SEGUROS GENERALES S.A.'),
  ('96837640-3', 'BNP PARIBAS CARDIF SEGUROS GENERALES S.A.'),
  ('99225000-3', 'CHUBB SEGUROS CHILE S.A.'),
  ('96654180-6', 'COMPAÑIA DE SEGUROS GENERALES CONSORCIO NACIONAL DE SEGUROS S.A.'),
  ('76039758-K', 'COMPAÑIA DE SEGUROS GENERALES CONTINENTAL S.A.'),
  ('76981875-8', 'CONTEMPORA COMPAÑIA DE SEGUROS GENERALES S.A.'),
  ('77591207-3', 'EVEREST COMPAÑIA DE SEGUROS GENERALES CHILE S.A.'),
  ('77096952-2', 'FID CHILE SEGUROS GENERALES S.A.'),
  ('99061000-2', 'HDI SEGUROS S.A.'),
  ('78027718-1', 'LIBERTY MUTUAL SURETY SEGUROS CHILE S.A.'),
  ('96508210-7', 'MAPFRE COMPAÑIA DE SEGUROS GENERALES DE CHILE S.A.'),
  ('76328793-9', 'METLIFE CHILE SEGUROS GENERALES S.A.'),
  ('99024000-0', 'MUTUALIDAD DE CARABINEROS'),
  ('76042965-1', 'ORION SEGUROS GENERALES S.A.'),
  ('76743492-8', 'REALE CHILE SEGUROS GENERALES S.A.'),
  ('94510000-1', 'RENTA NACIONAL COMPAÑIA DE SEGUROS GENERALES S.A.'),
  ('99017000-2', 'SEGUROS GENERALES SURAMERICANA S.A.'),
  ('99288000-7', 'SOUTHBRIDGE COMPAÑIA DE SEGUROS GENERALES S.A.'),
  ('76620932-7', 'STARR INTERNATIONAL SEGUROS GENERALES S.A.'),
  ('76173258-7', 'UNNIO SEGUROS GENERALES S.A.'),
  ('76061223-5', 'ZENIT SEGUROS GENERALES S.A.'),
  ('99037000-1', 'ZURICH CHILE SEGUROS GENERALES S.A.'),
  ('76590840-K', 'ZURICH SANTANDER SEGUROS GENERALES CHILE S.A.')
) AS o(rut, name)
ON CONFLICT (rut) WHERE rut IS NOT NULL AND rut <> '' DO UPDATE
  SET name = EXCLUDED.name,
      type = 'Generales',
      is_active = true,
      updated_at = NOW();
