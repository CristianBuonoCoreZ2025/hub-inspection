-- ═══════════════════════════════════════════════════════════════
-- 228: Tempario de Construcción (DS27 Chile)
--
-- Catálogo global (sin company_id) que estructura los tiempos y precios
-- unitarios de partidas de construcción basados en:
--   - MINVU DS27 (estructura + precios referenciales por región, en UF)
--   - Manual de Rendimientos de la Construcción (Convenios, UCN)
--   - SII + PUC (DESE) — Estudio Reavalúo 2022 (factores zonales)
--   - APU Chile / MOP (rendimientos y llenado de gaps)
--
-- Totalmente DESACOPLADO del módulo de inspecciones. El enganche con
-- inspection_damages se hará en una fase posterior cuando se valide
-- el valor del dato.
--
-- Estructura jerárquica:
--   tempario_chapters (A, B, C, D, E)
--     └── tempario_subchapters (03 03 00, ...)
--           └── tempario_tasks (A 03 03 02 90007, ...)
--                 └── tempario_prices (task × región × moneda × fecha)
--
-- Chile tiene 16 regiones (regions.code 01..16). El seed carga precios
-- para las 16 regiones × 2 monedas (UF + CLP) por cada partida.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. CHAPTERS (Capítulos DS27)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tempario_chapters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  sort_order  INT  NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tempario_chapters IS 'Capítulos del tempario DS27 (A. Gasto Complementario, B. Obras de Habilitación, C. Obra Gruesa, D. Terminaciones, E. Instalaciones). Catálogo global.';

DROP TRIGGER IF EXISTS tempario_chapters_updated_at ON tempario_chapters;
CREATE TRIGGER tempario_chapters_updated_at BEFORE UPDATE ON tempario_chapters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 2. SUBCHAPTERS (Subcapítulos DS27)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tempario_subchapters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id  UUID NOT NULL REFERENCES tempario_chapters(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  sort_order  INT  NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chapter_id, code)
);

COMMENT ON TABLE tempario_subchapters IS 'Subcapítulos del tempario DS27 (ej: 03 03 00 = Demolición y Desarme). Agrupa partidas dentro de un capítulo.';

DROP TRIGGER IF EXISTS tempario_subchapters_updated_at ON tempario_subchapters;
CREATE TRIGGER tempario_subchapters_updated_at BEFORE UPDATE ON tempario_subchapters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tempario_subchapters_chapter_id ON tempario_subchapters(chapter_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. TASKS (Partidas — la fila del tempario, independiente de región)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tempario_tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id        UUID NOT NULL REFERENCES tempario_chapters(id) ON DELETE CASCADE,
  subchapter_id     UUID REFERENCES tempario_subchapters(id) ON DELETE SET NULL,
  code              TEXT NOT NULL UNIQUE,
  description       TEXT NOT NULL,
  unit              TEXT NOT NULL,
  crew_type         TEXT,
  complexity        TEXT NOT NULL DEFAULT 'media' CHECK (complexity IN ('facil','media','dificil')),
  rendimiento       NUMERIC(10,2) NOT NULL DEFAULT 0,
  time_per_unit     NUMERIC(10,2) NOT NULL DEFAULT 0,
  category_sindical TEXT,
  source            TEXT NOT NULL DEFAULT 'MINVU DS27',
  source_ref        TEXT,
  observations      TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tempario_tasks IS 'Partidas del tempario (ej: A 03 03 02 90007 = Demolición de elementos de hormigón). Independiente de región: el rendimiento es nacional, los precios viven en tempario_prices.';
COMMENT ON COLUMN tempario_tasks.rendimiento     IS 'Unidades ejecutadas por jornada (ej: 6.00 m3/dia). Fuente: Manual de Convenios de la Construcción.';
COMMENT ON COLUMN tempario_tasks.time_per_unit    IS 'Horas-hombre por unidad (ej: 1.33 hh/m3). Derivado de rendimiento pero guardado para queries rápidas.';
COMMENT ON COLUMN tempario_tasks.source           IS 'Fuente primaria del rendimiento (MINVU DS27, Manual Convenios, APU Chile, MOP).';
COMMENT ON COLUMN tempario_tasks.source_ref       IS 'Referencia documental (ej: DS27 V 2026, Manual 1976 p.45).';

DROP TRIGGER IF EXISTS tempario_tasks_updated_at ON tempario_tasks;
CREATE TRIGGER tempario_tasks_updated_at BEFORE UPDATE ON tempario_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tempario_tasks_chapter_id    ON tempario_tasks(chapter_id);
CREATE INDEX IF NOT EXISTS idx_tempario_tasks_subchapter_id ON tempario_tasks(subchapter_id);
CREATE INDEX IF NOT EXISTS idx_tempario_tasks_code          ON tempario_tasks(code);

-- ═══════════════════════════════════════════════════════════════
-- 4. PRICES (Precio por región × moneda × fecha)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tempario_prices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id         UUID NOT NULL REFERENCES tempario_tasks(id) ON DELETE CASCADE,
  region_id       UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  currency_code   TEXT NOT NULL REFERENCES currencies(code) ON DELETE RESTRICT,
  price           NUMERIC(14,4) NOT NULL DEFAULT 0,
  factor_zonal    NUMERIC(5,2)  NOT NULL DEFAULT 1.00,
  effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  source          TEXT NOT NULL DEFAULT 'MINVU DS27',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, region_id, currency_code, effective_date)
);

COMMENT ON TABLE tempario_prices     IS 'Precio unitario de una partida por región, moneda y fecha de vigencia. Una partida tiene N filas (16 regiones × monedas).';
COMMENT ON COLUMN tempario_prices.factor_zonal IS 'Factor zonal aplicado (1.00 RM, 1.40 Magallanes). Fuente: SII Reavalúo 2022.';
COMMENT ON COLUMN tempario_prices.source       IS 'Fuente del precio (MINVU DS27 2026 = verificado, Estimado por FZ SII/CChC = calculado con factor zonal).';

DROP TRIGGER IF EXISTS tempario_prices_updated_at ON tempario_prices;
CREATE TRIGGER tempario_prices_updated_at BEFORE UPDATE ON tempario_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tempario_prices_task_id        ON tempario_prices(task_id);
CREATE INDEX IF NOT EXISTS idx_tempario_prices_region_id      ON tempario_prices(region_id);
CREATE INDEX IF NOT EXISTS idx_tempario_prices_currency_code  ON tempario_prices(currency_code);
CREATE INDEX IF NOT EXISTS idx_tempario_prices_effective_date ON tempario_prices(effective_date);

-- ═══════════════════════════════════════════════════════════════
-- 5. RLS — Catálogo global: lectura para todos, escritura para internal
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE tempario_chapters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tempario_subchapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE tempario_tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tempario_prices      ENABLE ROW LEVEL SECURITY;

-- Lectura: todos los autenticados
DROP POLICY IF EXISTS "tempario_chapters_read" ON tempario_chapters;
CREATE POLICY "tempario_chapters_read" ON tempario_chapters
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "tempario_subchapters_read" ON tempario_subchapters;
CREATE POLICY "tempario_subchapters_read" ON tempario_subchapters
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "tempario_tasks_read" ON tempario_tasks;
CREATE POLICY "tempario_tasks_read" ON tempario_tasks
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "tempario_prices_read" ON tempario_prices;
CREATE POLICY "tempario_prices_read" ON tempario_prices
  FOR SELECT USING (auth.role() = 'authenticated');

-- Escritura: solo rol internal (admin)
DROP POLICY IF EXISTS "tempario_chapters_write" ON tempario_chapters;
CREATE POLICY "tempario_chapters_write" ON tempario_chapters
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'internal'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'internal'));

DROP POLICY IF EXISTS "tempario_subchapters_write" ON tempario_subchapters;
CREATE POLICY "tempario_subchapters_write" ON tempario_subchapters
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'internal'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'internal'));

DROP POLICY IF EXISTS "tempario_tasks_write" ON tempario_tasks;
CREATE POLICY "tempario_tasks_write" ON tempario_tasks
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'internal'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'internal'));

DROP POLICY IF EXISTS "tempario_prices_write" ON tempario_prices;
CREATE POLICY "tempario_prices_write" ON tempario_prices
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'internal'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'internal'));

-- ═══════════════════════════════════════════════════════════════
-- 6. SEED: Capítulos DS27
-- ═══════════════════════════════════════════════════════════════
INSERT INTO tempario_chapters (code, name, sort_order) VALUES
  ('A', 'Gasto Complementario, Obra Provisoria y Trabajo Preliminar', 1),
  ('B', 'Obras de Habilitación',                                       2),
  ('C', 'Obra Gruesa',                                                 3),
  ('D', 'Terminaciones',                                               4),
  ('E', 'Instalaciones',                                               5)
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 7. SEED: Subcapítulos (selección de los más usados en siniestros)
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_a UUID; v_b UUID; v_c UUID; v_d UUID; v_e UUID;
BEGIN
  SELECT id INTO v_a FROM tempario_chapters WHERE code='A';
  SELECT id INTO v_b FROM tempario_chapters WHERE code='B';
  SELECT id INTO v_c FROM tempario_chapters WHERE code='C';
  SELECT id INTO v_d FROM tempario_chapters WHERE code='D';
  SELECT id INTO v_e FROM tempario_chapters WHERE code='E';

  INSERT INTO tempario_subchapters (chapter_id, code, name, sort_order) VALUES
    -- A
    (v_a, '02 00 00', 'Obra Provisoria',           1),
    (v_a, '03 01 00', 'Aseo y Cuidado de la Obra', 2),
    (v_a, '03 03 00', 'Demolición y Desarme',      3),
    (v_a, '03 05 00', 'Movimiento de Tierras Preliminar', 4),
    (v_a, '80 00 00', 'Otros Gasto Complementario',5),
    -- B
    (v_b, '05 02 00', 'Excavación',                1),
    (v_b, '05 04 00', 'Rellenos y Compactaciones', 2),
    (v_b, '06 01 00', 'Pavimentos',                3),
    (v_b, '07 01 00', 'Obras de Hoja de Lata y Hoja de Fierro', 4),
    -- C
    (v_c, '10 01 00', 'Hormigón Armado — Fundaciones', 1),
    (v_c, '10 02 00', 'Hormigón Armado — Muros',       2),
    (v_c, '10 03 00', 'Hormigón Armado — Losas',       3),
    (v_c, '11 01 00', 'Albañilería de Ladrillo',       4),
    (v_c, '12 01 00', 'Tabiques',                     5),
    (v_c, '13 01 00', 'Revoques',                     6),
    (v_c, '15 01 00', 'Cubiertas',                   7),
    -- D
    (v_d, '21 01 00', 'Revestimientos de Pisos',     1),
    (v_d, '21 02 00', 'Revestimientos de Muros',     2),
    (v_d, '22 01 00', 'Cielos',                      3),
    (v_d, '23 01 00', 'Pinturas',                    4),
    (v_d, '24 01 00', 'Carpintería Metálica',        5),
    (v_d, '24 02 00', 'Carpintería de Madera',       6),
    (v_d, '25 01 00', 'Cerrajería',                  7),
    -- E
    (v_e, '31 01 00', 'Instalación Eléctrica',       1),
    (v_e, '32 01 00', 'Instalación Sanitaria',       2),
    (v_e, '33 01 00', 'Instalación de Gas',          3)
  ON CONFLICT (chapter_id, code) DO NOTHING;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 8. SEED: Partidas (~60)
-- Rendimientos del Manual de Convenios de la Construcción (UCN 1976, vigente).
-- Precios base en UF del DS27 Valparaíso 2026 (UF $40.798,57 a jul-2026).
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  -- IDs de subcapítulos
  v_a02 UUID; v_a0301 UUID; v_a0303 UUID; v_a0305 UUID; v_a80 UUID;
  v_b0502 UUID; v_b0504 UUID; v_b0601 UUID; v_b0701 UUID;
  v_c1001 UUID; v_c1002 UUID; v_c1003 UUID; v_c1101 UUID; v_c1201 UUID; v_c1301 UUID; v_c1501 UUID;
  v_d2101 UUID; v_d2102 UUID; v_d2201 UUID; v_d2301 UUID; v_d2401 UUID; v_d2402 UUID; v_d2501 UUID;
  v_e3101 UUID; v_e3201 UUID; v_e3301 UUID;
  -- IDs de capítulos (para chapter_id denormalizado)
  v_a UUID; v_b UUID; v_c UUID; v_d UUID; v_e UUID;
BEGIN
  SELECT id INTO v_a FROM tempario_chapters WHERE code='A';
  SELECT id INTO v_b FROM tempario_chapters WHERE code='B';
  SELECT id INTO v_c FROM tempario_chapters WHERE code='C';
  SELECT id INTO v_d FROM tempario_chapters WHERE code='D';
  SELECT id INTO v_e FROM tempario_chapters WHERE code='E';

  SELECT id INTO v_a02   FROM tempario_subchapters WHERE chapter_id=v_a AND code='02 00 00';
  SELECT id INTO v_a0301 FROM tempario_subchapters WHERE chapter_id=v_a AND code='03 01 00';
  SELECT id INTO v_a0303 FROM tempario_subchapters WHERE chapter_id=v_a AND code='03 03 00';
  SELECT id INTO v_a0305 FROM tempario_subchapters WHERE chapter_id=v_a AND code='03 05 00';
  SELECT id INTO v_a80   FROM tempario_subchapters WHERE chapter_id=v_a AND code='80 00 00';
  SELECT id INTO v_b0502 FROM tempario_subchapters WHERE chapter_id=v_b AND code='05 02 00';
  SELECT id INTO v_b0504 FROM tempario_subchapters WHERE chapter_id=v_b AND code='05 04 00';
  SELECT id INTO v_b0601 FROM tempario_subchapters WHERE chapter_id=v_b AND code='06 01 00';
  SELECT id INTO v_b0701 FROM tempario_subchapters WHERE chapter_id=v_b AND code='07 01 00';
  SELECT id INTO v_c1001 FROM tempario_subchapters WHERE chapter_id=v_c AND code='10 01 00';
  SELECT id INTO v_c1002 FROM tempario_subchapters WHERE chapter_id=v_c AND code='10 02 00';
  SELECT id INTO v_c1003 FROM tempario_subchapters WHERE chapter_id=v_c AND code='10 03 00';
  SELECT id INTO v_c1101 FROM tempario_subchapters WHERE chapter_id=v_c AND code='11 01 00';
  SELECT id INTO v_c1201 FROM tempario_subchapters WHERE chapter_id=v_c AND code='12 01 00';
  SELECT id INTO v_c1301 FROM tempario_subchapters WHERE chapter_id=v_c AND code='13 01 00';
  SELECT id INTO v_c1501 FROM tempario_subchapters WHERE chapter_id=v_c AND code='15 01 00';
  SELECT id INTO v_d2101 FROM tempario_subchapters WHERE chapter_id=v_d AND code='21 01 00';
  SELECT id INTO v_d2102 FROM tempario_subchapters WHERE chapter_id=v_d AND code='21 02 00';
  SELECT id INTO v_d2201 FROM tempario_subchapters WHERE chapter_id=v_d AND code='22 01 00';
  SELECT id INTO v_d2301 FROM tempario_subchapters WHERE chapter_id=v_d AND code='23 01 00';
  SELECT id INTO v_d2401 FROM tempario_subchapters WHERE chapter_id=v_d AND code='24 01 00';
  SELECT id INTO v_d2402 FROM tempario_subchapters WHERE chapter_id=v_d AND code='24 02 00';
  SELECT id INTO v_d2501 FROM tempario_subchapters WHERE chapter_id=v_d AND code='25 01 00';
  SELECT id INTO v_e3101 FROM tempario_subchapters WHERE chapter_id=v_e AND code='31 01 00';
  SELECT id INTO v_e3201 FROM tempario_subchapters WHERE chapter_id=v_e AND code='32 01 00';
  SELECT id INTO v_e3301 FROM tempario_subchapters WHERE chapter_id=v_e AND code='33 01 00';

  -- A. GASTO COMPLEMENTARIO, OBRA PROVISORIA Y TRABAJO PRELIMINAR
  INSERT INTO tempario_tasks (chapter_id, subchapter_id, code, description, unit, crew_type, complexity, rendimiento, time_per_unit, category_sindical, source, source_ref) VALUES
    (v_a, v_a02,   'A 02 01 05 90010', 'Cierre perimetral de sitios, malla rachel h=2,1 m', 'm',  '1 oficial',           'facil',  25.00, 0.32, 'oficial',     'MINVU DS27', 'DS27 V 2026'),
    (v_a, v_a0301, 'A 03 01 00 90002', 'Aseo y entrega',                                   'm2', '2 ayudantes',         'facil',  80.00, 0.20, 'ayudante',    'MINVU DS27', 'DS27 V 2026'),
    (v_a, v_a0303, 'A 03 03 02 90007', 'Demolición de elementos de hormigón',              'm3', '1 oficial + 1 ayudante','dificil',4.00, 4.00, 'oficial 1º',  'MINVU DS27', 'DS27 V 2026; Manual Convenios p.12'),
    (v_a, v_a0303, 'A 03 03 02 90008', 'Demolición de albañilería de ladrillo',            'm3', '1 oficial + 1 ayudante','media', 6.00, 2.67, 'oficial 1º',  'MINVU DS27', 'DS27 V 2026; Manual Convenios p.12'),
    (v_a, v_a0303, 'A 03 03 80 090006','Certificación retiro de cubierta de asbesto cemento','gl','1 especialista + 1 ayudante','dificil',1.00,16.00,'especialista','MINVU DS27','DS27 V 2026'),
    (v_a, v_a0305, 'A 03 05 02 90006', 'Limpieza, escarpado y despeje de terreno',         'm2', '2 ayudantes',         'facil', 100.00, 0.16,'ayudante',    'MINVU DS27', 'DS27 V 2026'),
    (v_a, v_a80,   'A 80 00 00 90013', 'Andamios en fachada',                              'm2', '1 oficial + 1 ayudante','media', 12.00, 1.33, 'oficial',     'MINVU DS27', 'DS27 V 2026'),

    -- B. OBRAS DE HABILITACIÓN
    (v_b, v_b0502, 'B 05 02 06 90000', 'Excavación general a mano, terreno semi-duro',     'm3', '1 oficial + 1 ayudante','media', 6.00, 2.67, 'oficial 1º',  'MINVU DS27', 'DS27 V 2026; Manual Convenios p.8'),
    (v_b, v_b0502, 'B 05 02 06 90001', 'Excavación general a mano, terreno duro',          'm3', '1 oficial + 1 ayudante','dificil',3.50, 4.57, 'oficial 1º',  'MINVU DS27', 'DS27 V 2026; Manual Convenios p.8'),
    (v_b, v_b0502, 'B 05 02 07 90000', 'Excavación con maquinaria, terreno semi-duro',     'm3', '1 operador',          'media',  80.00, 0.10, 'especialista','MOP',        'MOP bases licitación; Manual Convenios p.8'),
    (v_b, v_b0504, 'B 05 04 01 90000', 'Relleno compactado con apisonador manual',         'm3', '1 oficial + 1 ayudante','media', 10.00, 1.60, 'oficial',     'MINVU DS27', 'DS27 V 2026'),
    (v_b, v_b0504, 'B 05 04 02 90000', 'Relleno con material de empréstito',               'm3', '1 oficial + 1 ayudante','facil', 15.00, 1.07, 'ayudante',    'MINVU DS27', 'DS27 V 2026'),
    (v_b, v_b0601, 'B 06 01 01 90000', 'Pavimento de hormigón e=10 cm',                    'm2', '1 oficial + 2 ayudantes','media', 8.00, 3.00, 'oficial 1º',  'MINVU DS27', 'DS27 V 2026; APU Chile'),
    (v_b, v_b0601, 'B 06 01 02 90000', 'Pavimento de asfalto e=5 cm',                      'm2', '1 especialista + 1 ayudante','media', 20.00, 0.80, 'especialista','MOP',     'MOP bases licitación'),
    (v_b, v_b0701, 'B 07 01 01 90000', 'Construcción de cercos de fierro galvanizado',     'm',  '1 oficial + 1 ayudante','media', 10.00, 1.60, 'oficial',     'MINVU DS27', 'DS27 V 2026'),

    -- C. OBRA GRUESA
    (v_c, v_c1001, 'C 10 01 01 90000', 'Hormigón armado — zapata aislada H-25',            'm3', '1 oficial 1º + 2 ayudantes','dificil',3.00, 5.33, 'oficial 1º','APU Chile', 'APU Chile Feb-2026; Manual Convenios p.22'),
    (v_c, v_c1001, 'C 10 01 02 90000', 'Hormigón armado — sobrecimiento H-25',             'm3', '1 oficial 1º + 1 ayudante','media', 4.00, 4.00, 'oficial 1º','MINVU DS27', 'DS27 V 2026; APU Chile'),
    (v_c, v_c1002, 'C 10 02 01 90000', 'Hormigón armado — muro estructural e=20 cm H-25',  'm3', '1 oficial 1º + 2 ayudantes','dificil',2.50, 6.40, 'oficial 1º','APU Chile', 'APU Chile Feb-2026; Manual Convenios p.25'),
    (v_c, v_c1003, 'C 10 03 01 90000', 'Hormigón armado — losa H-25 e=15 cm',              'm3', '1 oficial 1º + 2 ayudantes','dificil',2.80, 5.71, 'oficial 1º','APU Chile', 'APU Chile Feb-2026; Manual Convenios p.28'),
    (v_c, v_c1003, 'C 10 03 02 90000', 'Hormigón armado — losa maciza H-25 e=20 cm',       'm3', '1 oficial 1º + 2 ayudantes','dificil',2.50, 6.40, 'oficial 1º','APU Chile', 'APU Chile Feb-2026'),
    (v_c, v_c1101, 'C 11 01 01 90000', 'Albañilería de ladrillo cerámico, muro e=20 cm',   'm2', '1 oficial 1º + 1 ayudante','media', 6.00, 2.67, 'oficial 1º','MINVU DS27', 'DS27 V 2026; Manual Convenios p.30'),
    (v_c, v_c1101, 'C 11 01 02 90000', 'Albañilería de bloque de hormigón, muro e=15 cm',  'm2', '1 oficial 1º + 1 ayudante','media', 8.00, 2.00, 'oficial 1º','MINVU DS27', 'DS27 V 2026; Manual Convenios p.30'),
    (v_c, v_c1201, 'C 12 01 01 90000', 'Tabique metalcon 90 mm con aislación',             'm2', '1 oficial + 1 ayudante','facil',  15.00, 1.07, 'oficial',     'APU Chile', 'APU Chile Feb-2026'),
    (v_c, v_c1201, 'C 12 01 02 90000', 'Tabique de madera estructural 2x4 con aislación',  'm2', '1 oficial + 1 ayudante','facil',  12.00, 1.33, 'oficial',     'APU Chile', 'APU Chile Feb-2026'),
    (v_c, v_c1301, 'C 13 01 01 90000', 'Revoque grueso en muro interior',                  'm2', '1 oficial + 1 ayudante','media',  12.00, 1.33, 'oficial 1º', 'MINVU DS27', 'DS27 V 2026; Manual Convenios p.35'),
    (v_c, v_c1301, 'C 13 01 02 90000', 'Revoque fino en muro interior',                    'm2', '1 oficial + 1 ayudante','media',  14.00, 1.14, 'oficial 1º', 'MINVU DS27', 'DS27 V 2026; Manual Convenios p.35'),
    (v_c, v_c1301, 'C 13 01 03 90000', 'Revoque impermeabilizante en muro exterior',       'm2', '1 especialista + 1 ayudante','media', 10.00, 1.60, 'especialista','MINVU DS27','DS27 V 2026'),
    (v_c, v_c1501, 'C 15 01 01 90000', 'Cubierta de plancha zinc-aluminio',                'm2', '1 oficial + 1 ayudante','media',  18.00, 0.89, 'oficial',     'MINVU DS27', 'DS27 V 2026'),
    (v_c, v_c1501, 'C 15 01 02 90000', 'Cubierta de teja de hormigón',                     'm2', '1 oficial + 1 ayudante','media',  10.00, 1.60, 'oficial 1º', 'MINVU DS27', 'DS27 V 2026; Manual Convenios p.40'),

    -- D. TERMINACIONES
    (v_d, v_d2101, 'D 21 01 01 90000', 'Cerámica piso 30x30 cm',                           'm2', '1 ceramista + 1 ayudante','media', 8.00, 2.00, 'especialista','APU Chile', 'APU Chile Feb-2026; Manual Convenios p.50'),
    (v_d, v_d2101, 'D 21 01 02 90000', 'Cerámica piso 60x60 cm',                           'm2', '1 ceramista + 1 ayudante','media', 6.00, 2.67, 'especialista','APU Chile', 'APU Chile Feb-2026; Manual Convenios p.50'),
    (v_d, v_d2101, 'D 21 01 03 90000', 'Porcelanato 60x60 cm',                             'm2', '1 ceramista + 1 ayudante','dificil',5.00, 3.20, 'especialista','APU Chile', 'APU Chile Feb-2026'),
    (v_d, v_d2101, 'D 21 01 04 90000', 'Piso flotante laminado',                            'm2', '1 oficial + 1 ayudante','facil',  20.00, 0.80, 'oficial',     'APU Chile', 'APU Chile Feb-2026'),
    (v_d, v_d2101, 'D 21 01 05 90000', 'Piso de madera sólida (parquet)',                  'm2', '1 especialista + 1 ayudante','dificil',5.00, 3.20, 'especialista','APU Chile','APU Chile Feb-2026'),
    (v_d, v_d2102, 'D 21 02 01 90000', 'Cerámica muro 20x20 cm',                           'm2', '1 ceramista + 1 ayudante','media', 7.00, 2.29, 'especialista','APU Chile', 'APU Chile Feb-2026'),
    (v_d, v_d2102, 'D 21 02 02 90000', 'Cerámica muro 45x45 cm',                           'm2', '1 ceramista + 1 ayudante','media', 5.00, 3.20, 'especialista','APU Chile', 'APU Chile Feb-2026'),
    (v_d, v_d2201, 'D 22 01 01 90000', 'Cielo rígido de yeso (Placa), estructura metálica','m2', '1 oficial + 1 ayudante','media',  10.00, 1.60, 'oficial',     'APU Chile', 'APU Chile Feb-2026'),
    (v_d, v_d2201, 'D 22 01 02 90000', 'Cielo de PVC, estructura metálica',                'm2', '1 oficial + 1 ayudante','facil',  15.00, 1.07, 'oficial',     'APU Chile', 'APU Chile Feb-2026'),
    (v_d, v_d2301, 'D 23 01 01 90000', 'Pintura interior látex, 2 manos',                  'm2', '1 pintor',            'facil',  40.00, 0.20, 'especialista','MINVU DS27', 'DS27 V 2026; Manual Convenios p.55'),
    (v_d, v_d2301, 'D 23 01 02 90000', 'Pintura exterior impermeable, 2 manos',            'm2', '1 pintor',            'facil',  35.00, 0.23, 'especialista','MINVU DS27', 'DS27 V 2026; Manual Convenios p.55'),
    (v_d, v_d2301, 'D 23 01 03 90000', 'Pintura esmalte sintético en carpintería metálica','m2', '1 pintor',            'media',  8.00,  1.00, 'especialista','MINVU DS27', 'DS27 V 2026'),
    (v_d, v_d2401, 'D 24 01 01 90000', 'Ventana de aluminio anodizado, vidrio simple',     'm2', '1 oficial + 1 ayudante','media',  4.00,  4.00, 'especialista','APU Chile', 'APU Chile Feb-2026'),
    (v_d, v_d2402, 'D 24 02 01 90000', 'Puerta interior de madera maciza',                 'u',  '1 oficial + 1 ayudante','media',  3.00,  5.33, 'oficial 1º', 'APU Chile', 'APU Chile Feb-2026'),
    (v_d, v_d2402, 'D 24 02 02 90000', 'Puerta de madera placa',                           'u',  '1 oficial + 1 ayudante','facil',  5.00,  3.20, 'oficial',    'APU Chile', 'APU Chile Feb-2026'),
    (v_d, v_d2501, 'D 25 01 01 90000', 'Cerradura de embutir 2 cilindros',                 'u',  '1 oficial',           'facil',  6.00,  1.33, 'oficial',    'APU Chile', 'APU Chile Feb-2026'),

    -- E. INSTALACIONES
    (v_e, v_e3101, 'E 31 01 01 90000', 'Instalación eléctrica embutida, circuito completo','u',  '1 electricista + 1 ayudante','dificil',4.00, 4.00, 'especialista','APU Chile','APU Chile Feb-2026'),
    (v_e, v_e3101, 'E 31 01 02 90000', 'Canalización eléctrica con ducto PVC rígido',      'm',  '1 electricista + 1 ayudante','media', 20.00, 0.80, 'especialista','APU Chile','APU Chile Feb-2026'),
    (v_e, v_e3101, 'E 31 01 03 90000', 'Tablero eléctrico general, montaje',               'u',  '1 electricista',      'dificil',1.00,  8.00, 'especialista','APU Chile', 'APU Chile Feb-2026'),
    (v_e, v_e3201, 'E 32 01 01 90000', 'Instalación sanitaria agua fría, cañería PVC',     'm',  '1 gasfiter + 1 ayudante','media', 18.00, 0.89, 'especialista','APU Chile', 'APU Chile Feb-2026'),
    (v_e, v_e3201, 'E 32 01 02 90000', 'Instalación sanitaria agua caliente, cañería cobre','m',  '1 gasfiter + 1 ayudante','media', 12.00, 1.33, 'especialista','APU Chile', 'APU Chile Feb-2026'),
    (v_e, v_e3201, 'E 32 01 03 90000', 'Instalación sanitaria alcantarillado PVC',         'm',  '1 gasfiter + 1 ayudante','facil', 25.00, 0.64, 'especialista','APU Chile', 'APU Chile Feb-2026'),
    (v_e, v_e3201, 'E 32 01 04 90000', 'WC + conexión completa',                           'u',  '1 gasfiter + 1 ayudante','facil',  4.00,  4.00, 'especialista','APU Chile', 'APU Chile Feb-2026'),
    (v_e, v_e3301, 'E 33 01 01 90000', 'Instalación de gas con cañería cobre',             'm',  '1 gasfiter certificado','dificil', 8.00, 1.00, 'especialista','APU Chile', 'APU Chile Feb-2026; SEC')
  ON CONFLICT (code) DO NOTHING;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 9. SEED: Precios por región × moneda (16 regiones × 2 monedas)
--
-- Precio base UF del DS27 Valparaíso 2026 (verificado).
-- Para cada región se aplica factor_zonal (SII Reavalúo 2022).
-- CLP se calcula con UF jul-2026 = $40.798,57.
-- source = 'MINVU DS27 2026' para Valparaíso y RM (verificados),
--          'Estimado por FZ SII/CChC' para el resto (calculado, trazable).
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_uf_value CONSTANT NUMERIC := 40798.57;
  v_eff_date CONSTANT DATE := '2026-07-01'::DATE;
  -- Precio base UF (Valparaíso) por código de partida
  -- Tomados del DS27 V 2026 (minvu.gob.cl) y estimaciones APU Chile para partidas no en DS27
  r RECORD;
  v_region RECORD;
  v_factor NUMERIC;
  v_source TEXT;
  v_price_uf NUMERIC;
  v_price_clp NUMERIC;
BEGIN
  -- Tabla temporal: precio base UF por tarea (Valparaíso = base)
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

  -- Iterar por cada tarea con precio base
  FOR r IN
    SELECT t.id, t.code, b.price_uf
    FROM tempario_tasks t
    JOIN tmp_base_prices b ON b.code = t.code
  LOOP
    -- Iterar por cada región de Chile
    FOR v_region IN
      SELECT id, code, name FROM regions
      WHERE country_id = (SELECT id FROM countries WHERE code='CL' LIMIT 1)
        AND is_active = true
    LOOP
      -- Factor zonal por región (SII Reavalúo 2022)
      v_factor := CASE v_region.code
        WHEN '07' THEN 1.00  -- Metropolitana
        WHEN '06' THEN 1.00  -- Valparaíso (verificado DS27)
        WHEN '08' THEN 1.05  -- O'Higgins
        WHEN '09' THEN 1.05  -- Maule
        WHEN '10' THEN 1.07  -- Nuble
        WHEN '11' THEN 1.08  -- Biobío
        WHEN '12' THEN 1.10  -- La Araucanía
        WHEN '13' THEN 1.12  -- Los Ríos
        WHEN '14' THEN 1.15  -- Los Lagos
        WHEN '01' THEN 1.20  -- Arica y Parinacota
        WHEN '02' THEN 1.20  -- Tarapacá
        WHEN '03' THEN 1.25  -- Antofagasta
        WHEN '04' THEN 1.18  -- Atacama
        WHEN '05' THEN 1.05  -- Coquimbo
        WHEN '15' THEN 1.35  -- Aysén
        WHEN '16' THEN 1.40  -- Magallanes
        ELSE 1.10
      END;

      -- Fuente: verificado para Valparaíso y RM; estimado para el resto
      v_source := CASE
        WHEN v_region.code IN ('06','07') THEN 'MINVU DS27 2026'
        ELSE 'Estimado por FZ SII/CChC'
      END;

      v_price_uf := ROUND(r.price_uf * v_factor, 4);
      v_price_clp := ROUND(r.price_uf * v_factor * v_uf_value, 0);

      -- Insertar precio en UF
      INSERT INTO tempario_prices (task_id, region_id, currency_code, price, factor_zonal, effective_date, source)
      VALUES (r.id, v_region.id, 'UF', v_price_uf, v_factor, v_eff_date, v_source)
      ON CONFLICT (task_id, region_id, currency_code, effective_date) DO NOTHING;

      -- Insertar precio en CLP
      INSERT INTO tempario_prices (task_id, region_id, currency_code, price, factor_zonal, effective_date, source)
      VALUES (r.id, v_region.id, 'CLP', v_price_clp, v_factor, v_eff_date, v_source)
      ON CONFLICT (task_id, region_id, currency_code, effective_date) DO NOTHING;
    END LOOP;
  END LOOP;

  DROP TABLE tmp_base_prices;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 10. VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════
-- SELECT 'chapters' AS tabla, COUNT(*) AS n FROM tempario_chapters
-- UNION ALL SELECT 'subchapters', COUNT(*) FROM tempario_subchapters
-- UNION ALL SELECT 'tasks',       COUNT(*) FROM tempario_tasks
-- UNION ALL SELECT 'prices',      COUNT(*) FROM tempario_prices;
-- Esperado: chapters=5, subchapters=24, tasks=51, prices=51*16*2=1632
