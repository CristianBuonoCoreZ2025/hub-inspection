# Plan de implementación: Carga AloClaim

> Fecha: 2026-08-17
> Origen: `C:\Users\crist\Downloads\Nueva carpeta\Carga Aloclaim 11-08-2026.xlsx`
> Estado: **SOLO MD — sin implementación ejecutada**

---

## 1. Visión general

**AloClaim** es una tercera vía de importación masiva de siniestros. Comparte pantalla/menú con `carga-casos` pero tiene su propia ruta y lógica. La estructura del Excel es distinta al de Casos: trae información explícita de **contratante** y **beneficiario** (no es réplica del asegurado) y datos completos de ubicación para cada participante.

### Principios reutilizados de `carga-casos`

- Si `clientReference` está repetido en el Excel → **no sube**.
- Si `(claimNumber + insuranceCompanyId)` ya existe en `claims` → **no sube**.
- Si la póliza no se puede resolver/crear → fila queda **pendiente**.
- Resolución recursiva de comuna → ciudad → región → país (usar catálogo).
- `person_type` desde RUT con `rutBodyNumber`.

---

## 2. Archivos a crear (y ninguno a modificar todavía)

| Archivo | Descripción | Reutiliza de |
|---------|-------------|--------------|
| `src/lib/claim-import/schema-aloclaim.ts` | Definición de 59 campos, sinónimos y validaciones | Base de `schema-casos.ts` |
| `src/app/dashboard/operaciones/carga-aloclaim/page.tsx` | UI del wizard (upload → mapping → staging → done) | Estructura de `carga-casos/page.tsx` |
| `src/services/claims.ts` → `createClaimFromAloClaim` | Creación del siniestro + participantes | Patrón de `createClaimFromCaso` |
| `docs/CARGA_ALOCLAIM.md` | Documentación del flujo | Este MD |

### Archivos a tocar (pendientes de aprobación)

- `src/app/dashboard/operaciones/page.tsx` o menú lateral para agregar link (cuando corresponda).
- `src/services/claims.ts` (agregar `createClaimFromAloClaim` al final del archivo).
- `src/lib/validations/rut.ts` (no tocar, solo reutilizar `rutBodyNumber`).

---

## 3. Estructura del Excel (59 columnas)

### 3.1 Claim / referencias

| # | Columna (Excel) | key | Obligatorio | Uso |
|---|-----------------|-----|-------------|-----|
| 1 | Referencia | `clientReference` | Sí | Referencia interna; usado para deduplicación |
| 2 | No. Siniestro Compañía | `claimNumber` | Sí | Número de siniestro en la compañía |
| 3 | Compañía | `insuranceCompany` | Sí | Resuelve `insurance_company_id` |
| 4 | Tipo Siniestro | `claimType` | No | Resuelve `claim_type_id` |
| 5 | Línea Negocio | `businessLine` | No | Resuelve `business_line_id` |
| 6 | Ramo/Producto | `insuranceProduct` | Sí | Resuelve `insurance_product_id` |
| 7 | Evento | `event` | No | Resuelve `event_id` |
| 18 | Fecha Siniestro | `claimDate` | Sí | Fecha del daño |
| 19 | Fecha Denuncio | `reportDate` | No | Fecha de recepción |
| 20 | Fecha Asignación | `assignmentDate` | No | Si vacía → `reportDate` |
| 21 | Moneda Siniestro | `currency` | No | Resuelve `currency_id` |
| 48 | Causal Siniestro | `claimCause` | No | Resuelve `claim_cause_id` |
| 49 | Resumen Siniestro | `summary` | No | Guarda en `claims.summary` |

### 3.2 Asegurado

| # | Columna | key | Uso |
|---|---------|-----|-----|
| 8 | RUT Asegurado | `rut` | `person_type` + `rut` del asegurado |
| 9 | Nombre Asegurado | `insuredName` | `first_name` (natural) o parte de `full_name` (jurídica) |
| 10 | Apellido Asegurado | `lastName` | `last_name` (natural) o concatenado en razón social (jurídica) |
| 11 | E-mail Asegurado | `insuredEmail` | Email |
| 12 | Celular Asegurado | `insuredPhone` | Teléfono/celular |
| 13 | Dirección Asegurado | `insuredAddress` | Dirección |
| 14-17 | País/Región/Ciudad/Comuna Asegurado | `insuredCountry`…`insuredCommune` | Ubicación del asegurado |

### 3.3 Póliza

| # | Columna | key | Uso |
|---|---------|-----|-----|
| 22 | Número Póliza | `policyNumber` | Si vacío → `SIN NUMERO` |
| 23 | Fecha Inicio Póliza | `policyStartDate` | Inicio vigencia |
| 24 | Fecha Fin Póliza | `policyEndDate` | Término vigencia |
| 25 | Moneda Póliza | `policyCurrency` | `currency_id` de la póliza (puede ser distinta al siniestro) |
| 26 | Prima Anual | `policyPremium` | Prima anual de la póliza |

### 3.4 Inspector

| # | Columna | key | Uso |
|---|---------|-----|-----|
| 27 | Inspector | `inspector` | Resuelve `inspector_id` vía `profiles` |

### 3.5 Contratante (explícito)

| # | Columna | key | Uso |
|---|---------|-----|-----|
| 28 | RUT Contratante | `contractorRut` | RUT del contratante (puede ser igual al asegurado) |
| 29 | Nombre Contratante | `contractorName` | Nombre |
| 30 | Apellido Contratante | `contractorLastName` | Apellido |
| 31 | E-mail Contratante | `contractorEmail` | Email |
| 32 | Celular Contratante | `contractorPhone` | Celular |
| 33 | Dirección Contratante | `contractorAddress` | Dirección |
| 34-37 | País/Región/Ciudad/Comuna Contratante | `contractorCountry`…`contractorCommune` | Ubicación |

### 3.6 Beneficiario (explícito)

| # | Columna | key | Uso |
|---|---------|-----|-----|
| 38 | RUT Beneficiario | `beneficiaryRut` | RUT del beneficiario |
| 39 | Nombre Beneficiario | `beneficiaryName` | Nombre |
| 40 | Apellido Beneficiario | `beneficiaryLastName` | Apellido |
| 41 | E-mail Beneficiario | `beneficiaryEmail` | Email |
| 42 | Celular Beneficiario | `beneficiaryPhone` | Celular |
| 43 | Dirección Beneficiario | `beneficiaryAddress` | Dirección |
| 44-47 | País/Región/Ciudad/Comuna Beneficiario | `beneficiaryCountry`…`beneficiaryCommune` | Ubicación |

### 3.7 Dirección del siniestro

| # | Columna | key | Uso |
|---|---------|-----|-----|
| 50 | Dirección Siniestro | `claimAddress` | Dirección del siniestro |
| 51-54 | País/Región/Ciudad/Comuna Siniestro | `claimCountry`…`claimCommune` | Ubicación del siniestro; prioritaria para `resolveCommuneHierarchy` |

### 3.8 Campos adicionales de inspección

| # | Columna | key | Uso |
|---|---------|-----|-----|
| 55 | Tipo Construcción | `constructionType` | Posible lookup en catálogo de tipos de construcción |
| 56 | Destino | `destinationHousing` | Resuelve `destination_housing_id` |
| 57 | Clasif. Daño | `damageClassification` | Clasificación del daño (posible lookup) |
| 58 | Es Habitable? | `isHabitable` | Sí/No → boolean |
| 59 | Propietario / Asegurado | `ownerRelation` | Indica relación con el asegurado (por ahora ir a `notes`) |

---

## 4. Deduplicación (reglas de negocio)

### 4.1 Nivel Excel: `clientReference` duplicado

Antes de confirmar, dentro de las filas del mismo Excel:

```ts
const clientRefs = new Set<string>();
for (const row of rows) {
  if (clientRefs.has(row.clientReference)) {
    row.error = { kind: "duplicate_in_file", message: `Referencia ${row.clientReference} duplicada dentro del archivo` };
  } else {
    clientRefs.add(row.clientReference);
  }
}
```

### 4.2 Nivel base de datos: `claimNumber + insuranceCompanyId`

Antes de `createClaimFromAloClaim`:

```ts
async function claimExistsByNumberAndCompany(claimNumber: string, insuranceCompanyId: string): Promise<boolean> {
  const { data } = await supabase
    .from("claims")
    .select("id")
    .eq("claim_number", claimNumber)
    .eq("insurance_company_id", insuranceCompanyId)
    .limit(1);
  return !!data?.length;
}
```

Si existe → fila skipped con `reason: "claim_exists"`.

### 4.3 Nivel base de datos: `clientReference` duplicado

```ts
async function clientReferenceExists(clientReference: string): Promise<boolean> {
  const { data } = await supabase
    .from("claims")
    .select("id")
    .eq("client_reference", clientReference)
    .limit(1);
  return !!data?.length;
}
```

Si existe → fila skipped con `reason: "client_reference_exists"`.

---

## 5. Lógica de póliza pendiente

### 5.1 Resolución

```ts
const policyResolution = await resolveOrCreatePolicy({
  companyId,
  policyNumber,
  insuranceCompanyId,
  businessLineId,
  claimDate,
  policyStartDate,
  policyEndDate,
  policyAmount: null,
  policyPremium,
  currencyId: policyCurrencyId || claimCurrencyId,
  brokerId,
});

if (!policyResolution.policyId) {
  return { status: "pending", reason: "policy_unresolved", policyNumber };
}
```

### 5.2 Comportamiento en staging

- La fila se muestra con badge **"Pendiente"** en color ámbar.
- No se crea el `claim`.
- El usuario puede corregir la póliza o el catálogo y volver a cargar.
- Opcional: se podría guardar en una tabla `pending_claims_imports` para re-procesar después.

---

## 6. Resolución de ubicación (recursividad desde comuna)

Aunque el Excel ya trae país, región, ciudad y comuna, el sistema debe resolver las jerarquías por el catálogo para obtener UUIDs consistentes. Para AloClaim se aplican DOS estrategias:

### 6.1 Para la dirección del siniestro

```ts
const location = await resolveCommuneHierarchy(
  data.claimCommune,
  data.claimCity,
  data.claimRegion,
  data.claimCountry,
);
```

### 6.2 Para ubicaciones de asegurado, contratante y beneficiario

Si vienen comuna + ciudad + región + país, se usa `resolveCommuneHierarchy` con cada una. Si no se resuelve, se deja `null` en los `*_id` y se guardan los nombres como texto.

```ts
const insuredLocation = await resolveCommuneHierarchy(
  data.insuredCommune,
  data.insuredCity,
  data.insuredRegion,
  data.insuredCountry,
);
```

### 6.3 Fallback si no hay comuna

Si `claimCommune` es la única presente, `resolveCommuneHierarchy` sube a región, ciudad y país. Si el Excel trae todos, se usan para validar coherencia.

---

## 7. Creación del siniestro (`createClaimFromAloClaim`)

### 7.1 Pasos

1. Calcular `personType` del asegurado con `personTypeFromRut(data.rut)`.
2. Resolver jerarquías de ubicación (asegurado, contratante, beneficiario, siniestro).
3. Resolver póliza con `resolveOrCreatePolicy`.
4. Si póliza no resuelve → `pending`.
5. Deduplicar `clientReference` y `claimNumber + insuranceCompanyId`.
6. Llamar `createClaimMinimal(input, insured, claimAddress, contractor, beneficiary, contact, true)`.

### 7.2 Participantes

| Participante | Origen | `linked_to_insured` |
|--------------|--------|---------------------|
| **Asegurado** | Columnas `RUT/Nombre/Apellido/Email/Celular/Dirección/País/Región/Ciudad/Comuna Asegurado` | — |
| **Contratante** | Columnas `RUT/Nombre/Apellido/... Contratante` explícitas | `true` solo si `contractorRut === insuredRut` **y** `contractorName` coincide con `insuredName`. Si es distinto → `false`. |
| **Beneficiario** | Columnas `RUT/Nombre/Apellido/... Beneficiario` explícitas | `true` solo si `beneficiaryRut === insuredRut` **y** `beneficiaryName` coincide con `insuredName`. Si es distinto → `false`. |
| **Contacto** | No viene en el Excel → crear contacto mínimo ligado al asegurado | `true` |

### 7.3 Regla de "mismo hueón"

```ts
function sameAsInsured(rut?: string | null, name?: string | null, insuredRut?: string | null, insuredName?: string | null): boolean {
  const sameRut = !!rut && !!insuredRut && cleanRut(rut) === cleanRut(insuredRut);
  const sameName = !!name && !!insuredName && name.trim().toLowerCase() === insuredName.trim().toLowerCase();
  return sameRut && sameName;
}

const contractorLinked = sameAsInsured(data.contractorRut, data.contractorName, data.rut, data.insuredName);
const beneficiaryLinked = sameAsInsured(data.beneficiaryRut, data.beneficiaryName, data.rut, data.insuredName);
```

### 7.4 Person type por participante

Cada RUT puede generar un `person_type` distinto. Se debe calcular por separado:

- `insuredPersonType = personTypeFromRut(data.rut)`
- `contractorPersonType = personTypeFromRut(data.contractorRut)`
- `beneficiaryPersonType = personTypeFromRut(data.beneficiaryRut)`

Si `contractorRut` o `beneficiaryRut` están vacíos, se asume el `person_type` del asegurado.

---

## 8. Validaciones por fila

### 8.1 Obligatorios

- `clientReference`
- `claimNumber`
- `insuranceCompany`
- `claimDate`
- `insuranceProduct`
- `rut` (del asegurado)
- `insuredName`
- `claimCommune` (siniestro)

### 8.2 Opcionales pero resueltos

- `businessLine`, `claimType`, `claimCause`, `event`, `currency`, `inspector`, `destinationHousing`, `constructionType`

### 8.3 Formato

- Fechas en formato `DD-MM-YYYY`.
- RUTs chilenos con DV.
- Monedas resueltas por `code` o `name`.

---

## 9. Valores fijos (`refFields`)

Se proponen los mismos 10 campos que `carga-casos`:

| fieldKey | Label | Obligatorio para confirmar |
|----------|-------|---------------------------|
| `insuranceCompany` | Compañía Seguros | Sí |
| `insuranceProduct` | Ramo/Producto | Sí |
| `businessLine` | Línea Negocio | No |
| `claimType` | Tipo Siniestro | No |
| `claimCause` | Causal Siniestro | No |
| `currency` | Moneda | No |
| `inspector` | Inspector | No |
| `event` | Evento | No |
| `destinationHousing` | Destino Vivienda | No |
| `constructionType` | Tipo Construcción | No |

**Nota:** `adjuster` no está en el Excel de AloClaim, por lo que **no** es obligatorio. `insuranceProduct` y `insuranceCompany` sí son obligatorios.

---

## 10. Alcance de `persons` para AloClaim

### Situación actual

- `createClaimParticipant` inserta directamente en `claims_participants` sin tocar `persons`.
- `persons` está desconectada y tiene datos inconsistentes.
- **Decisión del proyecto**: para AloClaim se mantiene el patrón actual. No se conecta con `persons`.

### Fuera del alcance de AloClaim

- No se crean ni actualizan registros en `persons`.
- No se agrega `person_id` a `claims_participants`.
- No se hace lookup en `persons`.

### Después de AloClaim

Una vez limpia la tabla `persons` (ver `docs/PERSON_CLEANUP.md`), se hará una segunda fase para relacionar `persons` con `claims_participants`, al menos para **personas naturales**.

---

## 11. Diferencias clave con `carga-casos`

| Aspecto | `carga-casos` | `carga-aloclaim` |
|---------|---------------|------------------|
| Contratante | Réplica del asegurado | Datos explícitos del Excel |
| Beneficiario | Réplica del asegurado | Datos explícitos del Excel |
| Ajustador | Obligatorio como valor fijo | No existe en el Excel |
| Contacto | Réplica del asegurado si no mapeado | Siempre réplica mínima del asegurado |
| Campos de ubicación | Comuna + dirección del siniestro | País/Región/Ciudad/Comuna para asegurado, contratante, beneficiario y siniestro |
| Destino/Construcción/Daño | No existen | Existen como campos adicionales |
| Deduplicación | `clientReference` + `claimNumber+company` | `clientReference` + `claimNumber+company` |
| Póliza | Si no resuelve, se crea | Si no resuelve, queda **pendiente** |

---

## 12. Tareas de implementación propuestas

1. **Crear `schema-aloclaim.ts`** con los 59 campos y sinónimos.
2. **Crear `carga-aloclaim/page.tsx`** copiando estructura de `carga-casos`.
3. **Crear helpers de deduplicación** en `src/services/claims.ts`:
   - `claimExistsByNumberAndCompany`
   - `clientReferenceExists`
4. **Crear `createClaimFromAloClaim`** en `src/services/claims.ts`.
5. **Agregar ruta al menú** cuando se apruebe.
6. **Documentar** en `docs/CARGA_ALOCLAIM.md`.
7. **Tests con el archivo real** (`Carga Aloclaim 11-08-2026.xlsx`).

---

## 13. Preguntas pendientes para el usuario

1. **¿El campo `Propietario / Asegurado` (col 59) debe guardarse en `claims.notes`, en un campo del participante, o es solo informativo?**
2. **¿`Es Habitable?` se mapea a un campo booleano en `claims` o en el siniestro/inspección?**
3. **¿`Clasif. Daño`, `Tipo Construcción` y `Destino` son catálogos existentes o texto libre?**
4. **¿`No. Siniestro Compañía` debe concatenarse con `claimNumber` tal cual o limpiarse?**
5. **¿El campo `Referencia` es único global o por compañía?**
6. **¿El `clientReference` duplicado se rechaza completo o solo la segunda aparición?**

---

## 14. Aclaraciones

- Este MD es **pre-implementación**.
- No se ha creado ni modificado ningún archivo de código.
- El build (`npx next build`) sigue siendo válido.
- Una vez aprobado este plan, se procede a implementar punto por punto.
