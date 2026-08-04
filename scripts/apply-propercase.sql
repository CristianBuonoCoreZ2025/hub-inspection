-- Script: aplicar proper_case a datos existentes
--
-- ANTES DE CORRER EN PRODUCCIÓN:
-- 1. Hacer backup de la tabla a actualizar.
-- 2. Probar en staging/dev.
-- 3. Revisar que las funciones proper_case() (migración 324) y
--    proper_address() (migración 334) existan.
--
-- Uso:
-- psql $DATABASE_URL -f scripts/apply-propercase.sql
--
-- Si solo querés simular, cambia UPDATE por SELECT proper_case(...) o proper_address(...).

-- Perfiles
UPDATE profiles
SET full_name = proper_case(full_name)
WHERE full_name IS NOT NULL
  AND full_name <> proper_case(full_name);

-- Compañías aseguradoras / empresas
UPDATE companies
SET name = proper_case(name)
WHERE name IS NOT NULL
  AND name <> proper_case(name);

-- Siniestros
UPDATE claims
SET claim_address = proper_address(claim_address)
WHERE claim_address IS NOT NULL
  AND claim_address <> proper_address(claim_address);

-- Participantes de siniestros
UPDATE claims_participants
SET full_name = proper_case(full_name),
    first_name = proper_case(first_name),
    last_name = proper_case(last_name),
    address = proper_address(address)
WHERE full_name IS NOT NULL
   OR first_name IS NOT NULL
   OR last_name IS NOT NULL
   OR address IS NOT NULL;

-- Maestro de personas
UPDATE persons
SET first_name = proper_case(first_name),
    last_name = proper_case(last_name)
WHERE first_name IS NOT NULL
   OR last_name IS NOT NULL;

-- Direcciones de personas
UPDATE person_addresses
SET address = proper_address(address)
WHERE address IS NOT NULL
  AND address <> proper_address(address);

-- Inspecciones: nombre del entrevistado
UPDATE inspection_sessions
SET interviewed_name = proper_case(interviewed_name)
WHERE interviewed_name IS NOT NULL
  AND interviewed_name <> proper_case(interviewed_name);

-- Agregar más tablas/columnas según sea necesario.
