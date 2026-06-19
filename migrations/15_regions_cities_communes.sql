-- ============================================================
-- Hub Inspections — Migracion 15: Catalogos Regionales
-- regions → cities → communes (jerarquia geografica)
-- ============================================================

-- ============================================================
-- 1. REGIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE regions IS 'Regiones/Estados/Provincias por pais';

DROP TRIGGER IF EXISTS regions_updated_at ON regions;
CREATE TRIGGER regions_updated_at BEFORE UPDATE ON regions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_regions_country_id ON regions(country_id);

-- ============================================================
-- 2. CITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cities IS 'Ciudades por region';

DROP TRIGGER IF EXISTS cities_updated_at ON cities;
CREATE TRIGGER cities_updated_at BEFORE UPDATE ON cities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_cities_region_id ON cities(region_id);

-- ============================================================
-- 3. COMMUNES
-- ============================================================
CREATE TABLE IF NOT EXISTS communes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE communes IS 'Comunas/Distritos/Barrios por ciudad';

DROP TRIGGER IF EXISTS communes_updated_at ON communes;
CREATE TRIGGER communes_updated_at BEFORE UPDATE ON communes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_communes_city_id ON communes(city_id);

-- ============================================================
-- 4. SEED: Regiones de Chile (15 regiones + RM)
-- ============================================================
DO $$
DECLARE
  v_cl UUID;
BEGIN
  SELECT id INTO v_cl FROM countries WHERE code = 'CL' LIMIT 1;
  IF v_cl IS NULL THEN
    RAISE NOTICE 'Pais Chile no encontrado. Ejecutar migracion 04_countries.sql primero.';
    RETURN;
  END IF;

  INSERT INTO regions (country_id, code, name) VALUES
    (v_cl, '01', 'Arica y Parinacota'),
    (v_cl, '02', 'Tarapaca'),
    (v_cl, '03', 'Antofagasta'),
    (v_cl, '04', 'Atacama'),
    (v_cl, '05', 'Coquimbo'),
    (v_cl, '06', 'Valparaiso'),
    (v_cl, '07', 'Metropolitana de Santiago'),
    (v_cl, '08', 'O''Higgins'),
    (v_cl, '09', 'Maule'),
    (v_cl, '10', 'Nuble'),
    (v_cl, '11', 'Biobio'),
    (v_cl, '12', 'La Araucania'),
    (v_cl, '13', 'Los Rios'),
    (v_cl, '14', 'Los Lagos'),
    (v_cl, '15', 'Aysen'),
    (v_cl, '16', 'Magallanes')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- 5. SEED: Ciudades principales de Chile
-- ============================================================
DO $$
DECLARE
  v_rm UUID;
  v_valpo UUID;
  v_bio UUID;
  v_ara UUID;
  v_ays UUID;
  v_mau UUID;
  v_ohi UUID;
  v_tar UUID;
  v_ant UUID;
  v_ata UUID;
  v_coq UUID;
  v_nub UUID;
  v_ara2 UUID;
  v_los UUID;
  v_mag UUID;
  v_rio UUID;
BEGIN
  SELECT id INTO v_rm FROM regions WHERE name = 'Metropolitana de Santiago' LIMIT 1;
  SELECT id INTO v_valpo FROM regions WHERE name = 'Valparaiso' LIMIT 1;
  SELECT id INTO v_bio FROM regions WHERE name = 'Biobio' LIMIT 1;
  SELECT id INTO v_ara FROM regions WHERE name = 'Arica y Parinacota' LIMIT 1;
  SELECT id INTO v_ays FROM regions WHERE name = 'Aysen' LIMIT 1;
  SELECT id INTO v_mau FROM regions WHERE name = 'Maule' LIMIT 1;
  SELECT id INTO v_ohi FROM regions WHERE name = 'O''Higgins' LIMIT 1;
  SELECT id INTO v_tar FROM regions WHERE name = 'Tarapaca' LIMIT 1;
  SELECT id INTO v_ant FROM regions WHERE name = 'Antofagasta' LIMIT 1;
  SELECT id INTO v_ata FROM regions WHERE name = 'Atacama' LIMIT 1;
  SELECT id INTO v_coq FROM regions WHERE name = 'Coquimbo' LIMIT 1;
  SELECT id INTO v_nub FROM regions WHERE name = 'Nuble' LIMIT 1;
  SELECT id INTO v_ara2 FROM regions WHERE name = 'La Araucania' LIMIT 1;
  SELECT id INTO v_los FROM regions WHERE name = 'Los Lagos' LIMIT 1;
  SELECT id INTO v_mag FROM regions WHERE name = 'Magallanes' LIMIT 1;
  SELECT id INTO v_rio FROM regions WHERE name = 'Los Rios' LIMIT 1;

  IF v_rm IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_rm, 'Santiago'),
      (v_rm, 'Puente Alto'),
      (v_rm, 'Maipu'),
      (v_rm, 'La Florida'),
      (v_rm, 'Las Condes'),
      (v_rm, 'Penalolen'),
      (v_rm, 'Vitacura'),
      (v_rm, 'La Reina'),
      (v_rm, 'Nunoa'),
      (v_rm, 'Providencia')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_valpo IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_valpo, 'Valparaiso'),
      (v_valpo, 'Vina del Mar'),
      (v_valpo, 'Quilpue'),
      (v_valpo, 'Villa Alemana')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_bio IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_bio, 'Concepcion'),
      (v_bio, 'Talcahuano'),
      (v_bio, 'Chiguayante'),
      (v_bio, 'San Pedro de la Paz')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_ara IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_ara, 'Arica'),
      (v_ara, 'Putre')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mau IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_mau, 'Talca'),
      (v_mau, 'Curico')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_ohi IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_ohi, 'Rancagua'),
      (v_ohi, 'Machali')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_tar IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_tar, 'Iquique'),
      (v_tar, 'Alto Hospicio')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_ant IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_ant, 'Antofagasta'),
      (v_ant, 'Calama'),
      (v_ant, 'Tocopilla')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_ata IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_ata, 'Copiapo'),
      (v_ata, 'Vallenar')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_coq IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_coq, 'La Serena'),
      (v_coq, 'Coquimbo'),
      (v_coq, 'Ovalle')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_nub IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_nub, 'Chillan'),
      (v_nub, 'San Carlos')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_ara2 IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_ara2, 'Temuco'),
      (v_ara2, 'Villarrica'),
      (v_ara2, 'Padre Las Casas')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_los IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_los, 'Puerto Montt'),
      (v_los, 'Osorno'),
      (v_los, 'Castro')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_rio IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_rio, 'Valdivia'),
      (v_rio, 'La Union')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_ays IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_ays, 'Coyhaique'),
      (v_ays, 'Puerto Aysen')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mag IS NOT NULL THEN
    INSERT INTO cities (region_id, name) VALUES
      (v_mag, 'Punta Arenas'),
      (v_mag, 'Puerto Natales')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 6. SEED: Comunas principales de Santiago
-- ============================================================
DO $$
DECLARE
  v_santiago UUID;
BEGIN
  SELECT id INTO v_santiago FROM cities WHERE name = 'Santiago' LIMIT 1;

  IF v_santiago IS NOT NULL THEN
    INSERT INTO communes (city_id, name) VALUES
      (v_santiago, 'Cerrillos'),
      (v_santiago, 'Cerro Navia'),
      (v_santiago, 'Conchali'),
      (v_santiago, 'El Bosque'),
      (v_santiago, 'Estacion Central'),
      (v_santiago, 'Huechuraba'),
      (v_santiago, 'Independencia'),
      (v_santiago, 'La Cisterna'),
      (v_santiago, 'La Florida'),
      (v_santiago, 'La Granja'),
      (v_santiago, 'La Pintana'),
      (v_santiago, 'La Reina'),
      (v_santiago, 'Las Condes'),
      (v_santiago, 'Lo Barnechea'),
      (v_santiago, 'Lo Espejo'),
      (v_santiago, 'Lo Prado'),
      (v_santiago, 'Macul'),
      (v_santiago, 'Maipu'),
      (v_santiago, 'Nunoa'),
      (v_santiago, 'Pedro Aguirre Cerda'),
      (v_santiago, 'Penalolen'),
      (v_santiago, 'Providencia'),
      (v_santiago, 'Pudahuel'),
      (v_santiago, 'Quilicura'),
      (v_santiago, 'Quinta Normal'),
      (v_santiago, 'Recoleta'),
      (v_santiago, 'Renca'),
      (v_santiago, 'San Joaquin'),
      (v_santiago, 'San Miguel'),
      (v_santiago, 'San Ramon'),
      (v_santiago, 'Santiago'),
      (v_santiago, 'Vitacura')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
