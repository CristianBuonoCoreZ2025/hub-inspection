// Parsea tmp_ds27_valparaiso.txt y genera SQL con todas las partidas del DS27
const fs = require("fs");
const txt = fs.readFileSync("tmp_ds27_valparaiso.txt", "utf-8");

// El texto tiene las partidas en formato:
// A 02 01 05   90010   CIERRE PERIMETRAL...   m   1,00   0,1989   0,1989   ...
// Los capítulos se identifican por: "00001 A.-", "00168 B.-", "00013 C.-", etc.

// Mapeo de capítulo por prefijo de código
const chapterByPrefix = {
  "A": "A",
  "B": "B",
  "C": "C",
  "D": "D",
  "E": "E",
};

// Regex para partidas: CODIGO(5 grupos) + NUMERO(5 digitos) + DESCRIPCION + UNIDAD + CANTIDAD + PRECIOS
// Formato: "A 02 01 05   90010   DESCRIPCION   m   1,00   0,1989   ..."
const partidaRegex = /([A-E])\s(\d{2})\s(\d{2})\s(\d{2})\s+(\d{5,6})\s+(.+?)\s+(m3|m2|m|u|kg|gl|ml|pza|ton|h)\s+1,00\s+([\d.,]+)/g;

const partidas = [];
let match;
while ((match = partidaRegex.exec(txt)) !== null) {
  const chapter = match[1];
  const code = `${match[1]} ${match[2]} ${match[3]} ${match[4]} ${match[5]}`;
  const desc = match[6].trim();
  const unit = match[7];
  // Precio base = "P.UNITARIO 0%" (primer valor después de 1,00)
  const priceStr = match[8].replace(/\./g, "").replace(",", ".");
  const price = parseFloat(priceStr);

  if (desc && !desc.match(/^\d{5}/) && price > 0) {
    partidas.push({ code, chapter, description: desc, unit, price_uf: price });
  }
}

// Dedup por código (algunas partidas aparecen en múltiples secciones)
const seen = new Set();
const unique = [];
for (const p of partidas) {
  if (!seen.has(p.code)) {
    seen.add(p.code);
    unique.push(p);
  }
}

// Generar SQL
const byCh = {};
unique.forEach(p => byCh[p.chapter] = (byCh[p.chapter] || 0) + 1);

let sql = `-- Migración 231: Ampliación tempario + constraint de precio único vigente
--
-- Cambios:
-- 1. Cambia el UNIQUE constraint de tempario_prices de
--    (task_id, region_id, currency_code, effective_date)
--    a (task_id, region_id, currency_code)
--    → Solo UN precio vigente por partida+región+moneda.
--    → Al actualizar un precio, se reemplaza (no se crea histórico).
--    → effective_date queda como "fecha de última actualización".
--
-- 2. Carga ${unique.length} partidas del DS27 Valparaíso 2026 (todas las del PDF oficial).
--    Antes había 53; ahora ${unique.length} (A=${byCh.A||0}, B=${byCh.B||0}, C=${byCh.C||0}, D=${byCh.D||0}, E=${byCh.E||0}).
--
-- 3. Regenera los precios UF para TODAS las partidas en las 15 regiones
--    de Chile con factor zonal corregido, usando UPSERT (reemplaza, no historial).
--
-- Fuente: TABLA DE PRECIOS REFERENCIALES DS27 REGION DE VALPARAISO 2026
-- UF de referencia: $40.798,57
-- ═══════════════════════════════════════════════════════════════

-- 1. Cambiar constraint: precio único por partida+región+moneda
--    (sin effective_date → no historial, solo vigente)
ALTER TABLE tempario_prices DROP CONSTRAINT IF EXISTS tempario_prices_task_id_region_id_currency_co_key;
ALTER TABLE tempario_prices ADD CONSTRAINT tempario_prices_unique_vigente
  UNIQUE (task_id, region_id, currency_code);

COMMENT ON COLUMN tempario_prices.effective_date IS 'Fecha de la última actualización del precio (no vigencia histórica — solo hay un precio vigente por partida+región+moneda).';
COMMENT ON TABLE tempario_prices IS 'Precio unitario vigente de una partida por región y moneda. Una fila por (task_id, region_id, currency_code). Al actualizar, se reemplaza (no historial).';

-- 2. Insertar partidas nuevas del DS27 (las que ya existen se saltan por code)
`;

for (const p of unique) {
  const descEsc = p.description.replace(/'/g, "''");
  sql += `INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)\n`;
  sql += `SELECT c.id, '${p.code}', '${descEsc}', '${p.unit}', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true\n`;
  sql += `FROM tempario_chapters c WHERE c.code = '${p.chapter}'\n`;
  sql += `AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = '${p.code}')\n;\n\n`;
}

sql += `-- 3. UPSERT precios UF para TODAS las partidas en las 15 regiones
--    (ON CONFLICT DO UPDATE → reemplaza el precio vigente, no crea histórico)
DO $$
DECLARE
  v_eff_date CONSTANT DATE := '2026-07-01'::DATE;
  r RECORD;
  v_region RECORD;
  v_factor NUMERIC;
  v_source TEXT;
  v_price_uf NUMERIC;
BEGIN
  -- Tabla temporal con precios base por código (Valparaíso = base, FZ=1.00)
  CREATE TEMP TABLE tmp_ds27_prices (code TEXT, price_uf NUMERIC) ON COMMIT DROP;
`;

for (const p of unique) {
  sql += `  INSERT INTO tmp_ds27_prices VALUES ('${p.code}', ${p.price_uf.toFixed(4)});\n`;
}

sql += `
  FOR r IN
    SELECT t.id, t.code, b.price_uf
    FROM tempario_tasks t
    JOIN tmp_ds27_prices b ON b.code = t.code
  LOOP
    FOR v_region IN
      SELECT id, code FROM regions
      WHERE country_id = (SELECT id FROM countries WHERE code='CL' LIMIT 1)
        AND is_active = true
    LOOP
      v_factor := CASE v_region.code
        WHEN '01' THEN 1.20  -- Arica y Parinacota
        WHEN '02' THEN 1.20  -- Tarapacá
        WHEN '03' THEN 1.25  -- Antofagasta
        WHEN '04' THEN 1.18  -- Atacama
        WHEN '05' THEN 1.05  -- Coquimbo
        WHEN '06' THEN 1.00  -- Valparaíso (verificado DS27)
        WHEN '07' THEN 1.05  -- O'Higgins
        WHEN '08' THEN 1.05  -- Maule
        WHEN '09' THEN 1.08  -- Biobío
        WHEN '10' THEN 1.10  -- La Araucanía
        WHEN '11' THEN 1.15  -- Los Lagos
        WHEN '12' THEN 1.35  -- Aysén
        WHEN '13' THEN 1.00  -- Región Metropolitana (verificado DS27)
        WHEN '14' THEN 1.12  -- Los Ríos
        WHEN '15' THEN 1.40  -- Magallanes
        ELSE 1.10
      END;

      v_source := CASE
        WHEN v_region.code IN ('06','13') THEN 'MINVU DS27 2026'
        ELSE 'Estimado por FZ SII/CChC'
      END;

      v_price_uf := ROUND(r.price_uf * v_factor, 4);

      INSERT INTO tempario_prices (task_id, region_id, currency_code, price, factor_zonal, effective_date, source)
      VALUES (r.id, v_region.id, 'UF', v_price_uf, v_factor, v_eff_date, v_source)
      ON CONFLICT (task_id, region_id, currency_code) DO UPDATE
      SET price = EXCLUDED.price,
          factor_zonal = EXCLUDED.factor_zonal,
          effective_date = EXCLUDED.effective_date,
          source = EXCLUDED.source,
          updated_at = NOW();
    END LOOP;
  END LOOP;

  DROP TABLE tmp_ds27_prices;
END $$;

-- Verificación:
-- SELECT COUNT(*) FROM tempario_tasks;  -- Esperado: ~${unique.length}
-- SELECT COUNT(*) FROM tempario_prices; -- Esperado: ${unique.length} × 15 = ${unique.length * 15}
-- SELECT COUNT(*) FROM tempario_prices WHERE currency_code='UF'; -- = total
`;


fs.writeFileSync("migrations/231_tempario_ds27_full.sql", sql);
console.log(`Partidas extraídas: ${unique.length}`);
console.log(`Por capítulo:`);
Object.entries(byCh).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
console.log(`SQL escrito a migrations/231_tempario_ds27_full.sql`);
