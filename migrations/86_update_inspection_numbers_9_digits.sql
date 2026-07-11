-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 86: Actualizar inspection_numbers a 9 dígitos
--
-- El liquidation_number cambió de 7 a 9 dígitos (L-0000001 → L-000000001).
-- Los inspection_numbers existentes tienen el formato viejo:
--   L-0000001-I-001  →  L-000000001-I-001
-- ═══════════════════════════════════════════════════════════════

-- Actualizar inspection_numbers: reemplazar el liquidation_number embebido
-- Formato: {liquidation_number}-I-{seq:3}
-- Extraer el número, rellenar a 9 dígitos, reconstruir
UPDATE inspection_sessions
  SET inspection_number = 'L-' || LPAD(
    SUBSTRING(inspection_number FROM 3 FOR POSITION('-I-' IN inspection_number) - 3),
    9, '0'
  ) || SUBSTRING(inspection_number FROM POSITION('-I-' IN inspection_number))
  WHERE inspection_number ~ '^L-[0-9]+-I-[0-9]+$'
    AND LENGTH(SUBSTRING(inspection_number FROM 3 FOR POSITION('-I-' IN inspection_number) - 3)) < 9;
