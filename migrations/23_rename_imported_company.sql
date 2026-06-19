-- ============================================================
-- Hub Inspections — Migracion 23: Renombrar empresa importada a McLarens
-- ============================================================

UPDATE companies
SET name = 'McLarens',
    slug = 'mclarens'
WHERE name = 'Empresa Importada'
   OR slug = 'empresa-importada';
