-- ═══════════════════════════════════════════════════════════════════
-- Migración 258: Agregar columna `color` a la tabla `characteristic`
-- ═══════════════════════════════════════════════════════════════════
-- Permite asignar un color (hex) configurable a cada característica
-- (COB, RES, CIN, INS, etc.) para identificarlas visualmente en la grilla
-- del siniestro, similar al header_color de los email templates.
--
-- El color se usa en el badge del código de gestión en la grilla.
-- ═══════════════════════════════════════════════════════════════════

-- Agregar columna color (nullable, formato hex como #0095DA)
ALTER TABLE characteristic
  ADD COLUMN IF NOT EXISTS color text DEFAULT NULL;

-- Comentario para documentación
COMMENT ON COLUMN characteristic.color IS 'Color hex (ej: #0095DA) para identificar visualmente la característica en la grilla del siniestro';

-- RLS ya existe en characteristic, no necesita cambios adicionales
-- (la columna hereda las políticas existentes)
