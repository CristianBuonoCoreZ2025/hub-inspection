-- ═══════════════════════════════════════════════════════════════
-- 230: Eliminar precios CLP del tempario
--
-- El DS27 (MINVU) publica precios en UF, no en CLP. El CLP que se
-- guardó en la migración 228/229 era una conversión matemática con
-- la UF de jul-2026 ($40.798,57), que se desactualiza diariamente.
--
-- Ahora el tempario guarda SOLO UF (lo que publica el MINVU).
-- El CLP se calcula en runtime con la UF vigente del día, consultando
-- la tabla exchange_rates (alimentada por mindicador.cl).
--
-- Fórmula runtime: CLP = precio_uf × factor_zonal × UF_hoy
--
-- Esta migración borra SOLO las filas CLP de tempario_prices.
-- Preserva todos los precios UF (795 filas = 53 tasks × 15 regiones).
-- No toca tasks/chapters/subchapters.
-- ═══════════════════════════════════════════════════════════════

DELETE FROM tempario_prices WHERE currency_code = 'CLP';

-- Verificación:
-- SELECT currency_code, COUNT(*) FROM tempario_prices GROUP BY currency_code;
-- Esperado: UF = 795, CLP = 0
