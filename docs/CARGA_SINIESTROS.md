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
| `src/app/styles/components.css` | Clases CSS del mapper y staging (`.bulk-*`, `.staging-*`) |

---

## Flujo de 2 Fases (Staging → Claims)

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Upload  │────▶│  Review  │────▶│ Staging  │────▶│   Done   │
│  Excel   │     │  Mapeo   │     │ Revisión │     │ Resultado│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                       │                │
                       │                ▼
                       │         ┌──────────┐
                       │         │ Confirmar│──▶ claims (producción)
                       │         └──────────┘
                       │
                       ▼
                 claims_staging (temporal)
                 raw_data + status + error_message
```

### Fase 1: Upload + Review (mapeo de columnas)

1. Usuario sube archivo Excel (.xlsx, .xls)
2. `autoDetectMapping()` mapea automáticamente las columnas del Excel a los campos del sistema usando sinónimos
3. **Tabla de mapeo INVERTIDA:** las filas son las **columnas del Excel** y cada una tiene un dropdown para elegir a qué campo del sistema se mapea. Así ninguna columna del Excel se pierde — el usuario ve todos sus datos y decide dónde va cada uno.
4. Usuario puede ajustar el mapeo manualmente
5. Si hay valores del Excel que no coinciden con catálogos (ej: "BCI Seguros Generales S.A." vs "BCI Seguros"), aparece el **panel de mapeo de valores** para asociar manualmente cada valor a su UUID del catálogo
6. Al final de la tabla, un banner amarillo muestra qué campos requeridos faltan mapear

### Fase 2: Cargar a Staging

1. Click **"Cargar"** → `loadMutation` ejecuta:
   - `cleanStaging(companyId)` — borra el staging anterior de la empresa
   - `insertStagingRows(companyId, rows)` — inserta todas las filas válidas en `claims_staging` con `raw_data` = datos parseados + UUIDs resueltos
   - Valida cada row: required fields, UUIDs de catálogos, fechas normalizadas
   - Marca cada row como `valid` o `error` con mensaje
2. Se muestra tabla de staging con estado por fila:
   - **verde** = válido (listo para importar)
   - **rojo** = error (con mensaje de qué falló)
3. Usuario revisa qué podría fallar antes de confirmar

### Fase 3: Confirmar

1. Click **"Confirmar"** → `confirmMutation` ejecuta:
   - Para cada row `valid`: llama `createClaimMinimal()` que crea el claim + claims_participants
   - Marca cada row como `imported` (con `claim_id` + `processed_at`) o `error`
2. Al finalizar:
   - **0 errores** → `cleanStaging()` borra todo el staging
   - **Con errores** → borra solo los importados, deja los con error para revisión
3. Pantalla final muestra resultado: `N registros importados` · `N errores`

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
| Nombre Asegurado/Contratante | `claims_participants.first_name` | text | Tipo `insured` |
| Dirección Asegurado/Contratante | `claims_participants.address` | text | |
| Ciudad Asegurado/Contratante | `claims_participants.city` | text | |

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
| Liquidador Asignado | `assigned_adjuster_id` | `profiles` (empresa) | `profiles` | — |
| Auditor | `auditor_id` | `profiles` (empresa) | `profiles` | — |
| Despachador | `dispatcher_id` | `profiles` (empresa) | `profiles` | — |
| Asistente | `assistant_id` | `profiles` (empresa) | `profiles` | — |
| Póliza (referencia) | `policy_id` | `policies` (empresa) | `policies` | 90 |

> **Regla:** Los campos UUID **NUNCA** se piden como UUID directo. Se pide el **NOMBRE** del Excel y se resuelve al UUID via el catálogo correspondiente. Si el nombre no coincide exacto, el usuario lo mapea manualmente en el panel de mapeo de valores.

### Campos OPCIONALES — Contratante/Asegurado (va a `claims_participants` tipo `insured`)

| Campo Excel | Campo claims_participants | Tipo |
|---|---|---|
| Apellido Asegurado/Contratante | `last_name` | text |
| RUT Asegurado/Contratante | `rut` | text |
| E-mail Asegurado/Contratante | `email` | text |
| Teléfono Asegurado/Contratante | `phone` | text |
| Celular Asegurado/Contratante | `cell_phone` | text |
| País Asegurado/Contratante | `country` | text |
| Región Asegurado/Contratante | `region` | text |
| Comuna Asegurado/Contratante | `commune` | text |

### Campos OPCIONALES — Dirección del Siniestro (va a `claims`)

| Campo Excel | Campo claims | Tipo | Fallback |
|---|---|---|---|
| Dirección Siniestro | `claim_address` | text | Usa dirección del contratante si no viene |
| País Siniestro | (text en `claim_country` de raw_data) | text | Usa país del contratante |
| Región Siniestro | (text en `claim_region` de raw_data) | text | Usa región del contratante |
| Ciudad Siniestro | (text en `claim_city` de raw_data) | text | Usa ciudad del contratante |
| Comuna Siniestro | (text en `claim_commune` de raw_data) | text | Usa comuna del contratante |

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
    companyReportNumber,
  },
  // 2. Contratante/Asegurado → claims_participants tipo "insured"
  {
    insuredName, lastName, rut, insuredEmail,
    insuredPhone, cellPhone,
    insuredAddress, insuredCountry, insuredRegion,
    insuredCity, insuredCommune,
  },
  // 3. Dirección del siniestro → claims.claim_address + campos de raw_data
  {
    claimAddress, claimCountry, claimRegion,
    claimCity, claimCommune,
  },
  // 4. Contractor (null por ahora)
  null,
  // 5. Beneficiario → claims_participants tipo "beneficiary" (opcional)
  {
    beneficiaryName, beneficiaryLastName, beneficiaryRut,
    beneficiaryEmail, beneficiaryPhone, beneficiaryCellPhone,
    beneficiaryAddress, beneficiaryCountry, beneficiaryRegion,
    beneficiaryCity, beneficiaryCommune,
  } | null,
  // 6. Contacto → claims_participants tipo "contact" (opcional)
  {
    contactEmail, contactPhone,
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
