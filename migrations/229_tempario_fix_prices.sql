-- ═══════════════════════════════════════════════════════════════
-- 229: Fix seed de precios del tempario
--
-- El seed de la migración 228 falló porque el CASE v_region.code usaba
-- códigos '01'..'16' asumiendo el orden de la migración 15 (Arica=01,
-- Tarapacá=02, ... Magallanes=16), pero la BD tiene los códigos reales
-- '01'..'15' con nombres "I Región".."XV Región" + "Región Metropolitana".
--
-- Mapeo correcto (code BD → nombre geográfico → factor zonal):
--   01 = Arica y Parinacota (XV)   → 1.20
--   02 = Tarapacá (I)              → 1.20
--   03 = Antofagasta (II)          → 1.25
--   04 = Atacama (III)             → 1.18
--   05 = Coquimbo (IV)             → 1.05
--   06 = Valparaíso (V)            → 1.00  (verificado DS27 2026)
--   07 = O'Higgins (VI)            → 1.05
--   08 = Maule (VII)               → 1.05
--   09 = Biobío (VIII)             → 1.08
--   10 = La Araucanía (IX)         → 1.10
--   11 = Los Lagos (X)             → 1.15
--   12 = Aysén (XI)                → 1.35
--   13 = Región Metropolitana (RM) → 1.00  (verificado DS27 2026)
--   14 = Los Ríos (XIV)            → 1.12
--   15 = Magallanes (XII)          → 1.40
--
-- Esta migración:
--   1. Borra TODOS los precios existentes (solo de tempario_prices,
--      NO toca tasks/chapters/subchapters).
--   2. Regenera los precios con el mapeo correcto.
--
-- NOTA: El borrado es SEGURO — tempario_prices es una tabla de precios
-- de catálogo que se regenera desde este seed. No hay datos de usuario
-- ni de siniestros vinculados (el tempario está desacoplado de
-- inspection_damages por diseño).
-- ═══════════════════════════════════════════════════════════════

-- 1. Borrar precios existentes (solo esta tabla, preserva tasks/chapters)
DELETE FROM tempario_prices;

-- 2. Regenerar precios con mapeo correcto
DO $$
DECLARE
  v_uf_value CONSTANT NUMERIC := 40798.57;
  v_eff_date CONSTANT DATE := '2026-07-01'::DATE;
  r RECORD;
  v_region RECORD;
  v_factor NUMERIC;
  v_source TEXT;
  v_price_uf NUMERIC;
  v_price_clp NUMERIC;
BEGIN
  -- Precio base UF por código de partida (Valparaíso = base)
  CREATE TEMP TABLE tmp_base_prices (code TEXT, price_uf NUMERIC) ON COMMIT DROP;
  INSERT INTO tmp_base_prices (code, price_uf) VALUES
    -- A
    ('A 02 01 05 90010', 0.1989),
    ('A 03 01 00 90002', 0.1425),
    ('A 03 03 02 90007', 1.5623),
    ('A 03 03 02 90008', 1.2000),
    ('A 03 03 80 090006',2.0344),
    ('A 03 05 02 90006', 0.0492),
    ('A 80 00 00 90013', 0.2024),
    -- B
    ('B 05 02 06 90000', 0.3673),
    ('B 05 02 06 90001', 0.5234),
    ('B 05 02 07 90000', 0.2850),
    ('B 05 04 01 90000', 0.2185),
    ('B 05 04 02 90000', 0.1640),
    ('B 06 01 01 90000', 1.8900),
    ('B 06 01 02 90000', 1.4500),
    ('B 07 01 01 90000', 0.9800),
    -- C
    ('C 10 01 01 90000', 4.5200),
    ('C 10 01 02 90000', 3.8900),
    ('C 10 02 01 90000', 5.1200),
    ('C 10 03 01 90000', 4.7800),
    ('C 10 03 02 90000', 5.4500),
    ('C 11 01 01 90000', 1.8900),
    ('C 11 01 02 90000', 1.6200),
    ('C 12 01 01 90000', 1.3400),
    ('C 12 01 02 90000', 1.5200),
    ('C 13 01 01 90000', 0.6230),
    ('C 13 01 02 90000', 0.5340),
    ('C 13 01 03 90000', 0.8900),
    ('C 15 01 01 90000', 0.8450),
    ('C 15 01 02 90000', 1.2300),
    -- D
    ('D 21 01 01 90000', 1.8900),
    ('D 21 01 02 90000', 2.3400),
    ('D 21 01 03 90000', 3.1200),
    ('D 21 01 04 90000', 1.4500),
    ('D 21 01 05 90000', 3.8900),
    ('D 21 02 01 90000', 1.6700),
    ('D 21 02 02 90000', 2.1200),
    ('D 22 01 01 90000', 1.3400),
    ('D 22 01 02 90000', 0.9800),
    ('D 23 01 01 90000', 0.2340),
    ('D 23 01 02 90000', 0.3120),
    ('D 23 01 03 90000', 0.4560),
    ('D 24 01 01 90000', 4.5600),
    ('D 24 02 01 90000', 2.3400),
    ('D 24 02 02 90000', 1.5600),
    ('D 25 01 01 90000', 0.6700),
    -- E
    ('E 31 01 01 90000', 3.4500),
    ('E 31 01 02 90000', 0.8900),
    ('E 31 01 03 90000', 2.3400),
    ('E 32 01 01 90000', 0.7800),
    ('E 32 01 02 90000', 1.2300),
    ('E 32 01 03 90000', 0.5600),
    ('E 32 01 04 90000', 1.8900),
    ('E 33 01 01 90000', 1.5600);

  FOR r IN
    SELECT t.id, t.code, b.price_uf
    FROM tempario_tasks t
    JOIN tmp_base_prices b ON b.code = t.code
  LOOP
    FOR v_region IN
      SELECT id, code, name FROM regions
      WHERE country_id = (SELECT id FROM countries WHERE code='CL' LIMIT 1)
        AND is_active = true
    LOOP
      -- Factor zonal por código real de región (mapeo corregido)
      v_factor := CASE v_region.code
        WHEN '01' THEN 1.20  -- Arica y Parinacota
        WHEN '02' THEN 1.20  -- Tarapacá
        WHEN '03' THEN 1.25  -- Antofagasta
        WHEN '04' THEN 1.18  -- Atacama
        WHEN '05' THEN 1.05  -- Coquimbo
        WHEN '06' THEN 1.00  -- Valparaíso (verificado)
        WHEN '07' THEN 1.05  -- O'Higgins
        WHEN '08' THEN 1.05  -- Maule
        WHEN '09' THEN 1.08  -- Biobío
        WHEN '10' THEN 1.10  -- La Araucanía
        WHEN '11' THEN 1.15  -- Los Lagos
        WHEN '12' THEN 1.35  -- Aysén
        WHEN '13' THEN 1.00  -- Región Metropolitana (verificado)
        WHEN '14' THEN 1.12  -- Los Ríos
        WHEN '15' THEN 1.40  -- Magallanes
        ELSE 1.10
      END;

      v_source := CASE
        WHEN v_region.code IN ('06','13') THEN 'MINVU DS27 2026'
        ELSE 'Estimado por FZ SII/CChC'
      END;

      v_price_uf := ROUND(r.price_uf * v_factor, 4);
      v_price_clp := ROUND(r.price_uf * v_factor * v_uf_value, 0);

      INSERT INTO tempario_prices (task_id, region_id, currency_code, price, factor_zonal, effective_date, source)
      VALUES (r.id, v_region.id, 'UF', v_price_uf, v_factor, v_eff_date, v_source)
      ON CONFLICT (task_id, region_id, currency_code, effective_date) DO NOTHING;

      INSERT INTO tempario_prices (task_id, region_id, currency_code, price, factor_zonal, effective_date, source)
      VALUES (r.id, v_region.id, 'CLP', v_price_clp, v_factor, v_eff_date, v_source)
      ON CONFLICT (task_id, region_id, currency_code, effective_date) DO NOTHING;
    END LOOP;
  END LOOP;

  DROP TABLE tmp_base_prices;
END $$;

-- 3. Verificación
-- SELECT COUNT(*) FROM tempario_prices;
-- Esperado: 53 tasks × 15 regiones × 2 monedas = 1590
