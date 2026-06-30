# Plan: Arreglar Módulo de Inspección

## Estado Actual: NO FUNCIONA

El módulo de inspección tiene 5 problemas críticos que impiden que funcione:

---

## Problemas Críticos

### 1. `inspection_sessions.status` falta `scheduled` en CHECK constraint
- **DB:** `CHECK (status IN ('pending','active','completed','cancelled'))`
- **Código:** usa `scheduled` en `page.tsx`, `[id]/page.tsx`, `types/index.ts`
- **Síntoma:** Error de PostgreSQL al intentar cambiar estado a `scheduled`
- **Fix:** Migración que reemplaza el CHECK para incluir `scheduled`

### 2. `inspection_evidences` esquema no coincide
- **DB:** `file_url`, `file_type`, `claim_id` (NOT NULL), `captured_by`, `captured_at`, `metadata`
- **Código:** `type`, `url`, `description`
- **Síntoma:** Queries GraphQL fallan (campos no existen en Hasura schema)
- **Fix:** Migración que renombra `file_url`→`url`, `file_type`→`type`, agrega `description`, hace `claim_id` nullable

### 3. `inspection_signatures` esquema no coincide
- **DB:** `signature_data`, `signer_role`, `signer_id`, `device_info`
- **Código:** `signature_url`, `role`
- **Síntoma:** Firmas no se guardan/cargan
- **Fix:** Migración que renombra `signature_data`→`signature_url`, `signer_role`→`role`

### 4. `inspection_reports` esquema no coincide
- **DB:** `report_url`, `generated_by`, `generated_at`, `claim_id`
- **Código:** `report_url`, `generated_at`, `status`
- **Síntoma:** Falta columna `status` en DB
- **Fix:** Migración que agrega `status` con default `draft`

### 5. Queries de claim usan campos que ya no existen
- **Código en `inspections.ts`:** `claim { claim_number insured_name address city insurance_company ... }`
- **DB actual:** `insured_name`, `address`, `city`, `insurance_company` fueron migrados a FKs o movidos a `claims_participants`
- **Síntoma:** TODOS los queries de inspección que incluyen `claim { ... }` fallan
- **Fix:** Actualizar queries para usar campos que existen + resolver nombres vía FKs/participantes

---

## Migración 55: Fix inspection schema

```sql
-- 1. inspection_sessions: agregar 'scheduled' al CHECK
ALTER TABLE inspection_sessions DROP CONSTRAINT inspection_sessions_status_check;
ALTER TABLE inspection_sessions ADD CONSTRAINT inspection_sessions_status_check
  CHECK (status IN ('pending','scheduled','active','completed','cancelled'));

-- 2. inspection_evidences: renombrar campos + agregar description
ALTER TABLE inspection_evidences RENAME COLUMN file_url TO url;
ALTER TABLE inspection_evidences RENAME COLUMN file_type TO type;
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE inspection_evidences ALTER COLUMN claim_id DROP NOT NULL;

-- 3. inspection_signatures: renombrar campos
ALTER TABLE inspection_signatures RENAME COLUMN signature_data TO signature_url;
ALTER TABLE inspection_signatures RENAME COLUMN signer_role TO role;

-- 4. inspection_reports: agregar status
ALTER TABLE inspection_reports ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE inspection_reports ADD CONSTRAINT inspection_reports_status_check
  CHECK (status IN ('draft','generated','sent'));
```

## Cambios en Código

### `src/services/inspections.ts`
- `getInspectionSessions`: cambiar `claim { ... }` para usar campos que existen:
  ```graphql
  claim {
    claim_number policy_number claim_date client_reference liquidation_number
    claim_address
    claims_participants(where: { type: { _eq: "insured" } }) { full_name }
    insurance_company { name }
  }
  ```
- `getInspectionSessionById`: igual, adaptar campos del claim
- `EVIDENCE_FIELDS`: ya usa `type url description` ✓ (coincide después de migración)
- `SIGNATURE_FIELDS`: ya usa `role signature_url` ✓ (coincide después de migración)
- `REPORT_FIELDS`: ya usa `report_url generated_at status` ✓ (coincide después de migración)

### `src/types/index.ts`
- `InspectionSession.status`: ya tiene `scheduled` ✓
- `InspectionEvidence`: ya tiene `type url description` ✓
- `InspectionSignature`: ya tiene `role signature_url` ✓
- `InspectionReport`: ya tiene `status` ✓
- Actualizar tipo del claim anidado en InspectionSession si es necesario

### `src/app/dashboard/inspecciones/page.tsx`
- Actualizar cómo accede a datos del claim (usar `claim.claims_participants[0].full_name` en vez de `claim.insured_name`)

### `src/app/dashboard/inspecciones/[id]/page.tsx`
- Actualizar cómo accede a datos del claim

---

## Orden de Implementación

1. ~~Escribir este plan~~ ✅
2. Crear migración 55
3. Ejecutar migración
4. Actualizar `inspections.ts` (queries de claim)
5. Actualizar `inspecciones/page.tsx` (acceso a datos del claim)
6. Actualizar `inspecciones/[id]/page.tsx` (acceso a datos del claim)
7. Build
8. Commit
