-- ═══════════════════════════════════════════════════════════════
-- Migration 265: Setear país=Chile y moneda=UF en todas las pólizas
--
-- Solicitado explícitamente por el usuario:
--   "a todas las polizas colocale pais chile en la base de datos
--    y moneda UF"
--
-- Operación: UPDATE sobre policies (no elimina datos, solo setea
-- country_id y currency). Cumple REGLA #1 (no se borra nada).
--
-- - country_id se obtiene por código 'CL' (no asume UUID).
-- - currency se setea a 'UF' (ya existe en catálogo currencies,
--   migración 167).
-- ═══════════════════════════════════════════════════════════════

UPDATE policies
SET
  country_id = (SELECT id FROM countries WHERE code = 'CL' LIMIT 1),
  currency   = 'UF'
WHERE
  country_id IS DISTINCT FROM (SELECT id FROM countries WHERE code = 'CL' LIMIT 1)
  OR currency IS DISTINCT FROM 'UF';
