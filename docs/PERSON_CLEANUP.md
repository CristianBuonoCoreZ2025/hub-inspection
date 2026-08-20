# Plan de limpieza de la tabla `persons`

> Fecha: 2026-08-17
> Estado: **SOLO MD — sin implementación ejecutada**
> Objetivo: Dejar `persons` limpia y preparada para luego relacionarla con `claims_participants` (solo personas naturales).

---

## 1. Contexto

La tabla `persons` (`src/services/persons.ts`) está actualmente **desconectada** del flujo de `claims_participants`. `createClaimParticipant` inserta directamente en `claims_participants`, por lo que:

- `persons` no recibe nuevos registros desde las cargas de siniestros/casos.
- Los datos que existen en `persons` pueden estar duplicados, mal formateados o incompletos.
- No hay una fuente única de verdad para una persona (asegurado, contratante, beneficiario, contacto).

Este MD propone una limpieza controlada de `persons` **sin borrar datos sin autorización** y sin tocar `claims_participants` todavía.

---

## 2. Reglas de oro

1. **NO borrar datos sin autorización explícita.**
2. **NO tocar `claims_participants` en esta fase.**
3. **Trabajar con backups / scripts reversibles.**
4. **Documentar cada cambio en el changelog.**

---

## 3. Fases del plan

### Fase 1 — Diagnóstico (solo lectura)

Antes de cualquier cambio, extraer métricas de la tabla `persons`:

```sql
-- Total de registros
SELECT COUNT(*) FROM persons;

-- Duplicados por tax_id (mismo RUT)
SELECT tax_id, COUNT(*) 
FROM persons 
GROUP BY tax_id 
HAVING COUNT(*) > 1;

-- Personas sin tax_id o con tax_id vacío
SELECT COUNT(*) FROM persons WHERE tax_id IS NULL OR tax_id = '';

-- Distribución por person_type
SELECT person_type, COUNT(*) FROM persons GROUP BY person_type;

-- Personas con nombres extraños o vacíos
SELECT id, first_name, last_name, business_name, tax_id 
FROM persons 
WHERE (first_name IS NULL OR first_name = '') 
   AND (last_name IS NULL OR last_name = '')
   AND (business_name IS NULL OR business_name = '');

-- Tax_id con formato inconsistente (puntos, guiones, espacios)
SELECT tax_id FROM persons 
WHERE tax_id ~ '[\.\s-]' OR tax_id !~ '^[0-9Kk]+$';
```

### Fase 2 — Backup

Antes de cualquier modificación, crear una tabla de respaldo:

```sql
CREATE TABLE persons_backup_20260817 AS 
SELECT * FROM persons;

CREATE TABLE person_addresses_backup_20260817 AS 
SELECT * FROM person_addresses;
```

### Fase 3 — Normalización de `tax_id`

Objetivo: dejar todos los RUTs en formato estándar (sin puntos, sin guiones, sin espacios, mayúsculas).

```sql
-- Actualizar tax_id con formato limpio
UPDATE persons
SET tax_id = UPPER(REGEXP_REPLACE(tax_id, '[\.\s-]', '', 'g'))
WHERE tax_id IS NOT NULL AND tax_id != '';
```

Reglas:
- El dígito verificador puede ser `0-9` o `K`.
- Se conserva el `tax_id` completo con DV (ej: `176981032`).
- El cuerpo del RUT se extrae con `rutBodyNumber()` cuando se necesita para validación de `person_type`.

### Fase 4 — Separar naturales y jurídicas

```sql
UPDATE persons
SET person_type = 'legal'
WHERE (
  -- RUT con cuerpo >= 60.000.000
  (NULLIF(REGEXP_REPLACE(SPLIT_PART(tax_id, '-', 1), '\D', '', 'g'), '')::bigint >= 60000000)
  OR 
  -- Tiene business_name y no first_name
  (business_name IS NOT NULL AND business_name != '' AND (first_name IS NULL OR first_name = ''))
);

UPDATE persons
SET person_type = 'natural'
WHERE person_type != 'legal' OR person_type IS NULL;
```

### Fase 5 — Consolidar duplicados por `tax_id`

Para cada RUT duplicado, elegir el registro más completo (con nombre y direcciones) y marcar los demás como `merged_into` o prepararlos para eliminación suave.

```sql
-- Crear tabla de mapeo de duplicados
CREATE TABLE persons_duplicates_map (
  duplicate_id UUID PRIMARY KEY,
  canonical_id UUID,
  reason TEXT
);

-- Lógica (pseudocódigo):
-- 1. Para cada tax_id con múltiples filas:
--    1.1 Elegir la fila con más campos completos como "canónica".
--    1.2 Mover direcciones de las filas duplicadas a la canónica.
--    1.3 Registrar en persons_duplicates_map.
```

**Pendiente de decisión:**
- ¿Eliminar filas duplicadas (`DELETE`) o marcarlas con `status = 'merged'`?
- Respuesta recomendada: **no borrar**, solo marcar. Si se quiere borrar, debe ser una decisión explícita del usuario.

### Fase 6 — Normalización de nombres

- `first_name`: trim, quitar espacios múltiples, título de palabra.
- `last_name`: trim, quitar espacios múltiples.
- `business_name`: trim, mayúsculas iniciales según corresponda.

```sql
UPDATE persons
SET first_name = INITCAP(TRIM(REGEXP_REPLACE(first_name, '\s+', ' ', 'g')))
WHERE first_name IS NOT NULL AND first_name != '';

UPDATE persons
SET last_name = INITCAP(TRIM(REGEXP_REPLACE(last_name, '\s+', ' ', 'g')))
WHERE last_name IS NOT NULL AND last_name != '';
```

### Fase 7 — Validar consistencia

```sql
-- Personas con person_type = 'natural' pero sin first_name y last_name
SELECT id, tax_id FROM persons 
WHERE person_type = 'natural' 
  AND (first_name IS NULL OR first_name = '' OR last_name IS NULL OR last_name = '');

-- Personas con person_type = 'legal' pero sin business_name
SELECT id, tax_id FROM persons 
WHERE person_type = 'legal' 
  AND (business_name IS NULL OR business_name = '');

-- Tax_id con DV inválido
SELECT id, tax_id FROM persons 
WHERE NOT validate_rut(tax_id); -- si existe la función
```

---

## 4. Relación futura con `claims_participants`

### Alcance

- Relacionar **solo personas naturales** de `claims_participants` con `persons`.
- No tocar `claims_participants` en esta fase.

### Estrategia propuesta

1. Después de limpiar `persons`, agregar una columna `person_id` a `claims_participants` (nullable).
2. Para cada `claims_participants` con `person_type = 'natural'` y `rut` no nulo:
   1. Buscar en `persons` por `tax_id` (normalizado).
   2. Si existe → asignar `person_id`.
   3. Si no existe → crear una `persons` a partir de los datos de `claims_participants`.
3. Para personas jurídicas: **no relacionar en esta fase** (los datos de `claims_participants` para jurídicas tienen fallas que se resolverán después).

```sql
ALTER TABLE claims_participants 
ADD COLUMN person_id UUID REFERENCES persons(id);

-- Backfill solo naturales
UPDATE claims_participants cp
SET person_id = p.id
FROM persons p
WHERE cp.person_type = 'natural'
  AND cp.rut IS NOT NULL
  AND p.tax_id = UPPER(REGEXP_REPLACE(cp.rut, '[\.\s-]', '', 'g'));
```

### Nota importante

- **NO ejecutar el backfill hasta que `persons` esté limpia.**
- **NO borrar registros de `claims_participants`.**
- Cualquier cambio debe ser reversible desde el backup.

---

## 5. Checklist

- [ ] Ejecutar scripts de diagnóstico (solo lectura).
- [ ] Crear backups `persons_backup_20260817` y `person_addresses_backup_20260817`.
- [ ] Normalizar `tax_id`.
- [ ] Clasificar `person_type` (natural/legal).
- [ ] Consolidar duplicados por `tax_id` (sin borrar, marcar/mapear).
- [ ] Normalizar nombres.
- [ ] Validar consistencia de datos.
- [ ] Revisar con el usuario antes de relacionar con `claims_participants`.

---

## 6. Preguntas pendientes

1. **¿Podemos hacer backup de `persons` y `person_addresses` ahora?**
2. **¿Eliminamos duplicados o solo los marcamos?**
3. **¿Incluimos personas jurídicas en la limpieza o solo naturales?**
4. **¿Se agrega `person_id` a `claims_participants` con una migración o se deja para una fase posterior?**
5. **¿Existe una función `validate_rut` en la base o hay que usar la de TypeScript (`lib/validations/rut.ts`)?**

---

## 7. Aclaraciones

- Este es un plan pre-implementación.
- No se ejecutará ningún `UPDATE`, `DELETE` ni `ALTER` sin aprobación explícita.
- Se prioriza la no eliminación de datos.
- `claims_participants` no se toca en esta fase.
