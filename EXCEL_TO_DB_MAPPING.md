# Mapeo Excel → Base de Datos (Claims)

> Documento de referencia que muestra cómo cada columna del Excel original
> fue cargada y vinculada a los campos e IDs de la tabla `claims` en la DB.

---

## Resumen de Migraciones Aplicadas

| Migración | Descripción |
|-----------|-------------|
| 49 | Secuencia `liquidation_number` + `company_report_number` null por defecto |
| 50 | Migrar `event`→`event_id`, `status`→`status_id`, `policy_currency`→`currency_id`, drop `claim_reference` |
| 51 | Drop columnas de texto (`event`, `status`, `policy_currency`, `claim_country/region/city/commune`), fix geo FKs faltantes, `recovery_type_legal/material` → boolean |
| 52 | Restaurar `status` como campo calculado desde `status_id` vía trigger |

---

## Columnas Dropeadas (texto → reemplazadas por FK)

| Columna texto (dropeada) | Columna FK (vigente) | Tabla de referencia | Cómo se migró |
|--------------------------|---------------------|---------------------|---------------|
| `event` | `event_id` | `events` | Match por nombre: texto → `events.name` → `events.id` |
| `status` | `status_id` | `lookup_catalog` (category=`claim_status`) | Match por código: texto → `lookup_catalog.code` → `lookup_catalog.id` |
| `policy_currency` | `currency_id` | `lookup_catalog` (category=`currency`) | Match por nombre: texto → `lookup_catalog.name` → `lookup_catalog.id` |
| `claim_country` | `country_id` | `countries` | Ya estaba poblado desde migración 34 |
| `claim_region` | `region_id` | `regions` | Ya estaba poblado + fix de 13 claims con sinónimos (migración 51) |
| `claim_city` | `city_id` | `cities` | Ya estaba poblado + creación de ciudades faltantes (migración 51) |
| `claim_commune` | `commune_id` | `communes` | Ya estaba poblado + creación de comunas faltantes (migración 51) |
| `claim_reference` | `client_reference` | — | Renombrada directamente (los datos ya estaban en `client_reference`) |

> **Nota sobre `status`**: Se restauró como columna calculada en migración 52.
> Un trigger (`sync_claim_status`) la mantiene sincronizada con `status_id`
> automáticamente. `status` contiene el código machine-readable
> (`created`, `in_review`, `signed`, `closed`) para lógica de la app.
> `status_id` es el FK a `lookup_catalog` para el nombre human-readable.

---

## Mapeo Completo: Columna Excel → Campo DB

### Datos del Siniestro

| Columna Excel (nombres aceptados) | Campo DB | Tipo | FK a tabla | Estado |
|-----------------------------------|----------|------|------------|--------|
| N° Siniestro / claim_number / siniestro | `claim_number` | text | — | Directo |
| N° Póliza / policy_number / poliza | `policy_number` | text | — | Directo |
| N° Liquidación / liquidation_number | `liquidation_number` | text | — | **Auto-generado** por trigger (formato `L-0000001`) |
| N° Ref Cliente / client_reference | `client_reference` | text | — | Directo (antes era `claim_reference`) |
| N° Siniestro Cía / company_report_number | `company_report_number` | text | — | Directo (null por defecto) |
| Fecha Siniestro / claim_date / fecha | `claim_date` | date | — | Directo |
| Hora Siniestro / claim_time | — | — | — | No se almacena (era solo en form) |
| Fecha Denuncio / report_date | `report_date` | date | — | Directo |
| Fecha Asignación / assignment_date | `assignment_date` | date | — | Directo |
| Resumen / descripción / summary | `summary` | text | — | Directo |

### Tipo y Causal del Siniestro

| Columna Excel | Campo DB | Tipo | FK a tabla | Cómo se vincula |
|---------------|----------|------|------------|-----------------|
| Tipo de Siniestro / claim_type / tipo | `claim_type_id` | uuid | `claim_types` | Match por nombre → `claim_types.id` |
| Causal / claim_cause / causa | `claim_cause_id` | uuid | `claim_causes` | Match por nombre → `claim_causes.id` |
| Evento / event | `event_id` | uuid | `events` | Match por nombre → `events.id` (migración 50) |

### Compañía e Intermediarios

| Columna Excel | Campo DB | Tipo | FK a tabla | Cómo se vincula |
|---------------|----------|------|------------|-----------------|
| Compañía de Seguros / insurance_company | `insurance_company_id` | uuid | `insurance_companies` | Match por nombre → `insurance_companies.id` |
| Corredor / broker / broker_name | `broker_id` | uuid | `brokers` | Match por nombre → `brokers.id` |
| Asesor / advisor | `advisor_id` | uuid | `advisors` | Match por nombre → `advisors.id` |
| Línea de Negocio | `business_line_id` | uuid | `business_lines` | Match por nombre → `business_lines.id` |
| Producto / insurance_product | `insurance_product_id` | uuid | `insurance_products` | Match por nombre → `insurance_products.id` |

### Ubicación del Siniestro (Incidente)

| Columna Excel | Campo DB | Tipo | FK a tabla | Cómo se vincula |
|---------------|----------|------|------------|-----------------|
| Dirección / address / calle | `claim_address` | text | — | Directo (texto, no es FK) |
| País / country / pais | `country_id` | uuid | `countries` | Match por nombre → `countries.id` |
| Región / region / state | `region_id` | uuid | `regions` | Match por nombre (con sinónimos) → `regions.id` |
| Ciudad / city | `city_id` | uuid | `cities` | Match por nombre → `cities.id` (ciudades creadas si no existen) |
| Comuna / commune | `commune_id` | uuid | `communes` | Match por nombre → `communes.id` (comunas creadas si no existen) |

> **Sinónimos de regiones aplicados en migración 51:**
> - "Región Metropolitana" → `regions` donde name = "Región Metropolitana"
> - "Aysén del General Carlos Ibáñez del Campo" → `regions` code = '11'
> - "Ñuble" → `regions` code = '10'
> - "Valparaíso" → `regions` code = '05'

> **Ciudades creadas en migración 51:**
> - Marga Marga (V Región)
> - Coyhaique (XI Región)
> - Diguillín (X Región)

> **Comunas creadas en migración 51:**
> - Concón (ciudad Valparaíso)
> - Chillán Viejo (ciudad Diguillín)
> - Coyhaique (ciudad Coyhaique)

### Clasificación del Siniestro

| Columna Excel | Campo DB | Tipo | FK a tabla | Cómo se vincula |
|---------------|----------|------|------------|-----------------|
| Tipo Construcción | `construction_type_id` | uuid | `lookup_catalog` (category=`construction_type`) | Match por nombre |
| Destino Vivienda | `destination_housing_id` | uuid | `lookup_catalog` (category=`housing_destination`) | Match por nombre |
| Clasif. Daño | `damage_classification_id` | uuid | `lookup_catalog` (category=`damage_classification`) | Match por nombre |
| Habitabilidad | `habitability_id` | uuid | `lookup_catalog` (category=`habitability`) | Match por nombre |
| Dueño = Asegurado | `owner_same_as_insured` | boolean | — | Directo (true/false) |

### Datos de la Póliza

| Columna Excel | Campo DB | Tipo | FK a tabla | Cómo se vincula |
|---------------|----------|------|------------|-----------------|
| Item Póliza / policy_item | `policy_item` | text | — | Directo |
| Moneda / policy_currency | `currency_id` | uuid | `lookup_catalog` (category=`currency`) | Match por nombre → `lookup_catalog.id` (migración 50) |
| Monto Asegurado / policy_amount | `policy_amount` | numeric | — | Directo |
| Prima / policy_premium | `policy_premium` | numeric | — | Directo |
| Inicio Vigencia / policy_start_date | `policy_start_date` | date | — | Directo |
| Término Vigencia / policy_end_date | `policy_end_date` | date | — | Directo |

> **Monedas disponibles en `lookup_catalog` (category=`currency`):**
> - CLP — Peso Chileno
> - UF — Unidad de Fomento
> - USD — Dólar Americano
> - EUR — Euro

### Recovery (Recupero)

| Columna Excel | Campo DB | Tipo | Notas |
|---------------|----------|------|-------|
| Recupero Legal | `recovery_type_legal` | boolean | Antes era text, migrado a boolean en migración 51 |
| Recupero Material | `recovery_type_material` | boolean | Antes era text, migrado a boolean en migración 51 |
| Comentarios Recovery | `recovery_comments` | text | Directo |

### Asignaciones de Personal

| Columna Excel | Campo DB | Tipo | FK a tabla | Cómo se vincula |
|---------------|----------|------|------------|-----------------|
| Inspector / inspector_id | `inspector_id` | uuid | `profiles` | Match por nombre/email → `profiles.id` |
| Ajustador / adjuster_id / liquidador | `adjuster_id` | uuid | `profiles` | Match por nombre/email → `profiles.id` |
| Auditor / auditor_id | `auditor_id` | uuid | `profiles` | Match por nombre/email → `profiles.id` |
| Despachador / dispatcher_id | `dispatcher_id` | uuid | `profiles` | Match por nombre/email → `profiles.id` |
| Asistente / assistant_id | `assistant_id` | uuid | `profiles` | Match por nombre/email → `profiles.id` |

### Participantes (Asegurado, Contratante, Beneficiario)

Los participantes se almacenan en la tabla `claims_participants` (no en `claims`).
Cada participante tiene su propio registro con tipo: `insured`, `contractor`, `beneficiary`, `contact`.

| Columna Excel | Campo DB (`claims_participants`) | Tipo | Notas |
|---------------|----------------------------------|------|-------|
| Nombre Asegurado / insured_name | `first_name` + `full_name` | text | `full_name` = first_name + last_name |
| Apellido / last_name | `last_name` | text | — |
| RUT / rut_asegurado | `rut` | text | — |
| Email / insured_email | `email` | text | — |
| Teléfono / insured_phone | `phone` | text | — |
| Celular / cell_phone | `cell_phone` | text | — |
| Dirección / address | `address` | text | — |
| País / country | `country` | text | Texto directo (no FK en participants) |
| Región / region | `region` | text | Texto directo (no FK en participants) |
| Ciudad / city | `city` | text | Texto directo (no FK en participants) |
| Comuna / commune | `commune` | text | Texto directo (no FK en participants) |

> **Nota:** Los participantes (`claims_participants`) mantienen campos de texto
> para país/región/ciudad/comuna porque son datos del participante, no del siniestro.
> La ubicación del siniestro (incidente) sí usa FKs (`country_id`, `region_id`, etc.)
> en la tabla `claims`.

### Estado del Siniestro

| Columna Excel | Campo DB | Tipo | FK a tabla | Notas |
|---------------|----------|------|------------|-------|
| Estado / status | `status` + `status_id` | text + uuid | `lookup_catalog` (category=`claim_status`) | `status` = código (auto-sync desde `status_id`), `status_id` = FK |

> **Estados disponibles en `lookup_catalog` (category=`claim_status`):**
> - `created` — Creado
> - `scheduled` — Despachado
> - `in_progress` — En Progreso
> - `in_review` — En Revisión
> - `closed` — Cerrado

---

## Estructura Final de la Tabla `claims`

### Campos Directos (texto/numero/fecha/boolean)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `claim_number` | text | N° Siniestro Cía |
| `policy_number` | text | N° Póliza |
| `claim_date` | date | Fecha del siniestro |
| `status` | text | Código de estado (auto-sync desde `status_id`) |
| `report_date` | date | Fecha de denuncio |
| `assignment_date` | date | Fecha de asignación |
| `client_reference` | text | N° Ref Cliente |
| `company_report_number` | text | N° Siniestro Cía (reporte) |
| `liquidation_number` | text | N° Liquidación (auto-generado: L-0000001) |
| `is_special_claim` | boolean | Siniestro especial |
| `summary` | text | Resumen |
| `internal_number` | text | N° interno |
| `notes` | text | Notas |
| `claim_address` | text | Dirección del incidente |
| `owner_same_as_insured` | boolean | Dueño = Asegurado |
| `policy_item` | text | Item de póliza |
| `policy_start_date` | date | Inicio vigencia |
| `policy_end_date` | date | Término vigencia |
| `policy_amount` | numeric | Monto asegurado |
| `policy_premium` | numeric | Prima |
| `recovery_type_legal` | boolean | Recupero legal |
| `recovery_type_material` | boolean | Recupero material |
| `recovery_comments` | text | Comentarios de recovery |
| `broker_executive` | text | Ejecutivo del corredor |
| `company_id` | uuid | FK a `companies` (tenant) |
| `created_at` | timestamptz | — |
| `updated_at` | timestamptz | — |

### FKs a Catálogos

| Campo | Tipo | Tabla | Categoría lookup_catalog |
|-------|------|-------|-------------------------|
| `status_id` | uuid | `lookup_catalog` | `claim_status` |
| `event_id` | uuid | `events` | — |
| `claim_type_id` | uuid | `claim_types` | — |
| `claim_cause_id` | uuid | `claim_causes` | — |
| `insurance_company_id` | uuid | `insurance_companies` | — |
| `business_line_id` | uuid | `business_lines` | — |
| `insurance_product_id` | uuid | `insurance_products` | — |
| `broker_id` | uuid | `brokers` | — |
| `advisor_id` | uuid | `advisors` | — |
| `currency_id` | uuid | `lookup_catalog` | `currency` |
| `construction_type_id` | uuid | `lookup_catalog` | `construction_type` |
| `destination_housing_id` | uuid | `lookup_catalog` | `housing_destination` |
| `damage_classification_id` | uuid | `lookup_catalog` | `damage_classification` |
| `habitability_id` | uuid | `lookup_catalog` | `habitability` |
| `type_id` | uuid | `lookup_catalog` | (sin uso actualmente) |
| `service_type_id` | uuid | `lookup_catalog` | (sin uso actualmente) |
| `billing_type_id` | uuid | `lookup_catalog` | (sin uso actualmente) |
| `property_classification_id` | uuid | `lookup_catalog` | (sin uso actualmente) |

### FKs Geográficas

| Campo | Tipo | Tabla |
|-------|------|-------|
| `country_id` | uuid | `countries` |
| `region_id` | uuid | `regions` |
| `city_id` | uuid | `cities` |
| `commune_id` | uuid | `communes` |

### FKs a Personal (profiles)

| Campo | Tipo | Tabla |
|-------|------|-------|
| `inspector_id` | uuid | `profiles` |
| `adjuster_id` | uuid | `profiles` |
| `auditor_id` | uuid | `profiles` |
| `dispatcher_id` | uuid | `profiles` |
| `assistant_id` | uuid | `profiles` |
| `assigned_adjuster_id` | uuid | `profiles` (legacy) |

---

## Verificación de Datos (post-migración 51)

| Campo FK | Claims con FK poblado | Total |
|----------|----------------------|-------|
| `country_id` | 141 | 141 |
| `region_id` | 141 | 141 |
| `city_id` | 141 | 141 |
| `commune_id` | 141 | 141 |
| `event_id` | 141 | 141 |
| `status_id` | 141 | 141 |
| `currency_id` | 140 | 141 (1 sin moneda) |

---

## Pendientes / Notas

1. **`type_id`, `service_type_id`, `billing_type_id`, `property_classification_id`**: Estas FKs existen en la DB pero no tienen datos poblados (0/141). Si se necesitan, hay que crear las categorías en `lookup_catalog` y poblar los valores.

2. **`assigned_adjuster_id`**: Campo legacy de la migración inicial. Duplica `adjuster_id`. Considerar dropear en el futuro.

3. **`broker_executive`, `internal_number`**: Campos de texto que existen pero están vacíos (NULL en todos los claims). Considerar dropear si no se van a usar.

4. **Participantes (`claims_participants`)**: Mantienen campos de texto para geo (country, region, city, commune) porque son datos del participante, no del siniestro. Si se quiere normalizar, habría que agregar FKs geo a `claims_participants`.

5. **Carga masiva (`carga-siniestros/page.tsx`)**: El mapeo del Excel usa `mapRow()` que busca coincidencias por nombre de columna. Los campos geo del Excel se cargan como texto en los participantes, pero el siniestro (claims) ahora usa FKs que se resuelven en el wizard de creación, no en la carga masiva. La carga masiva debería actualizarse para resolver los FKs geo.
