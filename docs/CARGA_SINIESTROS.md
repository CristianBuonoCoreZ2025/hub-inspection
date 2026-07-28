# Carga Masiva de Siniestros — Documentación

> Flujo de importación de siniestros desde Excel a la base de datos.
> **LEER OBLIGATORIAMENTE antes de tocar cualquier archivo de carga masiva.**

---

## ⚠️ REGLA CRÍTICA — NUNCA borrar claims cargados

Una vez que el primer Excel se cargue exitosamente, **NO se pueden borrar los claims**.
Los siniestros importados son datos de producción. Borrarlos es equivalente a borrar
la tabla de claims con todas las gestiones: **mata la empresa**.

El reset de claims (`scripts/reset-claims.mjs`) solo se usó durante el desarrollo
inicial para probar el flujo. **Ese script NO debe ejecutarse en producción.**

Si necesitas corregir un siniestro mal cargado:
1. Editarlo individualmente desde la pantalla de detalle del siniestro
2. O deshabilitarlo (campo `disabled=true`) — nunca borrarlo

---

## Ubicación de Archivos

| Archivo | Descripción |
|---------|-------------|
| `src/app/dashboard/operaciones/carga-siniestros/page.tsx` | Página principal del importador (UI + lógica) |
| `src/lib/claim-import/schema.ts` | Definición de campos, sinónimos, autodetección, validación |
| `src/services/claims.ts` | `createClaimMinimal` + funciones de staging |
| `src/services/import-mappings.ts` | Service de aprendizaje (field/value/fixed mappings) |
| `src/app/styles/components.css` | Clases CSS del mapper y staging (`.bulk-*`, `.staging-*`) |
| `migrations/100_import_mappings.sql` | Tablas `import_field_mappings` + `import_value_mappings` |
| `migrations/101_import_fixed_values.sql` | Tabla `import_fixed_values` |

---

## Flujo de Importación (9 pasos)

> **PRINCIPIO FUNDAMENTAL:** El orden es estricto. Cada paso depende del anterior.
> No se puede resolver un valor antes de saber a qué campo apunta.
> "Baja" puede ser estatura, riesgo crediticio o daño de un bien — solo sabiendo
> el campo se sabe en qué catálogo buscar.

```
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│ 1.Upload│─▶│2.Preview│─▶│3.Fixed  │─▶│4.Mapeo  │─▶│5.Valores│
│  Excel  │  │Headers  │  │ Values  │  │ Campos  │  │Homolog. │
└─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘
                                                      │
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│9.Log    │◀─│8.Pasar  │◀─│7.Ajuste │◀─│6.Staging│◀───┘
│Resumen  │  │Prod.    │  │Fixed    │  │Temporales│
└─────────┘  └─────────┘  └───┬─────┘  └────┬────┘
                             │              │
                             └───── ◀ ─────┘
                              ciclo iterativo
                              (no empezar de nuevo)
```

### Paso 1 — Seleccionar Excel
- Usuario arrastra o selecciona archivo `.xlsx` / `.xls`
- No se procesa nada todavía, solo se lee el archivo

### Paso 2 — Preview de cabeceras + muestra
- El sistema lee el Excel y muestra:
  - Lista de **cabeceras** detectadas
  - **Primer valor no vacío** de cada columna (muestra de datos)
- Botón/toggle/notificación: "Excel leído: 25 columnas, 3000 filas. Revisar."
- **Propósito:** el usuario ve qué trajo el Excel sin abrirlo
- No se hace ningún mapeo todavía

### Paso 3 — Agregar valores fijos (ANTES de mapear)
- El usuario ya vio las cabeceras y sabe qué **NO** viene en el Excel
- Agrega valores fijos para campos que faltan:
  - `auditor` = Juan Pérez (combo de profiles)
  - `despachador` = María López (combo de profiles)
  - `insuranceCompany` = Santander (combo de insurance_companies)
- **Para campos de referencia:** combo del catálogo (no texto libre)
- **Para campos de fecha:** calendario o "imitar otro campo + offset" (ver nota abajo)
- **Para campos de texto:** input de texto libre
- Los fixed values se cargan desde la DB (aprendizaje) y se pueden editar
- **Propósito:** setear defaults antes de mapear, así el mapeo es solo lo que viene del Excel

### Paso 4 — Mapeo de campos (columnas Excel → campos sistema)
- El sistema renderiza la tabla de mapeo:
  - Filas = columnas del Excel (con muestra de cada una)
  - Dropdown = campos del sistema disponibles
- **Autodetección con aprendizaje:**
  - **Pasada 0:** mapeos aprendidos de importaciones anteriores (confianza 1)
  - **Pasada 1:** match exacto de sinónimos
  - **Pasada 2:** fuzzy matching
- El usuario ajusta lo que no esté bien
- **Opción: omitir columna** — si una columna viene mala (ej: comuna mal escrita en 3000 filas), el usuario la deja sin mapear y no se importa ni se analiza
- **Botón "Mapear campos"** → confirma el mapeo
- **Propósito:** saber a qué campo del sistema apunta cada columna del Excel

### Paso 5 — Homologación de valores (DESPUÉS de mapear)
> **CRÍTICO:** Este paso solo se ejecuta después de que el mapeo de campos está confirmado.
> Solo sabiendo que la columna "Comuna Asegurado" → `commune` (asegurado),
> se puede ir a buscar al catálogo `communes` los valores correctos.

- El sistema analiza los valores del Excel **por cada campo mapeado**:
  - Para cada campo de referencia (UUID → catálogo), extrae los valores distinct
  - Intenta resolver cada valor contra el catálogo correspondiente:
    1. UUID directo
    2. Mapeo aprendido (import_value_mappings)
    3. Mapeo manual del usuario (valueMappings)
    4. Match exacto normalizado en el catálogo
  - Los que **no se encuentran** se muestran en el panel de homologación:
    - "Comuna 'SANTIAGO ESTE' no encontrada en catálogo `communes`"
    - El usuario la mapea al UUID correcto o decide omitirla
- **Auto-guardado:** cada homologación que hace el usuario se guarda automáticamente
  en `import_value_mappings` (sin esperar a confirmar la importación)
  - Así si el usuario se equivoca y vuelve, no tiene que rehacerlo
  - Sin duplicar asociaciones (UNIQUE constraint)
- **Propósito:** que cada valor del Excel tenga su UUID del catálogo correcto

### Paso 6 — Cargar a tablas temporales (staging)
- Click **"Cargar"** → `loadMutation`:
  - `cleanStaging(companyId)` — borra staging anterior (auto-limpieza)
  - Inserta todas las filas en `claims_staging` con `raw_data` = datos parseados + UUIDs resueltos
  - Valida cada row: required fields, UUIDs, fechas normalizadas
  - Marca cada row como `valid` o `error`
- Se muestra tabla de staging con estado por fila:
  - **verde** = válido
  - **rojo** = error (con mensaje)
- **Las temporales son un espejo de claims, claims_participants, etc.**
- **Auto-limpieza:** si el usuario vuelve a subir otro Excel o se va de la página,
  las temporales se borran solas. Solo están vivas mientras el usuario está en la pantalla.

> **CICLO ITERATIVO (6 ↔ 7):** Si el staging muestra muchos errores, el usuario
> **NO empieza de nuevo**. Hace las correcciones (paso 7: ajustar fixed values,
> omitir columnas, homologar valores) y **vuelve a cargar a staging** (paso 6)
> para ver cuántos errores bajaron. Repite hasta que los errores sean cero o
> aceptables. Solo entonces pasa a producción (paso 8).
>
> ```
> 6.Staging → "500 errores" → 7.Ajuste → 6.Staging → "50 errores" → 7.Ajuste → 6.Staging → "0 errores" → 8.Producción
> ```
>
> El Excel **no se vuelve a subir** — se re-procesa con las correcciones hechas.
> El staging se reemplaza (cleanStaging + insert nuevo) en cada iteración.

### Paso 7 — Ajuste de fixed values y homologaciones (durante revisión)
- El usuario revisa el staging y puede decidir:
  - "La columna X viene mala en todos los casos" → omitirla y agregar un fixed value
  - Ej: 3000 casos con comuna mala → omitir columna `commune` del Excel
    y setear fixed value `commune` = "SANTIAGO" para todos
  - La columna omitida **no se importa ni se analiza** (no aparece en homologación)
  - El fixed value se aplica a todas las filas
- También puede agregar nuevos fixed values que no había puesto en el paso 3
- Puede ajustar homologaciones de valores que no se resolvieron
- Después de ajustar → **vuelve al paso 6** (re-cargar staging) para ver el resultado
- **Propósito:** corrección masiva sin homologar 3000 casos uno por uno

### Paso 8 — Pasar a producción
- Click **"Confirmar"** → `confirmMutation`:
  - Para cada row `valid`: llama `createClaimMinimal()` → crea claim + participants
  - Marca cada row como `imported` (con `claim_id` + `processed_at`) o `error`
  - **0 errores** → `cleanStaging()` borra todo el staging
  - **Con errores** → borra solo los importados, deja los con error
- Guarda el aprendizaje (field mappings, value mappings, fixed values)
- **Propósito:** los datos pasan de staging a claims (producción)

### Paso 9 — Log de importación
- Se guarda un **log del proceso de importación**:
  - Fecha/hora de la importación
  - Empresa (company_id)
  - Usuario que ejecutó
  - Cantidad de registros importados
  - Cantidad de errores
  - **Lista de números de liquidación** asociados (L-000000123, L-000000124, ...)
  - Resumen de qué se importó
- **Propósito:** saber que un caso se creó por importación/carga masiva
  y tener trazabilidad de qué números de liquidación se generaron
- Tabla: `import_logs` (ver sección "Tabla import_logs" abajo)

---

## Nota sobre campos compuestos (fecha = otro campo + offset)

Para campos que **no son de catálogo** (ej: fechas), el sistema ofrece:

1. **Calendario** — seleccionar una fecha fija
2. **Imitar otro campo** — copiar el valor de otro campo mapeado del Excel
   - Con offset opcional: `+1 día`, `-1 mes`, etc.
   - Ej: `assignmentDate` = `createdAt` + 1 día
   - **El campo original sigue disponible para mapear** porque lo que se asignó
     al campo destino es una **operación**, no el campo en crudo
   - Ej: si `assignmentDate` = `createdAt + 1 día`, el campo `createdAt`
     del Excel sigue libre para mapearlo a `createdAt` del sistema

Esto permite operaciones como:
- `assignmentDate` = `claimDate` + 2 días
- `reportDate` = `claimDate` (mismo valor)
- `policyEndDate` = `policyStartDate` + 1 año

---

## Auto-limpieza de tablas temporales

- `claims_staging` se **borra automáticamente** cuando:
  1. El usuario sube un nuevo Excel (antes de cargar el nuevo)
  2. El usuario se va de la página (opcional, via cleanup)
  3. La importación se completa exitosamente (0 errores)
- **Solo están vivas mientras el usuario está en la pantalla**
- Si el usuario vuelve a entrar, ve la pantalla de upload limpia
- `cleanStaging(companyId)` borra solo los rows de la empresa del usuario

---

## Tabla `claims_staging`

Estructura existente en la base de datos:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | ID único del row temporal |
| `company_id` | uuid | Empresa (tenant) del usuario |
| `raw_data` | jsonb | Todos los datos parseados del Excel + UUIDs resueltos |
| `status` | text | `pending` → `valid` / `error` → `imported` |
| `error_message` | text | Mensaje de error si `status=error` |
| `claim_id` | uuid | ID del claim creado si `status=imported` |
| `processed_at` | timestamptz | Fecha de procesamiento |
| `created_at` | timestamptz | Fecha de creación (auto) |
| `updated_at` | timestamptz | Fecha de actualización (auto) |

**RLS:** `claims_staging` tiene `company_id` para filtrar por empresa.

---

## Campos del Excel → Base de Datos

### Campos OBLIGATORIOS (required=true)

| Campo Excel | Campo claims | Tipo | Notas |
|---|---|---|---|
| N° Siniestro | `claim_number` | text NOT NULL | |
| N° Póliza | `policy_number` | text NOT NULL | |
| Fecha Siniestro | `claim_date` | date NOT NULL | Normalizada a YYYY-MM-DD |
| Tipo Siniestro | `claim_type_id` | uuid → `claim_types` | Resuelto por nombre |
| Empresa / Cía Seguros | `insurance_company_id` | uuid → `insurance_companies` | Resuelto por nombre |
| Nombre Asegurado | `claims_participants.first_name` | text | Tipo `insured` |
| Dirección Asegurado | `claims_participants.address` | text | |
| Ciudad Asegurado | `claims_participants.city` | text | |

### Campos OPCIONALES — Claims (texto/fecha/numero/boolean)

| Campo Excel | Campo claims | Tipo | Notas |
|---|---|---|---|
| Resumen Siniestro | `summary` | text | |
| Fecha Denuncio | `report_date` | date | |
| Fecha Asignación | `assignment_date` | date | |
| Fecha Creación | `created_at` | timestamptz | Solo se sobreescribe si viene valor; si no, usa `default=now()`. Útil para siniestros históricos importados. |
| No. Siniestro Compañía | `company_report_number` | text | N° de reporte/denuncio de la cia |
| N° McLarens One | `internal_number` | text | N° interno (no es automático) |
| Referencia Cliente | `client_reference` | text | |
| Ramo/Item Póliza | `policy_item` | text | |
| Fecha Inicio Póliza | `policy_start_date` | date | |
| Fecha Fin Póliza | `policy_end_date` | date | |
| Monto Asegurado Póliza | `policy_amount` | numeric | |
| Prima Anual | `policy_premium` | numeric | |
| Siniestro Especial | `is_special_claim` | boolean | |
| Ejecutivo Cia | `broker_executive` | text | |
| Propietario / Asegurado | `owner_same_as_insured` | boolean | |
| Recuperación Legal | `recovery_type_legal` | boolean | |
| Recuperación Material | `recovery_type_material` | boolean | |
| Comentarios Recuperación | `recovery_comments` | text | |
| Latitud Siniestro | `claim_latitude` | double precision | |
| Longitud Siniestro | `claim_longitude` | double precision | |

### Campos OPCIONALES — Claims (UUID → catálogo, se pide el NOMBRE y se resuelve)

| Campo Excel | Campo claims | Catálogo | Tabla | Filas |
|---|---|---|---|---|
| Causal Siniestro | `claim_cause_id` | `claim_causes` | `claim_causes` | 12 |
| Estatus | `status_id` | `lookup_catalog` (claim_status) | `lookup_catalog` | 5 |
| Línea Negocio | `business_line_id` | `business_lines` | `business_lines` | 5 |
| Moneda Póliza | `currency_id` | `currencies` | `currencies` | 18 |
| Destino | `destination_housing_id` | `housing_destinations` | `housing_destinations` | 2 |
| Clasif. Daño | `damage_classification_id` | `damage_classifications` | `damage_classifications` | 4 |
| Ramo/Producto | `insurance_product_id` | `insurance_products` | `insurance_products` | 5 |
| Evento | `event_id` | `events` | `events` | 10 |
| Corredor | `broker_id` | `brokers` | `brokers` | 20 |
| Asesor | `advisor_id` | `advisors` | `advisors` | 0 |
| Clasificación Propiedad | `property_classification_id` | `property_classifications` | `property_classifications` | 8 |
| País Siniestro (catálogo) | `country_id` | `countries` | `countries` | 12 |
| Región Siniestro (catálogo) | `region_id` | `regions` | `regions` | 41 |
| Ciudad Siniestro (catálogo) | `city_id` | `cities` | `cities` | 252 |
| Comuna Siniestro (catálogo) | `commune_id` | `communes` | `communes` | 2183 |
| Liquidador/Ajustador | `adjuster_id` | `profiles` (empresa) | `profiles` | — |
| Inspector | `inspector_id` | `profiles` (empresa) | `profiles` | — |
| Auditor | `auditor_id` | `profiles` (empresa) | `profiles` | — |
| Despachador | `dispatcher_id` | `profiles` (empresa) | `profiles` | — |
| Asistente | `assistant_id` | `profiles` (empresa) | `profiles` | — |
| Póliza (referencia) | `policy_id` | `policies` (empresa) | `policies` | 90 |

> **Regla:** Los campos UUID **NUNCA** se piden como UUID directo. Se pide el **NOMBRE** del Excel y se resuelve al UUID via el catálogo correspondiente. Si el nombre no coincide exacto, el usuario lo mapea manualmente en el panel de mapeo de valores.

### Campos OPCIONALES — Asegurado (va a `claims_participants` tipo `insured`)

| Campo Excel | Campo claims_participants | Tipo |
|---|---|---|
| Apellido Asegurado | `last_name` | text |
| RUT Asegurado | `rut` | text |
| E-mail Asegurado | `email` | text |
| Teléfono Asegurado | `phone` | text |
| Celular Asegurado | `cell_phone` | text |
| País Asegurado | `country` | text |
| Región Asegurado | `region` | text |
| Ciudad Asegurado | `city` | text |
| Comuna Asegurado | `commune` | text |

### Campos OPCIONALES — Contratante (va a `claims_participants` tipo `contractor`)

| Campo Excel | Campo claims_participants | Tipo |
|---|---|---|
| Nombre Contratante | `first_name` | text |
| Apellido Contratante | `last_name` | text |
| RUT Contratante | `rut` | text |
| E-mail Contratante | `email` | text |
| Teléfono Contratante | `phone` | text |
| Celular Contratante | `cell_phone` | text |
| Dirección Contratante | `address` | text |
| País Contratante | `country` | text |
| Región Contratante | `region` | text |
| Ciudad Contratante | `city` | text |
| Comuna Contratante | `commune` | text |

### Campos OPCIONALES — Dirección del Siniestro (va a `claims`)

| Campo Excel | Campo claims | Tipo | Fallback |
|---|---|---|---|
| Dirección Siniestro | `claim_address` | text | Usa dirección del asegurado si no viene |

> **Nota:** País/Región/Ciudad/Comuna del Siniestro van por **catálogo** (UUID),
> no por texto. Ver sección "Campos UUID → catálogo" arriba.

### Campos OPCIONALES — Beneficiario (va a `claims_participants` tipo `beneficiary`)

| Campo Excel | Campo claims_participants | Tipo |
|---|---|---|
| Nombre Beneficiario | `first_name` | text |
| Apellido Beneficiario | `last_name` | text |
| RUT Beneficiario | `rut` | text |
| E-mail Beneficiario | `email` | text |
| Teléfono Beneficiario | `phone` | text |
| Celular Beneficiario | `cell_phone` | text |
| Dirección Beneficiario | `address` | text |
| País Beneficiario | `country` | text |
| Región Beneficiario | `region` | text |
| Ciudad Beneficiario | `city` | text |
| Comuna Beneficiario | `commune` | text |

### Campos OPCIONALES — Persona Contacto (va a `claims_participants` tipo `contact`)

| Campo Excel | Campo claims_participants | Tipo |
|---|---|---|
| Nombre Persona Contacto | `full_name` | text |
| Cargo Persona Contacto | `notes` | text |
| E-mail Persona Contacto | `email` | text |
| Teléfono Persona Contacto | `phone` | text |

---

## Campos que NUNCA se piden del Excel

| Campo | Motivo |
|---|---|
| **N° Liquidación** (`liquidation_number`) | Correlativo automático generado por trigger `set_liquidation_number` → `generate_liquidation_number()`. Secuencia `claims_liquidation_seq`. Si el Excel lo trae y se toma, queda el desastre con números duplicados o saltados. |
| **Fecha Cierre** | No existe columna `closed_date` en `claims`. |
| **Tipo Construcción** | No existe tabla `construction_types` en la base. |
| **Es Habitable?** | No existe tabla `habitations` ni `habitability` en la base. |
| **Hora Siniestro** | No existe columna `claim_time` en `claims`. |
| **`company_id`** | Se obtiene del perfil del usuario autenticado (tenant). NUNCA del Excel. |
| **`updated_at`** | Auto-set por la base de datos (`default=now()`). |
| **`updated_by`** | Se setea por el sistema según el usuario que hace la acción. |
| **`disabled`** / **`disabled_at`** / **`disabled_by`** / **`disabled_reason`** | Se gestionan desde la pantalla de inhabilitar, no desde el Excel. |
| **`reopened_at`** / **`reopened_by`** / **`reopened_reason`** | Se gestionan desde la pantalla de reabrir, no desde el Excel. |

> **Nota sobre `internal_number` y `created_at`:** Ambos **SÍ se piden** del Excel.
> - `internal_number` (N° McLarens One) es un `text` nullable sin default — no es automático.
> - `created_at` solo se sobreescribe si viene valor del Excel; si no, usa el default `now()`. Útil para siniestros históricos importados.

---

## Normalización de Fechas

El Excel trae fechas en formato **DD-MM-YYYY** (ej: "15-06-2027") pero Postgres espera **YYYY-MM-DD**.

La función `parseDate()` en `schema.ts` maneja:
- `DD-MM-YYYY` → `2027-06-15`
- `DD/MM/YYYY` → `2027-06-15`
- `YYYY-MM-DD` → `2027-06-15` (sin cambios)
- `YYYY/MM/DD` → `2027-06-15`
- `DD-MM-YY` → `20YY-MM-DD`
- Serial de Excel (ej: 45800) → fecha correspondiente

`applyMappingToRow()` normaliza automáticamente: `claimDate`, `reportDate`, `assignmentDate`, `createdAt`, `policyStartDate`, `policyEndDate`.

---

## Resolución de UUIDs de Catálogos

Los campos que esperan UUID (ej: `insurance_company_id`) reciben texto del Excel (ej: "BCI Seguros Generales S.A."). El sistema los resuelve así:

1. **UUID directo** — si el valor ya es un UUID válido, se usa tal cual
2. **Mapeo manual del usuario** — si el valor no coincide exactamente con un catálogo, el usuario lo mapea manualmente en el panel de mapeo de valores. Se guarda en `valueMappings["fieldKey::excelValue"] = uuid`
3. **Match exacto normalizado** — `normalizeName()` quita acentos, espacios extra, mayúsculas. Ej: "BCI Seguros Generales S.A." → "bci seguros generales s a"

Si un valor no se puede resolver → la fila se marca como `error` en staging con mensaje "Aseguradora X no encontrada en catálogo".

---

## `createClaimMinimal` — Firma

```typescript
await createClaimMinimal(
  // 1. Campos de claims
  {
    claimNumber, policyNumber, claimDate, summary,
    reportDate, assignmentDate, company_id,
    insuranceCompanyId, claimTypeId, claimCauseId,
    statusId, businessLineId, currencyId,
    destinationHousingId, damageClassificationId,
    insuranceProductId, eventId,
    ownerSameAsInsured,
    policyItem, policyStartDate, policyEndDate,
    policyAmount, policyPremium,
    isSpecialClaim, brokerExecutive,
    companyReportNumber, internalNumber, createdAt,
    clientReference, recoveryTypeLegal, recoveryTypeMaterial,
    recoveryComments, claimLatitude, claimLongitude,
    brokerId, advisorId, propertyClassificationId,
    countryId, regionId, cityId, communeId,
    inspectorId, adjusterId, auditorId, dispatcherId, assistantId,
    policyId, notes,
  },
  // 2. Asegurado → claims_participants tipo "insured"
  {
    insuredName, lastName, rut, insuredEmail,
    insuredPhone, cellPhone,
    insuredAddress, insuredCountry, insuredRegion,
    insuredCity, insuredCommune,
  },
  // 3. Dirección del siniestro → claims.claim_address
  {
    claimAddress,
  },
  // 4. Contratante → claims_participants tipo "contractor" (opcional)
  {
    contractorName, contractorLastName, contractorRut,
    contractorEmail, contractorPhone, contractorCellPhone,
    contractorAddress, contractorCountry, contractorRegion,
    contractorCity, contractorCommune,
  } | null,
  // 5. Beneficiario → claims_participants tipo "beneficiary" (opcional)
  {
    beneficiaryName, beneficiaryLastName, beneficiaryRut,
    beneficiaryEmail, beneficiaryPhone, beneficiaryCellPhone,
    beneficiaryAddress, beneficiaryCountry, beneficiaryRegion,
    beneficiaryCity, beneficiaryCommune,
  } | null,
  // 6. Contacto → claims_participants tipo "contact" (opcional)
  {
    contactName, contactRole, contactEmail, contactPhone,
  } | null
);
```

**Retorna:** el claim creado (con `id`, `liquidation_number`, etc.)

---

## Secuencia `claims_liquidation_seq`

Genera el `liquidation_number` automáticamente:

```sql
-- Trigger BEFORE INSERT en claims
CREATE FUNCTION set_liquidation_number() RETURNS trigger AS $$
BEGIN
  IF NEW.liquidation_number IS NULL OR NEW.liquidation_number = '' THEN
    NEW.liquidation_number := generate_liquidation_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Genera el número: L-000000001, L-000000002, etc.
CREATE FUNCTION generate_liquidation_number() RETURNS text AS $$
DECLARE next_val BIGINT;
BEGIN
  next_val := nextval('claims_liquidation_seq');
  RETURN 'L-' || LPAD(next_val::TEXT, 9, '0');
END;
$$ LANGUAGE plpgsql;
```

**Importante:** `createClaimMinimal` NO pasa `liquidation_number` (lo deja en NULL) para que el trigger lo genere automáticamente.

**Reset:** `ALTER SEQUENCE claims_liquidation_seq RESTART WITH 1;` — **SOLO en desarrollo inicial. NUNCA en producción.**

---

## Reglas de UI (DESIGN_SYSTEM.md)

- **Botones de 1 palabra:** "Cargar", "Confirmar", "Reiniciar", "Volver"
- **Resultados en labels:** `N registros`, `N errores`, `N importados` (clase `app-data-label`)
- **Sin inline styles** (excepto width dinámico de progress bar)
- **Clases CSS:** `.bulk-*` (mapper), `.staging-*` (staging preview)

---

## Catálogos Cargados en la Página

| Catálogo | Función | Tabla | Filas | Scope |
|---|---|---|---|---|
| Aseguradoras | `getInsuranceCompanies()` | `insurance_companies` | 72 | Global |
| Tipos de Siniestro | `getClaimTypes()` | `claim_types` | 11 | Global |
| Causales | `getClaimCauses()` | `claim_causes` | 12 | Global |
| Líneas de Negocio | `getBusinessLines()` | `business_lines` | 5 | Global |
| Monedas | `getCurrencies()` | `currencies` | 18 | Global |
| Destinos Housing | `getHousingDestinations()` | `housing_destinations` | 2 | Global |
| Clasif. Daño | `getDamageClassifications()` | `damage_classifications` | 4 | Global |
| Estatus | `getLookupCatalog("claim_status")` | `lookup_catalog` | 5 | Global |
| Productos | `getInsuranceProducts()` | `insurance_products` | 5 | Global |
| Eventos | `getEvents()` | `events` | 10 | Global |
| Corredores | `getBrokers()` | `brokers` | 20 | Global |
| Asesores | `getAdvisors()` | `advisors` | 0 | Global |
| Clasif. Propiedad | `getPropertyClassifications()` | `property_classifications` | 8 | Global |
| Países | `getCountries()` | `countries` | 12 | Global |
| Regiones | `getRegions()` | `regions` | 41 | Global |
| Ciudades | `getCities()` | `cities` | 252 | Global |
| Comunas | `getCommunes()` | `communes` | 2183 | Global |
| Perfiles (empresa) | `getUsers(companyId)` | `profiles` | — | Por empresa |
| Pólizas (empresa) | `getPolicies({ companyId })` | `policies` | 90 | Por empresa |

Todos se cargan con `useQuery` y `staleTime: 5 * 60 * 1000` (5 minutos de cache).
Los catálogos por empresa (`profiles`, `policies`) solo se cargan si `tenantCompanyId` está disponible.

---

## Troubleshooting

### Error: `date/time field value out of range: "15-06-2027"`
**Causa:** El Excel trae fechas en DD-MM-YYYY pero Postgres espera YYYY-MM-DD.
**Fix:** `parseDate()` normaliza las fechas. Si aparece, verificar que `applyMappingToRow()` esté normalizando el campo afectado.

### Error: `invalid input syntax for type uuid: "Property"`
**Causa:** Un campo UUID recibió texto del Excel en vez del UUID resuelto.
**Fix:** El panel de mapeo de valores debe estar visible para que el usuario asocie el texto al UUID del catálogo.

### Error: `Aseguradora "X" no encontrada en catálogo`
**Causa:** El nombre en el Excel no coincide exactamente con el del catálogo.
**Fix:** Mapear manualmente en el panel de mapeo de valores (paso Review).

### Error: RLS (`company_id` no seteado)
**Causa:** `claims.company_id` debe venir del perfil del usuario autenticado, no del Excel.
**Fix:** `tenantCompanyId = profile?.company_id` se pasa automáticamente a `createClaimMinimal`.

---

## Tabla `import_logs` (pendiente de implementar)

Log de cada importación exitosa, para trazabilidad.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | |
| `company_id` | uuid FK → `companies` | Empresa |
| `user_id` | uuid FK → `profiles` | Usuario que ejecutó la importación |
| `file_name` | text | Nombre del archivo Excel importado |
| `total_rows` | integer | Total de filas del Excel |
| `imported_rows` | integer | Filas importadas exitosamente |
| `error_rows` | integer | Filas con error |
| `liquidation_numbers` | text[] | Lista de L-numbers generados |
| `field_mappings_used` | jsonb | Snapshot de los mapeos de campos usados |
| `value_mappings_used` | jsonb | Snapshot de las homologaciones de valores usadas |
| `fixed_values_used` | jsonb | Snapshot de los valores fijos usados |
| `created_at` | timestamptz | Fecha de la importación |

**RLS:** `is_tenant_allowed(company_id)`.

**Uso:** saber que un caso se creó por importación y tener trazabilidad de
qué números de liquidación se generaron en cada carga.

---

## Commits Relevantes

| Commit | Descripción |
|---|---|
| `b00887b` | Importar máximo de campos del Excel |
| `29908cd` | Normalizar fechas DD-MM-YYYY → YYYY-MM-DD |
| `ca56e41` | Eliminar key duplicada contactEmail |
| `d947004` | Separar Contratante/Siniestro + campos indispensables |
| `43a9e1a` | Labels Asegurado/Contratante + sinónimos completos |
| `b35ae4f` | Flujo de 2 fases con staging |
| `23179c0` | Eliminar liquidation_number + botones 1 palabra + limpiar staging |
| `072418d` | Documentación completa (este MD) |
| `f6eecd6` | Invertir mapper (filas=columnas Excel) + agregar internalNumber y resumen siniestro |
| `519e14a` | Agregar Fecha Creación + arreglar lint warnings |
| `ad19734` | Agregar TODAS las columnas de claims al mapper (client_reference, recovery_*, lat/lng, brokers, advisors, property_classifications, geo, profiles, policies) |
| `f7eafd9` | docs: actualizar CARGA_SINIESTROS con todos los campos nuevos |
| `b32b299` | Separar participantes (asegurado/contratante) + filtrar duplicados del dropdown + valores fijos |
| `3c87457` | Valores fijos no aparecen si el campo ya está mapeado del Excel |
| `15a950f` | Eliminar geo duplicados (País/Región/Ciudad/Comuna Siniestro texto) + agregar Nombre/Cargo Contacto |
| `97c1930` | **Sistema de aprendizaje**: tablas import_field_mappings + import_value_mappings (autodetección con memoria) |
| `e16ea25` | **Tooltip con muestra** + **fixed values persistentes** (import_fixed_values) + **combo para refs** |

---

## Sistema de Aprendizaje (commit `97c1930` + `e16ea25`)

El sistema **aprende** de cada importación y reutiliza los mapeos en futuras cargas
del mismo Excel, sin preguntar al usuario.

### Tablas de aprendizaje

#### `import_field_mappings` (migración 100)
Mapeo de **columnas Excel → campos del sistema** por empresa.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | |
| `company_id` | uuid FK → `companies` | Empresa (tenant) |
| `excel_header` | text | Nombre de la columna en el Excel |
| `field_key` | text | Key del campo del sistema (ej: `claimNumber`) |
| `times_used` | integer | Cuántas veces se usó este mapeo |
| `created_at` / `updated_at` | timestamptz | |

**Constraint:** `UNIQUE (company_id, excel_header)` — una columna del Excel mapea a un solo campo.

#### `import_value_mappings` (migración 100)
Mapeo de **valores Excel → UUID del catálogo** por empresa.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | |
| `company_id` | uuid FK → `companies` | Empresa (tenant) |
| `field_key` | text | Campo del sistema (ej: `currency`) |
| `excel_value` | text | Valor que viene en el Excel (ej: "UF") |
| `catalog_uuid` | uuid | UUID del catálogo resuelto (ej: uuid de moneda UF) |
| `times_used` | integer | Cuántas veces se usó este mapeo |
| `created_at` / `updated_at` | timestamptz | |

**Constraint:** `UNIQUE (company_id, field_key, excel_value)`.

#### `import_fixed_values` (migración 101)
**Valores fijos** por empresa: campos que no vienen en el Excel pero se cargan
con un valor en duro (ej: auditor = Juan Pérez, cia = Santander).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | |
| `company_id` | uuid FK → `companies` | Empresa (tenant) |
| `field_key` | text | Campo del sistema (ej: `auditor`) |
| `fixed_value` | text | Valor en duro para campos de texto (ej: "Santander") |
| `catalog_uuid` | uuid | UUID del catálogo para campos de referencia (ej: uuid de Juan Pérez) |
| `times_used` | integer | Cuántas veces se usó |
| `created_at` / `updated_at` | timestamptz | |

**Constraint:** `UNIQUE (company_id, field_key)` — un campo tiene un solo valor fijo.

### RLS
Las 3 tablas usan `is_tenant_allowed(company_id)` — cada empresa solo ve/edita
sus propios mappings.

### Service: `src/services/import-mappings.ts`

```typescript
// Field mappings (columna Excel → campo sistema)
getImportFieldMappings(companyId)
saveImportFieldMapping(companyId, excelHeader, fieldKey)        // upsert + times_used++
saveImportFieldMappingsBatch(companyId, mappings[])             // batch

// Value mappings (valor Excel → UUID catálogo)
getImportValueMappings(companyId)
saveImportValueMapping(companyId, fieldKey, excelValue, uuid)   // upsert + times_used++
saveImportValueMappingsBatch(companyId, mappings[])             // batch

// Fixed values (valor fijo, no viene del Excel)
getImportFixedValues(companyId)
saveImportFixedValue(companyId, fieldKey, fixedValue, catalogUuid)
saveImportFixedValuesBatch(companyId, fixedValues[])
deleteImportFixedValue(companyId, fieldKey)
```

### Flujo de aprendizaje

1. **Carga inicial** (`useQuery`): carga los 3 tipos de mappings de la empresa
2. **Autodetección** (`autoDetectMapping`):
   - **Pasada 0**: usa los field mappings aprendidos (confianza = 1, máxima)
   - **Pasada 1**: match exacto de sinónimos
   - **Pasada 2**: fuzzy matching
3. **Resolución de valores** (`resolveRefId`):
   - 1) UUID directo
   - 2) Mapeo manual del usuario (`valueMappings`)
   - 3) **Mapeo aprendido** de la empresa (`learnedValueMap`)
   - 4) Match exacto normalizado del catálogo
4. **Fixed values** (`effectiveFixedValues`):
   - Se cargan automáticamente de la DB al iniciar
   - El usuario puede agregar/modificar/eliminar
   - Se aplican **solo si el campo no viene del Excel** (no sobrescriben)
5. **Guardado** (al confirmar importación):
   - Guarda en batch todos los field mappings usados
   - Guarda en batch todos los value mappings usados
   - Guarda en batch todos los fixed values
   - Invalida las queries para recargar

### Resultado esperado

| Importación | Comportamiento |
|-------------|----------------|
| 1ra | Pregunta todo (mapeo de campos + valores) |
| 2da (mismo Excel) | **Autodetecta todo** con confianza 1, no abre el mapper |
| Si el usuario corrige un mapeo | Se actualiza (`times_used++`) |
| Valor no estaba en catálogo pero se mapeó manual | La próxima vez se resuelve solo |
| Fixed value seteado (ej: auditor) | Se carga automáticamente en la próxima importación |

---

## Tooltip con muestra de datos (commit `e16ea25`)

Cada columna del Excel en el mapper muestra el **primer valor no vacío** debajo
del nombre, en gris itálico:

```
┌─────────────────┐
│ N° Siniestro    │
│ S-2024-001      │  ← muestra en gris itálico
└─────────────────┘
```

Y tooltip al hover: `Ej: "S-2024-001"`.

**Implementación:** `headerSamples` es un `useMemo` que recorre `rawRows` y
extrae el primer valor no vacío de cada header. Se muestra en
`.bulk-mapper-field-sample` (CSS).

No hay que abrir el Excel para ver qué contiene cada columna.

---

## Valores Fijos (commit `b32b299` + `3c87457` + `e16ea25`)

### Qué son
Campos del sistema que **no tienen columna en el Excel** pero se cargan con un
valor en duro. Ejemplos:
- "Toda esta carga es para Santander" → `insuranceCompany` = Santander
- "El auditor siempre es Juan Pérez" → `auditor` = Juan Pérez
- "La moneda de esta carga es UF" → `currency` = UF

### UI
Sección **"Valores fijos"** debajo de la tabla del mapper:
1. Dropdown para seleccionar el campo del sistema
2. Si es **campo de referencia** (auditor, liquidador, corredor, etc.):
   abre un **combo del catálogo** (dropdown con los valores existentes)
   → se relaciona con un valor existente, no ensucia la base con texto libre
3. Si es **campo de texto**: prompt de texto libre
4. Cada valor fijo se muestra como chip con botón X para eliminar
5. Al eliminar, también se borra de la DB (`deleteImportFixedValue`)

### Lógica de aplicación
- `effectiveFixedValues` = DB (defaults) + overrides del usuario
- Se aplican **solo si el campo no viene del Excel** (no sobrescriben)
- Si el Excel trae valor para ese campo, el valor fijo **no se aplica**

### Persistencia
- Se guardan en `import_fixed_values` al confirmar la importación
- Se cargan automáticamente al iniciar una nueva importación
- Se eliminan de la DB al quitarlos de la UI

### Orden de prioridad (flujo recomendado)
1. **Setear fixed values** (ej: cia = Santander, auditor = Juan)
2. **Mapear Excel** (autodetectado con lo aprendido)
3. **Ajustar** lo que no esté bien
4. **Agregar más fixed values** si faltó algo
5. **Confirmar** → staging → productivas

---

## Separación de Participantes (commit `b32b299` + `15a950f`)

### Asegurado (va a `claims_participants` tipo `insured`)
Labels cambiados de "Asegurado/Contratante" a solo "Asegurado":
- Nombre Asegurado, Apellido Asegurado, RUT Asegurado
- E-mail Asegurado, Teléfono Asegurado, Celular Asegurado
- Dirección Asegurado, País Asegurado, Región Asegurado
- Ciudad Asegurado, Comuna Asegurado

### Contratante (va a `claims_participants` tipo `contractor`)
**11 campos nuevos** con prefijo `contractor*`:
- Nombre Contratante, Apellido Contratante, RUT Contratante
- E-mail Contratante, Teléfono Contratante, Celular Contratante
- Dirección Contratante, País Contratante, Región Contratante
- Ciudad Contratante, Comuna Contratante

Antes el `contractor` se pasaba como `null` al `createClaimMinimal`.
Ahora se pasan los datos del Excel.

### Persona Contacto (va a `claims_participants` tipo `contact`)
**2 campos nuevos**: `contactName` (Nombre) y `contactRole` (Cargo).
- `contactName` se guarda como `full_name` del participant (antes era "Contacto" hardcodeado)
- `contactRole` se guarda en el campo `notes` del participant

### Beneficiario (va a `claims_participants` tipo `beneficiary`)
Sin cambios — ya existía.

---

## Campos geográficos (commit `15a950f`)

### Eliminados (duplicados)
Se eliminaron del schema los campos de texto del siniestro:
- `claimCountry` (País Siniestro texto)
- `claimRegion` (Región Siniestro texto)
- `claimCity` (Ciudad Siniestro texto)
- `claimCommune` (Comuna Siniestro texto)

**Motivo:** ya existen los del catálogo (`claimCountryRef`, `claimRegionRef`,
`claimCityRef`, `claimCommuneRef`) que resuelven a UUID. Tener ambos causaba
confusión en el mapper (aparecían 2 veces País Siniestro, Región Siniestro, etc.).

### Mapeo final
| Campo Excel | Campo claims | Tipo |
|---|---|---|
| País Asegurado | `claims_participants.country` | text |
| Región Asegurado | `claims_participants.region` | text |
| Ciudad Asegurado | `claims_participants.city` | text |
| Comuna Asegurado | `claims_participants.commune` | text |
| País Siniestro (catálogo) | `claims.country_id` | uuid → `countries` |
| Región Siniestro (catálogo) | `claims.region_id` | uuid → `regions` |
| Ciudad Siniestro (catálogo) | `claims.city_id` | uuid → `cities` |
| Comuna Siniestro (catálogo) | `claims.commune_id` | uuid → `communes` |
| Dirección Siniestro | `claims.claim_address` | text |

---

## Unificación de campos duplicados (commit `b32b299`)

### Eliminados del schema
- `advisor` (duplicado — key repetida causaba error React)
- `brokerName` (duplicado de `broker` que resuelve a catálogo)
- `brokerNumber` (no se usaba)
- `contactName` (duplicado — re-agregado correctamente después)
- `contactRole` (duplicado — re-agregado correctamente después)
- `assignedAdjuster` (duplicado de `adjuster`)

### Unificados
- **Liquidador/Ajustador** → un solo campo `adjuster` → `adjuster_id` via profiles
- **Inspector** → `inspector` → `inspector_id` via profiles (antes era `inspectorId` como texto)

---

## Filtrado del dropdown del mapper (commit `b32b299`)

**Antes:** el dropdown mostraba todos los campos del sistema, los ya asignados
aparecían como disabled "(en uso)" — lista interminable.

**Ahora:** los campos ya asignados a otra columna del Excel **no aparecen** en
el dropdown. Solo aparecen los disponibles. Lista más corta y limpia.

---

## Archivos del sistema de aprendizaje

| Archivo | Descripción |
|---------|-------------|
| `migrations/100_import_mappings.sql` | Tablas `import_field_mappings` + `import_value_mappings` |
| `migrations/101_import_fixed_values.sql` | Tabla `import_fixed_values` |
| `src/services/import-mappings.ts` | Service con CRUD + batch para las 3 tablas |
| `src/lib/claim-import/schema.ts` | `autoDetectMapping` con `learnedMappings` (pasada 0) |
| `src/app/dashboard/operaciones/carga-siniestros/page.tsx` | Integración: carga, uso, guardado |

---

## Notas (commit `b32b299`)

El campo `notes` se agregó al flujo completo:
- **Schema:** `notes` con sinónimos (notas, observaciones, comentarios, etc.)
- **`createClaimMinimal`:** acepta `notes` en el input + INSERT en `claims.notes`
- **`loadMutation`:** guarda `notes` en `raw_data`
- **`confirmMutation`:** pasa `notes` a `createClaimMinimal`
- **`createClaimParticipant`:** acepta `notes` (para `contactRole` del contacto)
