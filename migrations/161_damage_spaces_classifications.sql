-- ═══════════════════════════════════════════════════════════════
-- Migración 161: Asociar espacios con clasificaciones de inmueble
-- ═══════════════════════════════════════════════════════════════
--
-- Agrega columna applicable_classifications (TEXT[]) a damage_spaces
-- para filtrar espacios según el tipo de inmueble (Casa, Departamento,
-- Oficinas, Galpón, Maquinaria, Edificio, Otros).
--
-- "Otros" aparece en TODAS las clasificaciones (fallback).
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columna
ALTER TABLE damage_spaces
  ADD COLUMN IF NOT EXISTS applicable_classifications TEXT[] DEFAULT ARRAY['Otros']::TEXT[];

COMMENT ON COLUMN damage_spaces.applicable_classifications IS
  'Clasificaciones de inmueble donde aplica este espacio. Array de nombres de property_classifications.';

-- 2. Asignar espacios a cada clasificación
-- Casa
UPDATE damage_spaces SET applicable_classifications = ARRAY['Casa', 'Otros']
WHERE name IN ('Cocina', 'Baño', 'Dormitorio Principal', 'Dormitorio Secundario',
  'Living / Comedor', 'Pasillo', 'Hall', 'Lavadero', 'Bodega', 'Garage',
  'Exterior', 'Terraza', 'Azotea', 'Sótano', 'Escaleras', 'Otro');

-- Departamento
UPDATE damage_spaces SET applicable_classifications = ARRAY['Departamento', 'Otros']
WHERE name IN ('Cocina', 'Baño', 'Dormitorio Principal', 'Dormitorio Secundario',
  'Living / Comedor', 'Pasillo', 'Hall', 'Lavadero', 'Bodega',
  'Terraza', 'Área Común', 'Estacionamiento Común', 'Escaleras', 'Otro');

-- Edificio
UPDATE damage_spaces SET applicable_classifications = ARRAY['Edificio', 'Otros']
WHERE name IN ('Pasillo', 'Hall', 'Escaleras', 'Recepción', 'Área Común',
  'Exterior', 'Azotea', 'Sótano', 'Estacionamiento Común', 'Baño', 'Oficina',
  'Sala Reuniones', 'Bodega', 'Otro');

-- Galpón
UPDATE damage_spaces SET applicable_classifications = ARRAY['Galpón', 'Otros']
WHERE name IN ('Bodega Industrial', 'Pasillo', 'Hall', 'Exterior', 'Baño',
  'Oficina', 'Azotea', 'Otro');

-- Maquinaria
UPDATE damage_spaces SET applicable_classifications = ARRAY['Maquinaria', 'Otros']
WHERE name IN ('Exterior', 'Bodega Industrial', 'Pasillo', 'Otro');

-- Oficinas
UPDATE damage_spaces SET applicable_classifications = ARRAY['Oficinas', 'Otros']
WHERE name IN ('Oficina', 'Sala Reuniones', 'Recepción', 'Baño', 'Pasillo',
  'Hall', 'Bodega', 'Escaleras', 'Exterior', 'Cocina', 'Otro');

-- "Otro" espacio: aplica a todo
UPDATE damage_spaces SET applicable_classifications = ARRAY['Casa', 'Departamento', 'Edificio', 'Galpón', 'Maquinaria', 'Oficinas', 'Otros']
WHERE name = 'Otro';

-- 3. Espacios compartidos (aparecen en múltiples clasificaciones)
-- Baño: aparece en casi todos
UPDATE damage_spaces SET applicable_classifications = ARRAY['Casa', 'Departamento', 'Edificio', 'Galpón', 'Oficinas', 'Otros']
WHERE name = 'Baño';

-- Pasillo: aparece en todos
UPDATE damage_spaces SET applicable_classifications = ARRAY['Casa', 'Departamento', 'Edificio', 'Galpón', 'Maquinaria', 'Oficinas', 'Otros']
WHERE name = 'Pasillo';

-- Hall: aparece en todos
UPDATE damage_spaces SET applicable_classifications = ARRAY['Casa', 'Departamento', 'Edificio', 'Galpón', 'Maquinaria', 'Oficinas', 'Otros']
WHERE name = 'Hall';

-- Exterior: aparece en todos
UPDATE damage_spaces SET applicable_classifications = ARRAY['Casa', 'Departamento', 'Edificio', 'Galpón', 'Maquinaria', 'Oficinas', 'Otros']
WHERE name = 'Exterior';

-- Escaleras: casa, depto, edificio, oficinas
UPDATE damage_spaces SET applicable_classifications = ARRAY['Casa', 'Departamento', 'Edificio', 'Oficinas', 'Otros']
WHERE name = 'Escaleras';

-- Cocina: casa, depto, oficinas (oficinas tiene kitchenette)
UPDATE damage_spaces SET applicable_classifications = ARRAY['Casa', 'Departamento', 'Oficinas', 'Otros']
WHERE name = 'Cocina';

-- Bodega: casa, depto, edificio, oficinas
UPDATE damage_spaces SET applicable_classifications = ARRAY['Casa', 'Departamento', 'Edificio', 'Oficinas', 'Otros']
WHERE name = 'Bodega';

-- Bodega Industrial: galpón, maquinaria, edificio
UPDATE damage_spaces SET applicable_classifications = ARRAY['Edificio', 'Galpón', 'Maquinaria', 'Otros']
WHERE name = 'Bodega Industrial';

-- Oficina (el espacio): galpón, edificio, oficinas
UPDATE damage_spaces SET applicable_classifications = ARRAY['Edificio', 'Galpón', 'Oficinas', 'Otros']
WHERE name = 'Oficina';

-- Azotea: casa, depto, edificio, galpón
UPDATE damage_spaces SET applicable_classifications = ARRAY['Casa', 'Departamento', 'Edificio', 'Galpón', 'Otros']
WHERE name = 'Azotea';

-- Sótano: casa, depto, edificio
UPDATE damage_spaces SET applicable_classifications = ARRAY['Casa', 'Departamento', 'Edificio', 'Otros']
WHERE name = 'Sótano';

-- 3b. Corregir espacios que se sobreescribieron (casa también)
UPDATE damage_spaces SET applicable_classifications = ARRAY['Casa', 'Departamento', 'Otros']
WHERE name IN ('Dormitorio Principal', 'Dormitorio Secundario', 'Living / Comedor', 'Lavadero', 'Terraza', 'Garage');

UPDATE damage_spaces SET applicable_classifications = ARRAY['Departamento', 'Edificio', 'Otros']
WHERE name IN ('Área Común', 'Estacionamiento Común');

-- 4. Verificar
SELECT name, applicable_classifications FROM damage_spaces ORDER BY name;
