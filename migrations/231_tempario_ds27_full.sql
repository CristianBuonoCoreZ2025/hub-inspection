-- Migración 231: Ampliación tempario + constraint de precio único vigente
--
-- Cambios:
-- 1. Cambia el UNIQUE constraint de tempario_prices de
--    (task_id, region_id, currency_code, effective_date)
--    a (task_id, region_id, currency_code)
--    → Solo UN precio vigente por partida+región+moneda.
--    → Al actualizar un precio, se reemplaza (no se crea histórico).
--    → effective_date queda como "fecha de última actualización".
--
-- 2. Carga 498 partidas del DS27 Valparaíso 2026 (todas las del PDF oficial).
--    Antes había 53; ahora 498 (A=43, B=15, C=115, D=210, E=115).
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
INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 02 01 05 90010', 'CIERRE PERIMETRAL DE SITIOS, MALLA RASCHEL H=2,1 MT.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 02 01 05 90010')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 02 01 10 090003', 'OFICINA', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 02 01 10 090003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 02 02 01 090000', 'EMPALME PROVISORIO DE AGUA POTABLE', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 02 02 01 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 02 02 02 090006', 'EMPALME PROVISORIO DE ALCANTARILLADO', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 02 02 02 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 02 02 05 090008', 'EMPALME PROVISORIO DE ELICTRICIDAD', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 02 02 05 090008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 02 03 01 90004', 'Letrero indicativo de obra 6 x 2.5 m', 'gl', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 02 03 01 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 02 03 03 090007', 'Señalética con letreros tamaño hoja carta', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 02 03 03 090007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 01 00 90002', 'ASEO Y ENTREGA', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 01 00 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 02 90007', 'Demolición de elementos de hormigón', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 02 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 02 90008', 'Demolición de elementos de albañilería', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 02 90008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 03 090008', 'Retiro de revestimiento de piso existente', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 03 090008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 03 090009', 'Retiro de cubierta existente', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 03 090009')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 03 090001', 'Retiro de estructura de madera', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 03 090001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 03 090011', 'Retiro de revestimiento de cielo existente', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 03 090011')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 03 090012', 'Retiro de estructura de tabique existente', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 03 090012')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 04 090004', 'Retiro de marco y puerta existentes', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 04 090004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 04 090005', 'Retiro de ventana existente', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 04 090005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 05 090006', 'Extracción de escombros', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 05 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 04 090006', 'Retiro de artefactos sanitarios (para instalar cerámicas)', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 04 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 04 090007', 'Retiro objetos de fachadas', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 04 090007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 05 02 90006', 'Limpieza, escarpado y despeje de terreno, con máquina', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 05 02 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 05 02 90007', 'Limpieza, escarpado y despeje de terreno, manual e= 15 cm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 05 02 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 06 00 90001', 'Replanteo', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 06 00 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 80 00 00 90013', 'ANDAMIOS FACHADA, ARRIENDO', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 80 00 00 90013')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 80 090002', 'Desmantelación de techumbre de asbesto (Incluye todo el procedimiento y certificación)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 80 090002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 03 80 090006', 'Certificación Retiro de cubierta de Asbesto cemento', 'gl', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 03 80 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 05 02 06 90000', 'Excavacion gral a mano terr.semi-duro', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 05 02 06 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 05 02 06 90001', 'Rectificacion de excavacion', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 05 02 06 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 05 02 05 90000', 'Excavación en zanja con máquina', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 05 02 05 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 05 02 04 90000', 'EXCAVACION EN ROCA', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 05 02 04 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 05 03 02 90000', 'RETIRO DE ESCOMBROS', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 05 03 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 05 04 00 90000', 'Relleno con material de obra', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 05 04 00 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 05 04 03 90005', 'Relleno estabilizado', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 05 04 03 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 06 04 00 90000', 'HORMIGON ARMADO MURO DE CONTENCIÓN', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 06 04 00 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 06 04 00 90001', 'ENFIERRADURA MURO DE CONTENCIÓN', 'kg', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 06 04 00 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 06 04 00 90002', 'MOLDAJE MURO DE CONTENCIÓN', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 06 04 00 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 06 09 01 90000', 'HORMIGÓN DE FUNDACIÓN MURO DE BLOQUES DE CEMENTO', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 06 09 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 06 09 01 90001', 'ENFIERRADURA FUNDACION MURO DE BLOQUES DE CEMENTO', 'kg', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 06 09 01 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 06 09 01 90002', 'ALBAÑILERÁ DE BLOQUES DE CEMENTO', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 06 09 01 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 06 07 00 90000', 'MAMPOSTERIA DE PIEDRA (BOLON)', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 06 07 00 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'B 06 01 01 090000', 'BARBACANA PVC 75 MM.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'B'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'B 06 01 01 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 01 03 06 90007', 'Excavación fundaciones manual', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 01 03 06 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 01 03 05 90001', 'Excavación fundaciones con máquina', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 01 03 05 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 02 01 00 90013', 'Emplantillado', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 02 01 00 90013')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 02 00 00 90001', 'Hormigón G10 + 20% B.D.', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 02 00 00 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 02 02 00 90000', 'Hormigón G10 + Aditivo Impermeabilizante', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 02 02 00 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 02 02 00 90001', 'Hormigon G15 + 20% B.D.', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 02 02 00 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 02 02 02 90000', 'HORMIGÓN G20 + 20% B.D.', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 02 02 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 02 02 02 90001', 'POYO DE HORMIGÓN 40 X 40 X 60 CM.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 02 02 02 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 03 00 00 90000', 'Hormigón G15', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 03 00 00 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 02 02 00 90002', 'Hormigón G15 + Aditivo Impermeabilizante', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 02 02 00 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 03 00 00 90001', 'Hormigón G17', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 03 00 00 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 03 00 00 90002', 'Hormigón G17 + Aditivo Impermeabilizante', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 03 00 00 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 02 02 80 90002', 'Sobrecimiento con bloques de cemento', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 02 02 80 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 03 04 00 090023', 'FIERRO 10 MM.', 'kg', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 03 04 00 090023')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 03 80 00 90000', 'Moldaje de madera para sobrecimiento (3 usos)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 03 80 00 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 03 00 90003', 'Cama de ripio compactada e = 8 cm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 03 00 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 03 00 90004', 'Cama de ripio compactada e = 10 cm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 03 00 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 03 00 90005', 'Relleno interior estabilizado compactado', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 03 00 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 03 02 090022', 'Hormigón G15 + Aditivo Impermeabilizante e= 8 cm', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 03 02 090022')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 03 02 90017', 'Hormigón G15 +   endurecedor superficial e= 8cm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 03 02 90017')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 03 02 090023', 'Hormigón G15 e= 8cm', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 03 02 090023')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 03 80 90000', 'Afinado de piso e = 2 cm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 03 80 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 03 02 90020', 'Radier de hormigon G-17 e=10 cm', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 03 02 90020')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 03 02 90021', 'Radier de hormigon G-!7 e=7 cm', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 03 02 90021')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 03 80 90003', 'Mejoramiento de superficie para pavimento (revestimiento)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 03 80 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 03 03 090001', 'Colocación malla Electrosoldada 15 x15 4,2mm', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 03 03 090001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 03 80 090004', 'Puntereo de radier', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 03 80 090004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 03 80 090005', 'Mejoramiento de superficie para pavimento (revestimiento 5 mm)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 03 80 090005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 05 02 090007', 'Hormigón G17 con Aditivo Impermeabilizante', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 05 02 090007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 05 02 90005', 'Hormigón G20', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 05 02 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 05 02 90006', 'Hormigón G20 con Aditivo Impermeabilizante', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 05 02 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 02 02 80 90001', 'Fierro 10 mm.', 'kg', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 02 02 80 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 05 01 90000', 'Enfierradura de pilar acma 15/15 9,2 mm', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 05 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 05 01 90001', 'Enfierradura de pilar acma 15/20 9,2 mm', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 05 01 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 05 01 90003', 'Enfierradura de viga y cadena acma 15/20 9,2 mm', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 05 01 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 05 01 90004', 'Enfierradura de viga y cadena acma 15/25 9,2 mm', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 05 01 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 05 01 90005', 'Enfierradura de viga y cadena acma 15/30 9,2 mm', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 05 01 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 05 03 90000', 'Moldaje de madera para pilares (3 usos)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 05 03 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 06 01 04 90000', 'Moldaje de madera para vigas y cadenas (3 usos)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 06 01 04 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 03 01 90028', 'Albañilería armada ladrillo santiago 7e o titan 29x14x7,1', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 03 01 90028')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 03 01 90029', 'Albañilería armada ladrillo santiago 9e o extra titan 29x14x9,4', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 03 01 90029')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 03 01 90030', 'Albañilería armada ladrillo santiago 11e o gran titan 29x14x11,3', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 03 01 90030')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 03 01 90031', 'ALBAÑILERÍA ARMADA MEDIANERO SANTIAGOTE 7E', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 03 01 90031')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 03 01 90032', 'ALBAÑILERÍA ARMADA MEDIANERO SANTIAGOTE 9E', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 03 01 90032')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 03 01 90033', 'ALBAÑILERÍA ARMADA MEDIANERO SANTIAGOTE 11E', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 03 01 90033')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 03 02 90004', 'ALBAÑILERÍA CONFINADA LADRILLO FISCAL', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 03 02 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 03 02 90005', 'ALBAÑILERÍA LADRILLO FISCAL PANDERETA', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 03 02 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 01 01 90002', 'Albañilería armada bloques de cemento 40x20x20', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 01 01 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 01 01 90003', 'Albañilería armada bloques de cemento 40x20x15', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 01 01 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 04 03 090018', 'Estructura tabique pino 2" x 3"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 04 03 090018')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 04 03 090019', 'Estructura tabique pino ipv 2" x 3"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 04 03 090019')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 04 03 090020', 'Estructura tabique lenga 2" x 3"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 04 03 090020')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 07 02 06 90003', 'PLACA OSB ESTRUCTURAL DE PINO 11,1 MM PARA ENTRAMADO DE MADERA', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 07 02 06 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 07 02 06 90004', 'PLACA OSB ESTRUCTURAL DE PINO 15,1 MM PARA ENTRAMADO DE MADERA', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 07 02 06 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 07 02 06 90006', 'Placa aglomerada 9 mm para entramado de madera', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 07 02 06 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 07 02 06 90007', 'Placa aglomerada 12 mm para entramado de madera', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 07 02 06 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 07 02 06 90008', 'Placa aglomerada 15 mm para entramado de madera', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 07 02 06 90008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 04 03 90013', 'Estructura tabique pino 2" x 2"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 04 03 90013')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 04 03 90014', 'Estructura tabique pino ipv 2" x 2"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 04 03 90014')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 04 03 90015', 'ESTRUCTURA TABIQUE LENGA 2" X 2"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 04 03 90015')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 07 02 06 90010', 'Placa OSB estructural de pino 9,5 mm para entramado de madera', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 07 02 06 90010')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 05 03 090002', 'Pilar de madera Pino Oregón 4" x 4"', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 05 03 090002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 05 03 90001', 'PILAR DE MADERA 4" X 4" LENGA', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 05 03 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 06 06 03 90000', 'VIGA', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 06 06 03 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 04 02 090014', 'Estructura de perfiles galvanizados serie 60 0,85 mm', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 04 02 090014')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 04 02 090015', 'Estructura de perfiles galvanizados serie 90 0,85mm', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 04 02 090015')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 07 02 02 090000', 'ESTRUCTURA TABIQUE', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 07 02 02 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 05 01 90007', 'PILAR METÁLICO 100 X 100 X 3 mm.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 05 01 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 05 05 01 90008', 'PILAR METÁLICO 75 X 75 X 3 mm.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 05 05 01 90008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 02 03 090007', 'Envigado de piso, pino 2" x 6"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 02 03 090007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 02 03 090008', 'Envigado de piso, pino IPV 2" x 6"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 02 03 090008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 02 03 090009', 'Envigado de piso, lenga 2" x 6"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 02 03 090009')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 02 03 090010', 'Envigado de piso, pino 2" x 8"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 02 03 090010')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 02 03 090011', 'Envigado de piso, pino IPV 2" x 8"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 02 03 090011')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 02 03 090012', 'Envigado de piso, lenga 2" x 8"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 02 03 090012')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 02 04 90000', 'ENVIGADO DE PISO ACERO GALVANIZADO', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 02 04 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 80 00 090000', 'Placa OSB estructural de pino 9,5 mm para entramado de madera', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 80 00 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 80 00 090001', 'Placa OSB estructural de pino 11,1 mm para entramado de madera', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 80 00 090001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 80 00 090002', 'Placa OSB estructural de pino 15,1 mm para entramado de madera', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 80 00 090002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 80 00 090003', 'Placa OSB estructural de pino 9,5 mm para perfiles galvanizados', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 80 00 090003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 80 00 090004', 'Placa OSB estructural de pino 11,1 mm para perfiles galvanizados', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 80 00 090004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 80 00 090005', 'Placa OSB estructural de pino 15,1 mm para perfiles galvanizados', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 80 00 090005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 80 00 090006', 'Placa aglomerada 9 mm para entramado de madera', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 80 00 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 80 00 090007', 'Placa aglomerada 12 mm para entramado de madera', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 80 00 090007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 04 80 00 090008', 'Placa aglomerada 15 mm para entramado de madera', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 04 80 00 090008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 06 04 01 90021', 'Hormigón G25 con impermeabilizante', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 06 04 01 90021')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 06 04 01 90022', 'Enfierradura', 'kg', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 06 04 01 90022')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 06 04 01 90023', 'MOLDAJES', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 06 04 01 90023')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 10 03 03 90006', 'ESTRUCTURA TECHUMBRE PEND. 40%, CERCHAS A 90 CM. MADERA', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 10 03 03 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 01 02 90000', 'Costaneras 2" x 2"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 01 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 01 01 090000', 'Placa de madera terciada 12 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 01 01 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 10 03 02 90006', 'ESTRUCTURA TECHUMBRE PEND. 40%, CERCHAS A 90 CM. PERFIL GALVANIZADO', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 10 03 02 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 01 02 90001', 'COSTANERAS VOLCOMETAL PERFIL W', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 01 02 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 02 02 90009', 'Cubierta zinc alum onda estandar 0,35 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 02 02 90009')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 02 02 90010', 'Cubierta zinc alum onda estandar 0,4 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 02 02 90010')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 02 02 090020', 'Cubierta zinc alum 0,4 mm. Prepintada (incluye hojalatería)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 02 02 090020')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 02 04 090000', 'Tejuela asfaltica', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 02 04 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 02 04 090001', 'TEJA COLONIAL', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 02 04 090001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 07 02 90006', 'Canaletas fe galv.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 07 02 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 07 02 90007', 'Canaletas pvc.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 07 02 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 07 01 90006', 'Bajada agua lluvia fe. galv.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 07 01 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 07 01 90007', 'Bajada agua lluvia pvc.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 07 01 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 07 03 90008', 'CABALLETE ACERO GALVANIZADO 0,35MM 30 CM. DESARROLLO', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 07 03 90008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 07 03 90009', 'CABALLETE ACERO GALVANIZADO 0,35MM. 40 CM. DESARROLLO', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 07 03 90009')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 13 01 04 90005', 'ESCALERA DE MADERA CON 2 BARANDAS', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 13 01 04 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 13 01 04 90006', 'ESCALERA DE MADERA CON 1 BARANDA', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 13 01 04 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 13 80 00 90000', 'ESCALERA 14 GRADAS DESCANSO 1.2 x 1.2 ( INCLUYE BARANDA Y PASAMANOS)', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 13 80 00 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 08 80 00 090014', 'Reparación estructural de grieta espesor > 0,3 mm y <= 1 mm,mediante inyección epóxica en elementos  de hormigón armado espesor 20 cm.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 08 80 00 090014')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 04 01 090008', 'ESTUCO MUROS EXTERIORES 1:3 + ADITIVO IMPERMEABILIZANTE E = 2,5 CM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 04 01 090008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 04 01 090009', 'ESTUCO MUROS EXTERIORES PREFABRICADO E= 2,5 CM', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 04 01 090009')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 04 01 90007', 'PASTA MURO EXTERIOR', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 04 01 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 03 01 090000', 'REVESTIMIENTO DE MADERA 3/4" X 4"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 03 01 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 08 04 090002', 'REVESTIMIENTO TERCIADO RANURADO 9 MM', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 08 04 090002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 08 04 090003', 'REVESTIMIENTO TERCIADO RANURADO 12 MM', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 08 04 090003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 08 05 090011', 'REVESTIMIENTO OSB 9,5 MM', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 08 05 090011')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 08 05 090012', 'REVESTIMIENTO OSB 11 MM', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 08 05 090012')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 08 05 090013', 'REVESTIMIENTO OSB 15 MM', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 08 05 090013')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 08 03 090002', 'REVESTIMIENTO FIBROCEMENTO 4 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 08 03 090002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 08 03 090003', 'REVESTIMIENTO FIBROCEMENTO 5 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 08 03 090003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 08 03 090004', 'REVESTIMIENTO FIBROCEMENTO 6 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 08 03 090004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 08 03 090005', 'REVESTIMIENTO FIBROCEMENTO 8 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 08 03 090005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 02 03 02 090000', 'REVESTIMIENTO SIDING FIBROCEMENTO', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 02 03 02 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 03 03 090000', 'REVESTIMIENTO SIDING PVC', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 03 03 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 03 02 090006', 'ESTUCO MUROS INTERIORES 1:3 E= 2,5 CM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 03 02 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 03 02 090007', 'ESTUCO MUROS INTERIORES PREFABRICADO E= 2,5 CM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 03 02 090007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 03 02 090008', 'ESTUCO DE RASGOS CON MORTERO PREPARADO', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 03 02 090008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 06 12 90015', 'Revestimiento yeso cartón 8 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 06 12 90015')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 06 12 90016', 'Revestimiento yeso cartón 10 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 06 12 90016')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 06 12 90017', 'Revestimiento yeso cartón 12,5 mm.RF', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 06 12 90017')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 06 12 90018', 'Revestimiento yeso cartón 15 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 06 12 90018')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 06 07 90009', 'Revestimiento fibrocemento 4 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 06 07 90009')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 06 07 90010', 'Revestimiento fibrocemento 5 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 06 07 90010')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 06 07 90011', 'Revestimiento fibrocemento 6 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 06 07 90011')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 06 07 90012', 'Revestimiento fibrocemento 8 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 06 07 90012')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 02 01 090000', 'REVESTIMIENTO DE MADERA 3/4" X 4"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 02 01 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 06 11 90001', 'Revestimiento Terciado ranurado 9 mm', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 06 11 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 06 11 90002', 'RevestimientoTerciado ranurado 12 mm', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 06 11 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 06 11 090003', 'REVESTIMIENTO TERCIADO ESTRCUTURAL 18 MM', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 06 11 090003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 03 02 090003', 'ESTUCO MUROS INTERIORES 1:3 E= 2,5 CM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 03 02 090003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 03 02 090004', 'ESTUCO MUROS INTERIORES PREFABRICADO E= 2,5 CM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 03 02 090004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 03 02 090005', 'ESTUCO DE RASGOS CON MORTERO PREPARADO', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 03 02 090005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 01 01 90005', 'Cerámica muros 20 x 30', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 01 01 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 04 06 12 90020', 'Revestimiento yeso carton RH 12,5 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 04 06 12 90020')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 90024', 'Poliestireno expandido 50 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 90024')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 90025', 'Poliestireno expandido 80 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 90025')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 90026', 'Poliestireno expandido 100 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 90026')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 90027', 'Lana mineral 40 mm (40kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 90027')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 90028', 'Lana mineral 50 mm (40kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 90028')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 090036', 'Lana mineral 80 mm (40kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 090036')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 090037', 'Lana mineral 120 mm (40kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 090037')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 90030', 'Lana de vidrio 40 mm (18kg/m3) rollo libre 1,2 x 24m', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 90030')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 90031', 'Lana de vidrio 50 mm (22kg/m3) rollo libre 0,6 x 24m', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 90031')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 090039', 'Lana de vidrio 80 mm 11Kg/m3', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 090039')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 090038', 'Lana de vidrio 120mm 11Kg/m3', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 090038')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 90033', 'Fibra de poliester 50mm (6kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 90033')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 02 90001', 'Fieltro # 10.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 02 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 02 90002', 'Fieltro 15 lb.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 02 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 02 90004', 'Lámina de polietileno 0,10 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 02 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 02 90007', 'Membrana hidrófuga', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 02 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 05 01 090004', 'Revest. solución térmica exterior (eifs 20 mm-20Kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 05 01 090004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 05 01 090003', 'Revest. solución térmica exterior (eifs 30 mm-15Kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 05 01 090003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 05 01 90000', 'Revest. solución térmica exterior (eifs 30 mm-20Kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 05 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 05 01 090001', 'Revest. solución térmica exterior (eifs 40 mm-15Kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 05 01 090001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 05 01 090005', 'Revest. solución térmica exterior (eifs 50 mm-15Kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 05 01 090005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 05 01 090006', 'Revest. solución térmica exterior (eifs 70 mm-20Kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 05 01 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 05 01 090007', 'Revest. solución térmica exterior (eifs 80 mm-15Kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 05 01 090007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 03 05 01 090008', 'Revest. solución térmica exterior (eifs 100 mm-15Kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 03 05 01 090008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 090040', 'Solución térmica exterior muro 90mm, listoneado 2"x2" y aislación', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 090040')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 090041', 'Solución térmica exterior de muro 70 mm, listoneado 2"x2" y aislación', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 090041')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 02 01 090042', 'Instalacion Listoneado 1" X 2"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 02 01 090042')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 80 00 090002', 'Burlete de caucho perfil P', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 80 00 090002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 80 00 090003', 'Sello inferior de puerta', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 80 00 090003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 80 00 090004', 'Burlete de caucho perfil E', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 80 00 090004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 80 00 090005', 'Aplicación silicona Neutra', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 80 00 090005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 80 00 090006', 'Aplicación silicona acética', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 80 00 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 80 00 090007', 'Aplicación poliuretano inyectado', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 80 00 090007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 80 00 090008', 'Aplicación sello elastomérico', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 80 00 090008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 01 00 90000', 'Enlucido de Yeso', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 01 00 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 03 90000', 'Listoneado cielo 2" X 2"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 03 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 01 90008', 'LISTONEADO CIELOS CON PERFIL GALVANIZADO OMEGA', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 01 90008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 05 90000', 'Revestimiento madera 1/2" x 4" para cielos', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 05 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 07 90005', 'REVESTIMIENTO YESO CARTÓN 8 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 07 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 07 90006', 'REVESTIMIENTO YESO CARTÓN 10', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 07 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 04 90002', 'REVESTIMIENTO FIBROCEMENTO 4 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 04 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 04 90003', 'REVESTIMIENTO FIBROCEMENTO 5 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 04 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 04 90004', 'REVESTIMIENTO FIBROCEMENTO 6 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 04 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 04 090005', 'REVESTIMIENTO FIBROCEMENTO 8 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 04 090005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 05 90002', 'TERCIADO RANURADO 9 MM', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 05 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 05 90003', 'TERCIADO RANURADO 12 MM', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 05 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 04 90006', 'REVESTIMIENTO FIBROCEMENTO 5 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 04 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 04 90007', 'REVESTIMIENTO FIBROCEMENTO 6 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 04 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 04 090008', 'REVESTIMIENTO FIBROCEMENTO 8 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 04 090008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 02 07 90007', 'REVESTIMIENTO YESO CARTÓN RH 12,5 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 02 07 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 01 06 06 090000', 'GATERA ENTRETECHO', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 01 06 06 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 01 90009', 'Poliestireno expandido 50 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 01 90009')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 01 90010', 'POLIESTIRENO EXPANDIDO 80 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 01 90010')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 01 90011', 'Poliestireno expandido 100 mm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 01 90011')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 01 90012', 'LANA MINERAL 40 MM (40KG/M3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 01 90012')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 01 90013', 'LANA MINERAL 50 MM (40KG/M3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 01 90013')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 01 090016', 'Lana mineral 80 mm (40kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 01 090016')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 01 090017', 'Lana mineral 120 mm (40kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 01 090017')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 01 90014', 'LANA DE VIDRIO 40 MM (18KG/M3) ROLLO LIBRE 1,2 X 24M', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 01 90014')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 00 090003', 'LANA DE VIDRIO 50 MM (22KG/M3) ROLLO LIBRE 0,6 X 24M', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 00 090003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 01 90015', 'FIBRA DE POLIESTER 50MM', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 01 90015')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 02 90008', 'FIELTRO # 10.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 02 90008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 02 90009', 'FIELTRO 15 LB.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 02 90009')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 02 90010', 'LÁMINA DE POLIETILENO 0,10 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 02 90010')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 02 90011', 'MEMBRANA HIDRÓFUGA', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 02 90011')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 01 01 090018', 'LISTONEADO 1" X 2" BAJO CIELO PARA INSTALAR AISLACIÓN', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 01 01 090018')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 05 05 01 90006', 'Cerámica piso 45 X 45 cm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 05 05 01 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 05 05 01 90007', 'Cerámica piso 33 X 33 cm.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 05 05 01 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 05 03 00 90002', 'Alfombra cubrepiso', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 05 03 00 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 05 09 00 90000', 'Piso flotante 6 mm. sistema click', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 05 09 00 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 05 09 00 90001', 'Piso flotante 8 mm. sistema click', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 05 09 00 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 05 06 01 90000', 'ENTABLADO DE PISO, PINO MACHIEMBRADO 1" X 4"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 05 06 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 05 06 01 90001', 'ENTABLADO DE PISO, LENGA MACHIEMBRADO 1" X 4"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 05 06 01 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 01 90002', 'POLIESTIRENO EXPANDIDO 50 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 01 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 01 90003', 'POLIESTIRENO EXPANDIDO 80 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 01 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 01 090004', 'POLIESTIRENO EXPANDIDO 100 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 01 090004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 01 90005', 'LANA MINERAL 40 MM (40KG/M3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 01 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 01 90006', 'LANA MINERAL 50 MM (40KG/M3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 01 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 01 090010', 'Lana mineral 80 mm (40kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 01 090010')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 01 090011', 'Lana mineral 120 mm (40kg/m3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 01 090011')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 01 90007', 'LANA DE VIDRIO 40 MM (18KG/M3) ROLLO LIBRE 1,2 X 24M', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 01 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 01 90008', 'LANA DE VIDRIO 50 MM (18KG/M3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 01 90008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 01 90009', 'FIBRA DE POLIESTER 50MM (6KG/M3)', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 01 90009')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 02 90000', 'FIELTRO # 10.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 02 90001', 'FIELTRO 15 LB.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 02 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 02 90002', 'LÁMINA DE POLIETILENO 0,1 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 02 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 02 90003', 'MEMBRANA HIDRÓFUGA', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 02 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 06 03 01 090012', 'Listoneado para aislar piso ventilado', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 06 03 01 090012')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 02 01 02 90000', 'ALEROS 50 CM DE MADERA 2" X 2"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 02 01 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 02 01 01 90000', 'FIERRO GALVANIZADO', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 02 01 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 02 03 01 90000', 'PINO MACHIHEMBRADO 1/2" X 4"', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 02 03 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 02 05 04 090000', 'REVESTIMIENTO TERCIADO RANURADO 9 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 02 05 04 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 02 05 04 090002', 'REVESTIMIENTO TERCIADO RANURADO 12 MM', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 02 05 04 090002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 02 05 03 90004', 'REVESTIMIENTO FIBROCEMENTO 4 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 02 05 03 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 02 05 03 90005', 'REVESTIMIENTO FIBROCEMENTO 6 MM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 02 05 03 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 02 04 01 90000', 'ESTUCO', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 02 04 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 02 03 02 90001', 'REVESTIMIENTO ALERO SIDDING', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 02 03 02 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 14 02 00 090002', 'CELOSIA ALUMINIO 40 X 30 CM.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 14 02 00 090002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 08 03 90011', 'Tapacan pino cepillado 1" x 4"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 08 03 90011')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 08 03 90012', 'Tapacan pino cepillado 1" x 5"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 08 03 90012')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 08 03 90013', 'Tapacan pino cepillado 1" x 6"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 08 03 90013')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 08 03 90014', 'TAPACAN LENGA CEPILLADO 1" X 4"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 08 03 90014')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 08 03 90015', 'TAPACAN LENGA CEPILLADO 1" X 5"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 08 03 90015')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 11 08 03 90016', 'TAPACAN LENGA CEPILLADO 1" X 6"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 11 08 03 90016')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 03 03 90001', 'Marco de madera pino cepillado', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 03 03 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 15 03 90000', 'Marco metalico', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 15 03 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 17 02 90001', 'PUERTA 65X200 TIPO PLACAROL', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 17 02 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 17 02 90002', 'PUERTA 70X200 TIPO PLACAROL', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 17 02 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 17 02 90003', 'PUERTA 75X200 TIPO PLACAROL', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 17 02 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 17 02 090004', 'PUERTA 80X200 TIPO PLACAROL', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 17 02 090004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 17 02 090005', 'PUERTA 85X200 TIPO PLACAROL', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 17 02 090005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 17 02 90006', 'PUERTA 90X200 TIPO PLACAROL', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 17 02 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 10 02 90000', 'PUERTA 80X200 PINO RADIATA', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 10 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 10 02 90001', 'PUERTA 85X200 PINO RADIATA', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 10 02 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 10 02 90003', 'PUERTA 75X200 TIPO PINO OREGON', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 10 02 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 10 02 90002', 'PUERTA 85 X 200 CM. PINO OREGÓN', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 10 02 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 10 02 90004', 'PUERTA PINO OREGÓN 90 X 200 CM.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 10 02 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 11 02 90000', 'PUERTA VIDRIADA 75X200', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 11 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 03 01 90007', 'Cerradura embutida puerta acceso', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 03 01 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 17 01 90015', 'Cerradura embutida puerta baño', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 17 01 90015')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 17 01 90016', 'Cerradura embutida dormitorios', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 17 01 90016')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 07 17 01 90017', 'Cerradura acceso cocina', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 07 17 01 90017')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90020', 'VENTANA ALUMINIO 100 X 100 CM.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90020')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90021', 'Ventana de aluminio con celosía 45 x 55 cm (para baño o cocina)', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90021')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90023', 'VENTANA DE ALUMINIO 205 X 150 CM.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90023')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90024', 'VENTANA ALUMINIO 140X120. CM.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90024')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90026', 'Ventana aluminio 60X60. cm.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90026')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90028', 'VENTANA ALUMINIO 140X120. CM.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90028')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90029', 'VENTANA ALUMINIO 60X100. CM.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90029')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90030', 'VENTANA ALUMINIO121X100. CM.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90030')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90035', 'VENTANA TERMOPANEL 100 X 100 CM', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90035')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90036', 'VENTANA ALUMINIO TERMOPANEL 200X150. CM.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90036')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90037', 'Ventana aluminio termopanel 60X60. cm.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90037')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90038', 'Ventana aluminio termopanel 260X150. cm.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90038')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90039', 'VENTANA ALUMINIO TERMOPANEL 140X120. CM.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90039')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90040', 'VENTANA ALUMINIO TERMOPANEL 60X100. CM.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90040')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90041', 'VENTANA ALUMINIO TERMOPANEL 120X100. CM.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90041')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90042', 'Ventana aluminio termopanel 120X140. cm.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90042')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 00 90043', 'Ventana aluminio termopanel 160X200 cm.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 00 90043')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 05 00 090078', 'Ventana PVC Blanco (100 x 100 CM) LINEA ANDES 2 HOJAS CORREDERAS', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 05 00 090078')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 05 00 090044', 'Ventana Corredera 02 hojas PVC Blanco Termopanel 20 mm Incoloro (1,20*1,10)', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 05 00 090044')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 06 00 090000', 'Ventana Proyectante PVC Blanco Termopanel 0.45 x 0.65 20 mm Incoloro', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 06 00 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 05 00 090045', 'Ventana Corredera 02 hojas PVC Blanco 2.1 x 1.1 Termopanel 20 mm Incoloro', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 05 00 090045')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 05 00 090046', 'Ventana Corredera 02 hojas PVC Blanco 2.6 x 1.0 Monolitico 4mm Incoloro', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 05 00 090046')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 03 00 90000', 'VENTANA MADERA 120 x 120 cm.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 03 00 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 02 08 90000', 'Vidrios', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 02 08 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 03 80 90000', 'ALFEIZAR MADERA', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 03 80 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 09 80 00 90000', 'ALFEIZAR HORMIGON', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 09 80 00 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 12 03 01 90006', 'Guardapolvos 3/4" x 3"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 12 03 01 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 12 03 80 90000', 'Guardapolvos Piso Laminado', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 12 03 80 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 12 01 01 90004', 'Moldura 1/4 Rodón', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 12 01 01 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 12 01 01 90005', 'Moldura media caña', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 12 01 01 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 12 01 04 90000', 'Cornisa de poliestireno expandido', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 12 01 04 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 12 05 01 90000', 'PILASTRA PINO', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 12 05 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 17 03 00 90005', 'Pintura Antioxido', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 17 03 00 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 17 80 00 90002', 'Impermeabilización fachadas albañilería', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 17 80 00 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 17 80 00 90003', 'Iimpermeabilización recintos húmedos', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 17 80 00 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 17 80 00 90005', 'QUEMADO DE MUROS', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 17 80 00 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 17 80 00 90004', 'Empaste', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 17 80 00 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 17 01 00 90006', 'Pintura Oleo 2 manos', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 17 01 00 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 17 04 00 90013', 'Pintura Esmalte al agua 2 manos', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 17 04 00 90013')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 17 07 00 90000', 'Pintura Esmalte Sintético 2 manos', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 17 07 00 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 17 07 00 90001', 'Pintura Latex 2 manos', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 17 07 00 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 15 02 00 90006', 'BARNIZ MARINO 2 MANOS', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 15 02 00 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 17 80 00 90001', 'Pintura imprimación aceite linaza', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 17 80 00 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 17 08 00 090000', 'PINTURA MARTELINA EXTERIOR', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 17 08 00 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 05 12 02 90001', 'PAVIMENTO PASTELONES 50 X 50 CM.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 05 12 02 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 05 12 02 90002', 'PASTELON HEXAGONAL DE H.C.V.', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 05 12 02 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 05 02 00 90004', 'ACERA HORMIGON', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 05 02 00 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 05 02 00 90005', 'RAMPA 0,90 M ANCHO, ESTABILIZADO 15 CM + RADIER 10 CM TERMINADO ANTIDESLIZANTE', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 05 02 00 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 19 01 01 90000', 'PUERTA REJA ANTEJARDIN   1 x 2,5 m.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 19 01 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 19 01 01 90001', 'PORTON REJA 3.,5 x .2.5', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 19 01 01 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 19 01 01 90002', 'TRAMO DE REJA H=2,5', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 19 01 01 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 19 01 03 90000', 'POLIN IMPREGNADO Y MALLA RASCHEL H=2,6 MT.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 19 01 03 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 19 01 80 90000', 'CIERRES DE PLACA HORMIGÓN VIBRADO 1,80 MT DE ALTURA', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 19 01 80 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 19 01 01 90003', 'CIERRE PERIMETRAL ESTRUCTURA METALICA + MADERA, REJA H = 1,5 MT', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 19 01 01 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 80 00 00 090007', 'Limpieza superficie de fachadas', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 80 00 00 090007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 80 00 00 090008', 'Limpieza de puertas', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 80 00 00 090008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 80 00 00 090009', 'Limpieza ventanas con alcohol', 'm2', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 80 00 00 090009')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 80 00 00 090014', 'ESTRUCTURA DE ACERO CARBONO, TERMINACION ESMALTE SINTETICO', 'kg', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 80 00 00 090014')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 02 01 90000', 'WC con estanque', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 02 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 01 01 90003', 'LAVAMANOS CON PEDESTAL', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 01 01 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 01 03 90000', 'Combinación monomando lavamanos', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 01 03 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 01 01 90000', 'Lavamanos sin pedestal', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 01 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 03 01 90000', 'Tina esmaltada (sin grifería)', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 03 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 03 02 90000', 'Combinación Tina', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 03 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 04 01 90000', 'Receptáculo ducha enlozado 80x80', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 04 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 04 01 90004', 'RECEPTÁCULO DE DUCHA ESPECIAL SIN REBORDE INSTALADO A NIVEL DE PISO TERMINADO', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 04 01 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 04 01 90006', 'RECEPTACULO DUCHA IN SITU', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 04 01 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 07 01 90000', 'Lavadero Económico', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 07 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 07 02 90000', 'Llave lavadero', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 07 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 05 01 90000', 'Lavaplatos 1T 1 S', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 05 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 05 01 90001', 'Lavaplatos 2T 1S', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 05 01 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 05 02 90000', 'Combinación Lavaplatos', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 05 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 08 01 90000', 'PORTARROLLO', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 08 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 08 05 90000', 'JABONERA', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 08 05 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 08 03 90000', 'TOALLERO', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 08 03 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 08 04 90000', 'PERCHA', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 08 04 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 08 11 90005', 'BARRAS DE SEGURIDAD 30 CM PARA BAÑO, INSTALADAS', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 08 11 90005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 08 11 90006', 'BARRAS DE SEGURIDAD 60 CM PARA BAÑO, INSTALADAS', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 08 11 90006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 08 11 90007', 'BARRAS DE SEGURIDAD CURVA PARA BAÑO, INSTALADAS', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 08 11 90007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 08 11 90008', 'BARRAS DE APOYO SUELO SUELO INODORO', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 08 11 90008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 08 11 90009', 'BARRA ABATIBLE PARA INODORO', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 08 11 90009')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 08 11 90010', 'BARRA DUCHA CON SOPORTE AJUSTABLE', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 08 11 90010')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 07 80 00 090001', 'Reinstalación de artefactos sanitarios (por instalación de cerámicas)', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 07 80 00 090001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 05 02 90000', 'MAP 13 MM', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 05 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 05 02 90001', 'MAP 19MM', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 05 02 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 05 02 90002', 'REMARCADORES (CONDOMINIOS Y EDIFICIOS)', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 05 02 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 03 01 05 90000', 'Llave Jardín', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 03 01 05 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 01 01 90000', 'Cañería de cobre 1/2"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 01 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 01 01 90001', 'Cañerías de cobre 3/4"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 01 01 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 01 01 90003', 'Cañeria de cobre 1"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 01 01 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 01 02 90000', 'TUBERÍA PVC HIDRÁULICO 20 MM.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 01 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 01 02 90001', 'TUBERÍA PVC HIDRÁULICO 25 MM', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 01 02 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 01 02 90002', 'TUBERÍA PVC HIDRÁULICO 32 MM', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 01 02 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 01 02 90003', 'TUBERÍA PVC HIDRÁULICO 40 MM', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 01 02 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 01 04 90001', 'TUBERÍA PPR PN16 20 MM.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 01 04 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 01 04 90002', 'TUBERÍA PPR PN16 25 MM.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 01 04 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 01 04 90003', 'TUBERÍA PPR PN16 32 MM.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 01 04 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 03 14 90000', 'Llave de paso 1/2"', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 03 14 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 02 02 04 90000', 'Llave de paso 3/4"', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 02 02 04 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 02 01 01 90002', 'CAÑERIA DE COBRE 1/2"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 02 01 01 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 02 01 01 90003', 'CAÑERIA DE COBRE 3/4"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 02 01 01 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 02 01 01 90004', 'CAÑERIA DE COBRE 1"', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 02 01 01 90004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 01 90001', 'Tuberia PVC Sanitario 40 mm.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 01 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 01 90002', 'Tuberia PVC Sanitario 50 mm.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 01 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 02 90000', 'Tuberia PVC Sanitario 75 mm.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 01 90003', 'Tuberia PVC Santiraio 110 mm.', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 01 90003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 05 01 90000', 'CÁMARA DESGRASADORA 100 LT.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 05 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 04 00 90000', 'CAMARA DE INSPECCION', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 04 00 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 02 80 90000', 'SOLUCIÓN PARTICULAR ALCANTARILLADO CON 10 MT. DE DREN', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 02 80 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 00 090003', 'Rehabilitación Sin-Picar con Fabricación In-situ vertical común 4"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 00 090003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 00 090004', 'Rehabilitación Sin-Picar con Fabricación In-situ vertical común 3"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 00 090004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 00 090005', 'Rehabilitación Sin-Picar con Fabricación In-situ horizontal común 4"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 00 090005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 00 090006', 'Rehabilitación Sin-Picar con Fabricación In-situ horizontal común 5"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 00 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 00 090007', 'Rehabilitación Sin-Picar con Fabricación In-situ horizontal común 6"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 00 090007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 00 090008', 'Rehabilitación Sin-Picar con Fabricación In-situ horizontal común 8"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 00 090008')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 00 090009', 'Apertura conexión común', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 00 090009')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 00 090010', 'Rehabilitación Sin-Picar con Fabricación In-situ horizontal departamento 4"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 00 090010')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 00 090011', 'Rehabilitación Sin-Picar con Fabricación In-situ horizontal departamento 3"', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 00 090011')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 00 090012', 'Apertura conexión departamento', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 00 090012')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 00 090013', 'Rehabilitación Sin-Picar con Fabricación In-situ pieza conexión común', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 00 090013')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 05 01 01 090012', 'Rehabilitación Sin-Picar con Fabricación In-situ pieza conexión departamento', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 05 01 01 090012')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 16 02 01 90000', 'MEDIDOR Y EMPALMES', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 16 02 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 16 05 01 90001', 'TABLERO UNIDAD DE VIVIENDA', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 16 05 01 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 02 09 03 90000', 'Termo eléctrico 50 lts', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 02 09 03 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 02 09 03 90001', 'Termo Eléctrico 100 lts', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 02 09 03 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 02 09 03 90002', 'Termo Eléctrico 150 lts', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 02 09 03 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 16 04 01 90002', 'Centro de alumbrado', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 16 04 01 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 16 04 01 90000', 'Centro de energía eléctrica, enchufe hembra embutido', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 16 04 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 16 04 01 90001', 'Centro de luz 9/12 embutido', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 16 04 01 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 16 09 00 90002', 'BARRA COPERWELD', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 16 09 00 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 18 01 06 90000', 'MEDIDOR', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 18 01 06 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 18 01 06 90001', 'REMARCADOR DE GAS', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 18 01 06 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 18 01 03 90000', 'Cañería cobre 1/2" para gas', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 18 01 03 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 18 01 03 90001', 'Cañería cobre 3/4" para gas', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 18 01 03 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 02 09 01 90000', 'Calefont 5 lt.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 02 09 01 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 02 09 01 90001', 'Calefont 7 lt.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 02 09 01 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 02 09 01 90002', 'Calefont 10 lt.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 02 09 01 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 18 01 80 90000', 'DUCTOS VENTILACION EVACUACION GASES', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 18 01 80 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 02 09 04 90000', 'CASETA PROTECCION CALEFON', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 02 09 04 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 18 01 80 90002', 'NICHOS METÁLICOS PARA CILINDROS DE 15 GK. SOBRE RADIER', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 18 01 80 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 02 10 01 090029', 'SISTEMA SOLAR TERMICO INTEGRADO PARA GENERACIÓN DE AGUA CALIENTE SANITARIA VIVIENDA  UNIFAMILIAR 4 PERSONAS', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 02 10 01 090029')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 16 08 02 090006', 'SISTEMA SOLAR FOTOVOLTAICO PARA GENERACIÓN ELECTRICA MODALIDAD NET BILLING', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 16 08 02 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 10 01 02 90000', 'Extractor de aire 53 m3/hr.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 10 01 02 90000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 10 01 02 90001', 'Extractor de aire 75 m3/hr', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 10 01 02 90001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 10 01 02 090004', 'Extractor de aire 100 m3/hr con higrostato, temporizador y visor', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 10 01 02 090004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 10 01 02 090005', 'Extractor de aire 99 m3/hr con higrostato y temporizador', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 10 01 02 090005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 10 01 02 90002', 'Extractor de aire 129 m3/hr', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 10 01 02 90002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 10 01 02 090006', 'Extractor de aire 132 m3/hr', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 10 01 02 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 10 01 01 090000', 'Ventilación pasiva 3"', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 10 01 01 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 10 01 01 090001', 'Ventilación pasiva 3.5"', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 10 01 01 090001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 10 01 01 090002', 'ventilación pasiva 4"', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 10 01 01 090002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 10 01 01 090003', 'ventilación pasiva 6"', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 10 01 01 090003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 10 04 80 090000', 'Perforación en muro', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 10 04 80 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 10 04 80 090001', 'Perforación en puerta', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 10 04 80 090001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 10 02 01 090000', 'instalación manga flexible', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 10 02 01 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 17 01 00 090000', 'DUCTOS, TOLVAS Y CASETA', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 17 01 00 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 17 01 00 090001', 'CONTENEDORES', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 17 01 00 090001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 15 02 80 090000', 'Provisión extintor tipo A B C 6 Kg.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 15 02 80 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 15 02 80 090001', 'Provisión extintor tipo A B C 10 Kg.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 15 02 80 090001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 15 02 80 090002', 'Provisión extintor tipo A B C 25 Kg. con carro', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 15 02 80 090002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 15 02 80 090003', 'Gabinete policarbonato para extintor 6 KG Kg', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 15 02 80 090003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 15 02 80 090004', 'Gabinete policarbonato para extintor 10 Kg', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 15 02 80 090004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 15 02 80 090005', 'Estructura porta baldes para arena con techo (alto: 70 cm, ancho 100 cm, profundidad: 15 cm) + 3  baldes metálicos (altura: 29 cm, diámetro inferior: 17 cm, diámetro superior: 29 cm) + radier', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 15 02 80 090005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 15 02 80 090006', 'Saco arena 25 Kg para combate de fuego', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 15 02 80 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 15 02 80 090007', 'Tambor metálico 200 litros (tambor arenero para control incendios)', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 15 02 80 090007')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 03 80 00 090040', 'Demarcación con cinta de peligro', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 03 80 00 090040')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'D 19 01 03 090002', 'Cierre perimetral polines impregnados y malla ursus', 'm', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'D'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'D 19 01 03 090002')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090219', 'Botiquín', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090219')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090218', 'Silvato', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090218')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090217', 'Pilas AA', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090217')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090216', 'Linterna de mano a pilas AA', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090216')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090215', 'Radio de mano a pilas AA', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090215')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090214', 'Cinta reflectante para cuerpo', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090214')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090213', 'Manta isotermica aluminizada', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090213')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090212', 'Capa impermeable para lluvia', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090212')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090211', 'Toalla microfibra talla M', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090211')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090210', 'Toalla microfibra talla S', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090210')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090209', 'Mascarillas KN95 para adultos', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090209')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090208', 'Mascarillas KN95 para niños', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090208')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090207', 'Alcohol gel 350 ml con dosificador', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090207')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090206', 'Desinfectante con alcohol isopropilico 1 litro', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090206')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090205', 'Toalla tamaño mediano', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090205')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'A 01 00 00 090204', 'Mochila impermeable 20 - 30 litros', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'A'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'A 01 00 00 090204')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'C 80 00 00 090006', 'Plataforma acero 2.2 x 2.2, h=0.9m con baranda', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'C'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'C 80 00 00 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 01 80 00 090000', 'Estanque vertical de polietileno para acumulación de agua potable 3.400 litros .Incluiye fitting de llenado  y consumo.', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 01 80 00 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 17 01 04 090003', 'Nicho para basura', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 17 01 04 090003')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 17 01 04 090004', 'Contenedores HDPE con tapa y ruedas de 240 L para basura', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 17 01 04 090004')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 17 01 04 090005', 'Contenedores HDPE con tapa y ruedas de 1.100 L para basura', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 17 01 04 090005')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 17 01 04 090006', 'Punto verde móvil metálico espesor 4 mm con cadena, letrero y ruedas (frente: 270 cm, largo: 137 cm,  fondo: 68 cm)', 'u', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 17 01 04 090006')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 17 04 80 090000', 'Retiro de escombros o material sanitario de pozo negro', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 17 04 80 090000')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 17 04 80 090001', 'Vaciado de material sanitario de pozo negro', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 17 04 80 090001')
;

INSERT INTO tempario_tasks (chapter_id, code, description, unit, rendimiento, time_per_unit, complexity, source, source_ref, is_active)
SELECT c.id, 'E 17 04 80 090002', 'Sellado (relleno) de pozo negro', 'm3', 0, 0, 'media', 'MINVU DS27', 'DS27 V 2026', true
FROM tempario_chapters c WHERE c.code = 'E'
AND NOT EXISTS (SELECT 1 FROM tempario_tasks t WHERE t.code = 'E 17 04 80 090002')
;

-- 3. UPSERT precios UF para TODAS las partidas en las 15 regiones
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
  INSERT INTO tmp_ds27_prices VALUES ('A 02 01 05 90010', 0.1989);
  INSERT INTO tmp_ds27_prices VALUES ('A 02 01 10 090003', 17.0172);
  INSERT INTO tmp_ds27_prices VALUES ('A 02 02 01 090000', 34.3149);
  INSERT INTO tmp_ds27_prices VALUES ('A 02 02 02 090006', 31.8639);
  INSERT INTO tmp_ds27_prices VALUES ('A 02 02 05 090008', 3.4794);
  INSERT INTO tmp_ds27_prices VALUES ('A 02 03 01 90004', 35.4215);
  INSERT INTO tmp_ds27_prices VALUES ('A 02 03 03 090007', 0.1869);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 01 00 90002', 0.1425);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 02 90007', 1.5623);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 02 90008', 0.1851);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 03 090008', 0.0980);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 03 090009', 0.1289);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 03 090001', 0.1675);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 03 090011', 0.1804);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 03 090012', 0.1289);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 04 090004', 0.1597);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 04 090005', 0.1277);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 05 090006', 0.4842);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 04 090006', 0.4503);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 04 090007', 0.1804);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 05 02 90006', 0.0492);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 05 02 90007', 0.1226);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 06 00 90001', 0.2117);
  INSERT INTO tmp_ds27_prices VALUES ('A 80 00 00 90013', 0.2024);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 80 090002', 0.6456);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 03 80 090006', 2.0344);
  INSERT INTO tmp_ds27_prices VALUES ('B 05 02 06 90000', 0.3673);
  INSERT INTO tmp_ds27_prices VALUES ('B 05 02 06 90001', 0.3992);
  INSERT INTO tmp_ds27_prices VALUES ('B 05 02 05 90000', 0.1431);
  INSERT INTO tmp_ds27_prices VALUES ('B 05 02 04 90000', 0.4468);
  INSERT INTO tmp_ds27_prices VALUES ('B 05 03 02 90000', 0.4842);
  INSERT INTO tmp_ds27_prices VALUES ('B 05 04 00 90000', 0.4986);
  INSERT INTO tmp_ds27_prices VALUES ('B 05 04 03 90005', 1.3880);
  INSERT INTO tmp_ds27_prices VALUES ('B 06 04 00 90000', 5.7449);
  INSERT INTO tmp_ds27_prices VALUES ('B 06 04 00 90001', 0.0602);
  INSERT INTO tmp_ds27_prices VALUES ('B 06 04 00 90002', 0.3263);
  INSERT INTO tmp_ds27_prices VALUES ('B 06 09 01 90000', 4.3435);
  INSERT INTO tmp_ds27_prices VALUES ('B 06 09 01 90001', 0.0602);
  INSERT INTO tmp_ds27_prices VALUES ('B 06 09 01 90002', 0.8659);
  INSERT INTO tmp_ds27_prices VALUES ('B 06 07 00 90000', 2.2748);
  INSERT INTO tmp_ds27_prices VALUES ('B 06 01 01 090000', 0.1885);
  INSERT INTO tmp_ds27_prices VALUES ('C 01 03 06 90007', 0.4159);
  INSERT INTO tmp_ds27_prices VALUES ('C 01 03 05 90001', 0.1431);
  INSERT INTO tmp_ds27_prices VALUES ('C 02 01 00 90013', 2.8143);
  INSERT INTO tmp_ds27_prices VALUES ('C 02 00 00 90001', 3.7095);
  INSERT INTO tmp_ds27_prices VALUES ('C 02 02 00 90000', 4.3536);
  INSERT INTO tmp_ds27_prices VALUES ('C 02 02 00 90001', 4.6054);
  INSERT INTO tmp_ds27_prices VALUES ('C 02 02 02 90000', 5.0873);
  INSERT INTO tmp_ds27_prices VALUES ('C 02 02 02 90001', 0.4907);
  INSERT INTO tmp_ds27_prices VALUES ('C 03 00 00 90000', 4.3944);
  INSERT INTO tmp_ds27_prices VALUES ('C 02 02 00 90002', 4.5393);
  INSERT INTO tmp_ds27_prices VALUES ('C 03 00 00 90001', 4.5821);
  INSERT INTO tmp_ds27_prices VALUES ('C 03 00 00 90002', 4.7497);
  INSERT INTO tmp_ds27_prices VALUES ('C 02 02 80 90002', 0.2533);
  INSERT INTO tmp_ds27_prices VALUES ('C 03 04 00 090023', 0.0602);
  INSERT INTO tmp_ds27_prices VALUES ('C 03 80 00 90000', 0.4058);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 03 00 90003', 0.1101);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 03 00 90004', 0.1299);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 03 00 90005', 1.2440);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 03 02 090022', 0.5236);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 03 02 90017', 0.5644);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 03 02 090023', 0.4744);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 03 80 90000', 0.2544);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 03 02 90020', 0.5445);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 03 02 90021', 0.3497);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 03 80 90003', 0.1928);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 03 03 090001', 0.0509);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 03 80 090004', 0.1365);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 03 80 090005', 0.1034);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 05 02 090007', 4.7497);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 05 02 90005', 4.7692);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 05 02 90006', 4.9367);
  INSERT INTO tmp_ds27_prices VALUES ('C 02 02 80 90001', 0.0602);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 05 01 90000', 0.1773);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 05 01 90001', 0.2103);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 05 01 90003', 0.1836);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 05 01 90004', 0.2068);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 05 01 90005', 0.2028);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 05 03 90000', 0.4020);
  INSERT INTO tmp_ds27_prices VALUES ('C 06 01 04 90000', 0.4815);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 03 01 90028', 0.8616);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 03 01 90029', 1.0342);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 03 01 90030', 0.9905);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 03 01 90031', 0.8616);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 03 01 90032', 1.0342);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 03 01 90033', 0.9905);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 03 02 90004', 0.4950);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 03 02 90005', 0.2966);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 01 01 90002', 0.8659);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 01 01 90003', 0.7958);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 04 03 090018', 0.2135);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 04 03 090019', 0.2293);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 04 03 090020', 0.4792);
  INSERT INTO tmp_ds27_prices VALUES ('C 07 02 06 90003', 0.2607);
  INSERT INTO tmp_ds27_prices VALUES ('C 07 02 06 90004', 0.3195);
  INSERT INTO tmp_ds27_prices VALUES ('C 07 02 06 90006', 0.2513);
  INSERT INTO tmp_ds27_prices VALUES ('C 07 02 06 90007', 0.2702);
  INSERT INTO tmp_ds27_prices VALUES ('C 07 02 06 90008', 0.2777);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 04 03 90013', 0.1674);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 04 03 90014', 0.1980);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 04 03 90015', 0.3630);
  INSERT INTO tmp_ds27_prices VALUES ('C 07 02 06 90010', 0.2269);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 05 03 090002', 1.2164);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 05 03 90001', 1.5960);
  INSERT INTO tmp_ds27_prices VALUES ('C 06 06 03 90000', 0.2692);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 04 02 090014', 0.4241);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 04 02 090015', 0.4485);
  INSERT INTO tmp_ds27_prices VALUES ('C 07 02 02 090000', 0.4425);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 05 01 90007', 1.1035);
  INSERT INTO tmp_ds27_prices VALUES ('C 05 05 01 90008', 0.7223);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 02 03 090007', 0.2970);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 02 03 090008', 0.3287);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 02 03 090009', 0.4749);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 02 03 090010', 0.3919);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 02 03 090011', 0.4267);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 02 03 090012', 0.7398);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 02 04 90000', 1.3688);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 80 00 090000', 0.2322);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 80 00 090001', 0.2607);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 80 00 090002', 0.3195);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 80 00 090003', 0.2476);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 80 00 090004', 0.2724);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 80 00 090005', 0.3244);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 80 00 090006', 0.2652);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 80 00 090007', 0.2842);
  INSERT INTO tmp_ds27_prices VALUES ('C 04 80 00 090008', 0.2916);
  INSERT INTO tmp_ds27_prices VALUES ('C 06 04 01 90021', 5.2878);
  INSERT INTO tmp_ds27_prices VALUES ('C 06 04 01 90022', 0.0602);
  INSERT INTO tmp_ds27_prices VALUES ('C 06 04 01 90023', 0.5355);
  INSERT INTO tmp_ds27_prices VALUES ('C 10 03 03 90006', 0.3217);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 01 02 90000', 0.1728);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 01 01 090000', 0.2201);
  INSERT INTO tmp_ds27_prices VALUES ('C 10 03 02 90006', 0.3681);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 01 02 90001', 0.1404);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 02 02 90009', 0.1867);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 02 02 90010', 0.2265);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 02 02 090020', 0.4308);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 02 04 090000', 0.2607);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 02 04 090001', 1.2647);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 07 02 90006', 0.3401);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 07 02 90007', 0.2880);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 07 01 90006', 0.3645);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 07 01 90007', 0.2388);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 07 03 90008', 0.3393);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 07 03 90009', 0.3576);
  INSERT INTO tmp_ds27_prices VALUES ('C 13 01 04 90005', 10.1179);
  INSERT INTO tmp_ds27_prices VALUES ('C 13 01 04 90006', 6.9802);
  INSERT INTO tmp_ds27_prices VALUES ('C 13 80 00 90000', 37.6502);
  INSERT INTO tmp_ds27_prices VALUES ('C 08 80 00 090014', 2.6274);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 04 01 090008', 0.3209);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 04 01 090009', 0.2875);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 04 01 90007', 0.0554);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 03 01 090000', 0.3631);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 08 04 090002', 0.2700);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 08 04 090003', 0.3093);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 08 05 090011', 0.2527);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 08 05 090012', 0.2865);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 08 05 090013', 0.3385);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 08 03 090002', 0.2146);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 08 03 090003', 0.2400);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 08 03 090004', 0.2621);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 08 03 090005', 0.2967);
  INSERT INTO tmp_ds27_prices VALUES ('D 02 03 02 090000', 0.3814);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 03 03 090000', 0.4119);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 03 02 090006', 0.2971);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 03 02 090007', 0.2624);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 03 02 090008', 0.2162);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 06 12 90015', 0.2855);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 06 12 90016', 0.2653);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 06 12 90017', 0.2946);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 06 12 90018', 0.2908);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 06 07 90009', 0.2146);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 06 07 90010', 0.2400);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 06 07 90011', 0.2621);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 06 07 90012', 0.2967);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 02 01 090000', 0.3630);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 06 11 90001', 0.2700);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 06 11 90002', 0.3093);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 06 11 090003', 0.3061);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 03 02 090003', 0.2971);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 03 02 090004', 0.2624);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 03 02 090005', 0.2162);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 01 01 90005', 0.4605);
  INSERT INTO tmp_ds27_prices VALUES ('D 04 06 12 90020', 0.2158);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 90024', 0.1156);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 90025', 0.1886);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 90026', 0.1981);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 90027', 0.0695);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 90028', 0.1015);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 090036', 0.1284);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 090037', 0.1874);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 90030', 0.0505);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 90031', 0.0565);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 090039', 0.0611);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 090038', 0.1379);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 90033', 0.0477);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 02 90001', 0.0468);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 02 90002', 0.0494);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 02 90004', 0.0452);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 02 90007', 0.0491);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 05 01 090004', 0.9364);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 05 01 090003', 0.9417);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 05 01 90000', 0.9568);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 05 01 090001', 1.0240);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 05 01 090005', 1.0240);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 05 01 090006', 1.1721);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 05 01 090007', 0.9975);
  INSERT INTO tmp_ds27_prices VALUES ('D 03 05 01 090008', 1.1721);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 090040', 0.5919);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 090041', 0.5541);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 02 01 090042', 0.1662);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 80 00 090002', 0.1116);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 80 00 090003', 0.2298);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 80 00 090004', 0.1308);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 80 00 090005', 0.0582);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 80 00 090006', 0.0431);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 80 00 090007', 0.0360);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 80 00 090008', 0.0477);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 01 00 90000', 0.1752);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 03 90000', 0.1914);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 01 90008', 0.2097);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 05 90000', 0.3164);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 07 90005', 0.2107);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 07 90006', 0.1905);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 04 90002', 0.1630);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 04 90003', 0.2142);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 04 90004', 0.2106);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 04 090005', 0.2452);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 05 90002', 0.2700);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 05 90003', 0.3093);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 04 90006', 0.1884);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 04 90007', 0.2106);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 04 090008', 0.2452);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 02 07 90007', 0.2466);
  INSERT INTO tmp_ds27_prices VALUES ('D 01 06 06 090000', 0.9835);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 01 90009', 0.1774);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 01 90010', 0.1508);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 01 90011', 0.1981);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 01 90012', 0.0695);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 01 90013', 0.1015);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 01 090016', 0.1291);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 01 090017', 0.1888);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 01 90014', 0.0505);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 00 090003', 0.0610);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 01 90015', 0.0477);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 02 90008', 0.0468);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 02 90009', 0.0494);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 02 90010', 0.0452);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 02 90011', 0.0491);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 01 01 090018', 0.0655);
  INSERT INTO tmp_ds27_prices VALUES ('D 05 05 01 90006', 0.7423);
  INSERT INTO tmp_ds27_prices VALUES ('D 05 05 01 90007', 0.5319);
  INSERT INTO tmp_ds27_prices VALUES ('D 05 03 00 90002', 0.1742);
  INSERT INTO tmp_ds27_prices VALUES ('D 05 09 00 90000', 0.3715);
  INSERT INTO tmp_ds27_prices VALUES ('D 05 09 00 90001', 0.4882);
  INSERT INTO tmp_ds27_prices VALUES ('D 05 06 01 90000', 0.4782);
  INSERT INTO tmp_ds27_prices VALUES ('D 05 06 01 90001', 0.9706);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 01 90002', 0.1774);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 01 90003', 0.1508);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 01 090004', 0.1981);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 01 90005', 0.0695);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 01 90006', 0.1015);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 01 090010', 0.1291);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 01 090011', 0.1888);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 01 90007', 0.0505);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 01 90008', 0.0610);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 01 90009', 0.0477);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 02 90000', 0.0468);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 02 90001', 0.0494);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 02 90002', 0.0452);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 02 90003', 0.0491);
  INSERT INTO tmp_ds27_prices VALUES ('D 06 03 01 090012', 0.0870);
  INSERT INTO tmp_ds27_prices VALUES ('D 02 01 02 90000', 0.1914);
  INSERT INTO tmp_ds27_prices VALUES ('D 02 01 01 90000', 0.4192);
  INSERT INTO tmp_ds27_prices VALUES ('D 02 03 01 90000', 0.3164);
  INSERT INTO tmp_ds27_prices VALUES ('D 02 05 04 090000', 0.2714);
  INSERT INTO tmp_ds27_prices VALUES ('D 02 05 04 090002', 0.3111);
  INSERT INTO tmp_ds27_prices VALUES ('D 02 05 03 90004', 0.1630);
  INSERT INTO tmp_ds27_prices VALUES ('D 02 05 03 90005', 0.2106);
  INSERT INTO tmp_ds27_prices VALUES ('D 02 04 01 90000', 0.2275);
  INSERT INTO tmp_ds27_prices VALUES ('D 02 03 02 90001', 0.3942);
  INSERT INTO tmp_ds27_prices VALUES ('D 14 02 00 090002', 0.2478);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 08 03 90011', 0.1012);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 08 03 90012', 0.1070);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 08 03 90013', 0.1120);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 08 03 90014', 0.1448);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 08 03 90015', 0.1600);
  INSERT INTO tmp_ds27_prices VALUES ('C 11 08 03 90016', 0.1752);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 03 03 90001', 0.6442);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 15 03 90000', 0.7402);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 17 02 90001', 1.3206);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 17 02 90002', 1.3206);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 17 02 90003', 1.3206);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 17 02 090004', 1.3206);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 17 02 090005', 1.3206);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 17 02 90006', 1.3206);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 10 02 90000', 2.4380);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 10 02 90001', 2.6223);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 10 02 90003', 8.9827);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 10 02 90002', 5.4400);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 10 02 90004', 5.4400);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 11 02 90000', 3.3803);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 03 01 90007', 1.2110);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 17 01 90015', 0.8135);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 17 01 90016', 1.0833);
  INSERT INTO tmp_ds27_prices VALUES ('D 07 17 01 90017', 1.2316);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90020', 2.0313);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90021', 1.0686);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90023', 6.3980);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90024', 2.3773);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90026', 2.4041);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90028', 2.3773);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90029', 1.9938);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90030', 2.5844);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90035', 6.2429);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90036', 14.4085);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90037', 4.5531);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90038', 3.1296);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90039', 3.1219);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90040', 5.7341);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90041', 6.2429);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90042', 8.0164);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 00 90043', 3.1296);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 05 00 090078', 7.2024);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 05 00 090044', 5.1449);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 06 00 090000', 4.0794);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 05 00 090045', 13.4669);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 05 00 090046', 10.7953);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 03 00 90000', 5.0228);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 02 08 90000', 0.7109);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 03 80 90000', 0.7236);
  INSERT INTO tmp_ds27_prices VALUES ('D 09 80 00 90000', 0.7040);
  INSERT INTO tmp_ds27_prices VALUES ('D 12 03 01 90006', 0.0768);
  INSERT INTO tmp_ds27_prices VALUES ('D 12 03 80 90000', 0.1724);
  INSERT INTO tmp_ds27_prices VALUES ('D 12 01 01 90004', 0.0429);
  INSERT INTO tmp_ds27_prices VALUES ('D 12 01 01 90005', 0.0395);
  INSERT INTO tmp_ds27_prices VALUES ('D 12 01 04 90000', 0.0742);
  INSERT INTO tmp_ds27_prices VALUES ('D 12 05 01 90000', 0.0480);
  INSERT INTO tmp_ds27_prices VALUES ('D 17 03 00 90005', 0.1426);
  INSERT INTO tmp_ds27_prices VALUES ('D 17 80 00 90002', 0.0948);
  INSERT INTO tmp_ds27_prices VALUES ('D 17 80 00 90003', 0.1204);
  INSERT INTO tmp_ds27_prices VALUES ('D 17 80 00 90005', 0.0529);
  INSERT INTO tmp_ds27_prices VALUES ('D 17 80 00 90004', 0.0609);
  INSERT INTO tmp_ds27_prices VALUES ('D 17 01 00 90006', 0.1344);
  INSERT INTO tmp_ds27_prices VALUES ('D 17 04 00 90013', 0.1366);
  INSERT INTO tmp_ds27_prices VALUES ('D 17 07 00 90000', 0.1365);
  INSERT INTO tmp_ds27_prices VALUES ('D 17 07 00 90001', 0.1128);
  INSERT INTO tmp_ds27_prices VALUES ('D 15 02 00 90006', 0.1188);
  INSERT INTO tmp_ds27_prices VALUES ('D 17 80 00 90001', 0.1009);
  INSERT INTO tmp_ds27_prices VALUES ('D 17 08 00 090000', 0.1744);
  INSERT INTO tmp_ds27_prices VALUES ('D 05 12 02 90001', 0.6003);
  INSERT INTO tmp_ds27_prices VALUES ('D 05 12 02 90002', 0.4459);
  INSERT INTO tmp_ds27_prices VALUES ('D 05 02 00 90004', 0.4697);
  INSERT INTO tmp_ds27_prices VALUES ('D 05 02 00 90005', 0.9579);
  INSERT INTO tmp_ds27_prices VALUES ('D 19 01 01 90000', 4.3697);
  INSERT INTO tmp_ds27_prices VALUES ('D 19 01 01 90001', 5.4276);
  INSERT INTO tmp_ds27_prices VALUES ('D 19 01 01 90002', 2.1320);
  INSERT INTO tmp_ds27_prices VALUES ('D 19 01 03 90000', 0.1385);
  INSERT INTO tmp_ds27_prices VALUES ('D 19 01 80 90000', 0.8556);
  INSERT INTO tmp_ds27_prices VALUES ('D 19 01 01 90003', 2.6581);
  INSERT INTO tmp_ds27_prices VALUES ('D 80 00 00 090007', 0.0850);
  INSERT INTO tmp_ds27_prices VALUES ('D 80 00 00 090008', 0.1471);
  INSERT INTO tmp_ds27_prices VALUES ('D 80 00 00 090009', 0.1456);
  INSERT INTO tmp_ds27_prices VALUES ('D 80 00 00 090014', 0.1267);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 02 01 90000', 2.8372);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 01 01 90003', 1.6075);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 01 03 90000', 0.9152);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 01 01 90000', 1.2988);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 03 01 90000', 3.6616);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 03 02 90000', 1.1287);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 04 01 90000', 2.5073);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 04 01 90004', 1.7056);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 04 01 90006', 1.7237);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 07 01 90000', 1.6193);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 07 02 90000', 0.4325);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 05 01 90000', 3.1882);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 05 01 90001', 5.5844);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 05 02 90000', 1.1541);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 08 01 90000', 0.3243);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 08 05 90000', 0.1531);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 08 03 90000', 0.2911);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 08 04 90000', 0.1758);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 08 11 90005', 0.7547);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 08 11 90006', 0.4067);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 08 11 90007', 0.7115);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 08 11 90008', 0.8392);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 08 11 90009', 1.0040);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 08 11 90010', 0.4067);
  INSERT INTO tmp_ds27_prices VALUES ('E 07 80 00 090001', 0.4956);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 05 02 90000', 2.5198);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 05 02 90001', 3.0763);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 05 02 90002', 2.0929);
  INSERT INTO tmp_ds27_prices VALUES ('E 03 01 05 90000', 0.4190);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 01 01 90000', 0.3985);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 01 01 90001', 0.4681);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 01 01 90003', 0.5494);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 01 02 90000', 0.2113);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 01 02 90001', 0.2170);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 01 02 90002', 0.2187);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 01 02 90003', 0.2541);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 01 04 90001', 0.2251);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 01 04 90002', 0.2392);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 01 04 90003', 0.2557);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 03 14 90000', 0.4466);
  INSERT INTO tmp_ds27_prices VALUES ('E 02 02 04 90000', 0.5914);
  INSERT INTO tmp_ds27_prices VALUES ('E 02 01 01 90002', 0.3985);
  INSERT INTO tmp_ds27_prices VALUES ('E 02 01 01 90003', 0.4681);
  INSERT INTO tmp_ds27_prices VALUES ('E 02 01 01 90004', 0.5494);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 01 90001', 0.1604);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 01 90002', 0.1734);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 02 90000', 0.2001);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 01 90003', 0.2929);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 05 01 90000', 3.5898);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 04 00 90000', 3.6577);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 02 80 90000', 30.8539);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 00 090003', 4.6968);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 00 090004', 4.9904);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 00 090005', 4.2966);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 00 090006', 4.7398);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 00 090007', 5.3060);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 00 090008', 7.3018);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 00 090009', 1.0300);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 00 090010', 6.2974);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 00 090011', 6.5910);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 00 090012', 1.1108);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 00 090013', 5.4203);
  INSERT INTO tmp_ds27_prices VALUES ('E 05 01 01 090012', 6.2737);
  INSERT INTO tmp_ds27_prices VALUES ('E 16 02 01 90000', 5.6959);
  INSERT INTO tmp_ds27_prices VALUES ('E 16 05 01 90001', 3.1571);
  INSERT INTO tmp_ds27_prices VALUES ('E 02 09 03 90000', 5.2085);
  INSERT INTO tmp_ds27_prices VALUES ('E 02 09 03 90001', 6.2796);
  INSERT INTO tmp_ds27_prices VALUES ('E 02 09 03 90002', 6.8975);
  INSERT INTO tmp_ds27_prices VALUES ('E 16 04 01 90002', 2.2700);
  INSERT INTO tmp_ds27_prices VALUES ('E 16 04 01 90000', 2.3275);
  INSERT INTO tmp_ds27_prices VALUES ('E 16 04 01 90001', 2.3584);
  INSERT INTO tmp_ds27_prices VALUES ('E 16 09 00 90002', 0.9836);
  INSERT INTO tmp_ds27_prices VALUES ('E 18 01 06 90000', 3.2740);
  INSERT INTO tmp_ds27_prices VALUES ('E 18 01 06 90001', 3.7495);
  INSERT INTO tmp_ds27_prices VALUES ('E 18 01 03 90000', 0.4334);
  INSERT INTO tmp_ds27_prices VALUES ('E 18 01 03 90001', 0.5372);
  INSERT INTO tmp_ds27_prices VALUES ('E 02 09 01 90000', 4.0904);
  INSERT INTO tmp_ds27_prices VALUES ('E 02 09 01 90001', 4.6575);
  INSERT INTO tmp_ds27_prices VALUES ('E 02 09 01 90002', 4.9143);
  INSERT INTO tmp_ds27_prices VALUES ('E 18 01 80 90000', 1.6259);
  INSERT INTO tmp_ds27_prices VALUES ('E 02 09 04 90000', 2.0098);
  INSERT INTO tmp_ds27_prices VALUES ('E 18 01 80 90002', 3.1421);
  INSERT INTO tmp_ds27_prices VALUES ('E 02 10 01 090029', 42.0990);
  INSERT INTO tmp_ds27_prices VALUES ('E 16 08 02 090006', 38.1305);
  INSERT INTO tmp_ds27_prices VALUES ('E 10 01 02 90000', 2.0442);
  INSERT INTO tmp_ds27_prices VALUES ('E 10 01 02 90001', 2.6745);
  INSERT INTO tmp_ds27_prices VALUES ('E 10 01 02 090004', 3.4924);
  INSERT INTO tmp_ds27_prices VALUES ('E 10 01 02 090005', 3.7466);
  INSERT INTO tmp_ds27_prices VALUES ('E 10 01 02 90002', 2.8227);
  INSERT INTO tmp_ds27_prices VALUES ('E 10 01 02 090006', 5.3109);
  INSERT INTO tmp_ds27_prices VALUES ('E 10 01 01 090000', 1.4739);
  INSERT INTO tmp_ds27_prices VALUES ('E 10 01 01 090001', 1.8497);
  INSERT INTO tmp_ds27_prices VALUES ('E 10 01 01 090002', 1.8497);
  INSERT INTO tmp_ds27_prices VALUES ('E 10 01 01 090003', 1.2410);
  INSERT INTO tmp_ds27_prices VALUES ('E 10 04 80 090000', 0.6942);
  INSERT INTO tmp_ds27_prices VALUES ('E 10 04 80 090001', 0.0814);
  INSERT INTO tmp_ds27_prices VALUES ('E 10 02 01 090000', 0.1727);
  INSERT INTO tmp_ds27_prices VALUES ('E 17 01 00 090000', 101.9646);
  INSERT INTO tmp_ds27_prices VALUES ('E 17 01 00 090001', 0.9925);
  INSERT INTO tmp_ds27_prices VALUES ('E 15 02 80 090000', 0.7502);
  INSERT INTO tmp_ds27_prices VALUES ('E 15 02 80 090001', 0.9226);
  INSERT INTO tmp_ds27_prices VALUES ('E 15 02 80 090002', 5.1386);
  INSERT INTO tmp_ds27_prices VALUES ('E 15 02 80 090003', 1.5445);
  INSERT INTO tmp_ds27_prices VALUES ('E 15 02 80 090004', 1.8168);
  INSERT INTO tmp_ds27_prices VALUES ('E 15 02 80 090005', 4.8048);
  INSERT INTO tmp_ds27_prices VALUES ('E 15 02 80 090006', 0.0196);
  INSERT INTO tmp_ds27_prices VALUES ('E 15 02 80 090007', 0.6254);
  INSERT INTO tmp_ds27_prices VALUES ('A 03 80 00 090040', 0.0343);
  INSERT INTO tmp_ds27_prices VALUES ('D 19 01 03 090002', 0.5822);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090219', 0.2511);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090218', 0.0623);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090217', 0.1186);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090216', 0.2881);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090215', 0.3333);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090214', 0.5580);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090213', 0.0869);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090212', 0.0719);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090211', 0.1042);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090210', 0.0626);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090209', 0.0498);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090208', 0.0519);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090207', 0.0519);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090206', 0.1665);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090205', 0.1087);
  INSERT INTO tmp_ds27_prices VALUES ('A 01 00 00 090204', 0.7296);
  INSERT INTO tmp_ds27_prices VALUES ('C 80 00 00 090006', 62.3009);
  INSERT INTO tmp_ds27_prices VALUES ('E 01 80 00 090000', 11.1016);
  INSERT INTO tmp_ds27_prices VALUES ('E 17 01 04 090003', 64.2704);
  INSERT INTO tmp_ds27_prices VALUES ('E 17 01 04 090004', 0.7294);
  INSERT INTO tmp_ds27_prices VALUES ('E 17 01 04 090005', 6.2537);
  INSERT INTO tmp_ds27_prices VALUES ('E 17 01 04 090006', 7.0700);
  INSERT INTO tmp_ds27_prices VALUES ('E 17 04 80 090000', 0.1796);
  INSERT INTO tmp_ds27_prices VALUES ('E 17 04 80 090001', 0.7094);
  INSERT INTO tmp_ds27_prices VALUES ('E 17 04 80 090002', 0.1206);

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
-- SELECT COUNT(*) FROM tempario_tasks;  -- Esperado: ~498
-- SELECT COUNT(*) FROM tempario_prices; -- Esperado: 498 × 15 = 7470
-- SELECT COUNT(*) FROM tempario_prices WHERE currency_code='UF'; -- = total
