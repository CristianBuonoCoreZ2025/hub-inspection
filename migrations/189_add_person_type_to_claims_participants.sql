-- ============================================================
-- Hub Inspections — Migracion 189: Agregar person_type a claims_participants
--
-- Antecedentes:
--   - El codigo (edit-claim-form.tsx) ya escribe person_type ('legal' | 'natural')
--     a claims_participants, pero la columna NO existe en la tabla.
--   - Esto causaba que el campo se ignorara silenciosamente al guardar.
--   - Las pantallas de inspeccion/coordinacion necesitan mostrar el tipo de
--     persona (Natural/Juridica) del asegurado.
--
-- Accion:
--   - Agregar columna person_type a claims_participants.
--   - Default 'natural' (preserva datos existentes: todos los registros
--     existentes quedan como 'natural' a menos que se actualicen).
--   - No borra ni modifica datos existentes (regla #1 del proyecto).
--
-- Tabla afectada: claims_participants
-- Tipo de cambio: ADD COLUMN (no destructivo)
-- ============================================================

ALTER TABLE claims_participants
  ADD COLUMN IF NOT EXISTS person_type TEXT NOT NULL DEFAULT 'natural';

-- Comentario
COMMENT ON COLUMN claims_participants.person_type IS 'Tipo de persona: natural (persona natural) o legal (persona juridica)';

-- Indice opcional para filtrar por tipo de persona
CREATE INDEX IF NOT EXISTS idx_cp_person_type ON claims_participants(person_type);
