# Plan: Documentos del Siniestro (Claim Documents Tab)

## Resumen

Implementar la pestaña "Documentos" del siniestro con 3 secciones, replicando el patrón de la póliza:
1. **Documentos físicos del siniestro** — upload/descarga/eliminación
2. **Documentos físicos de la póliza asociada** — solo lectura
3. **Documentos online de la póliza asociada (CMF)** — solo lectura, derivados de coberturas

## Modelo de Datos

### Tabla `claim_documents` (preexistente, migrada)

La tabla ya existía con una estructura anterior (`doc_code`, `file_path`, `file_url`, `original_filename`, `mime_type`, `type`, `uploaded_by`). Se extendió con columnas compatibles para alinearla con `policy_documents`.

**Migración 117** (`migrations/117_claim_documents.sql`):
- `document_name text` — nombre del archivo
- `document_url text` — URL del archivo subido
- `document_type text` — MIME type
- `is_active boolean DEFAULT true` — soft delete
- `created_by uuid`, `updated_by uuid`
- Migración de datos: `document_name = original_filename`, `document_url = file_url`, `document_type = mime_type`
- RLS habilitado, política `claim_documents_all` (USING true)
- Trigger `claim_documents_updated_at` (reutiliza `trg_policies_updated_at()`)
- Índices: `idx_claim_documents_claim_id`, `idx_claim_documents_active`

### Hasura
- Tabla trackeada vía `scripts/track-claim-docs.cjs`
- Campos expuestos en GraphQL: `claim_id`, `document_name`, `document_url`, `document_type`, `file_size`, `is_active`, `created_at`, `updated_at`, etc.

## Servicios

### `src/services/claim-documents-physical.ts`

```typescript
interface ClaimDocument {
  id: string;
  claim_id: string;
  document_name: string;
  document_url: string | null;
  document_type: string | null;
  file_size: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

getClaimDocuments(claimId)       // query: claim_documents where is_active = true
createClaimDocument(input)       // insert_claim_documents_one
deactivateClaimDocument(id)      // update _set: { is_active: false }
```

Espejo de `policy_documents` en `src/services/policies.ts`.

## Componente

### `src/app/dashboard/claims/[id]/claim-documents-tab.tsx`

Props: `{ claimId, policyId }`

#### Sección 1: Documentos del Siniestro (físicos)
- Query: `getClaimDocuments(claimId)`
- Upload vía `/api/inspection/upload` → `createClaimDocument`
- Eliminación: `deactivateClaimDocument` (soft delete)
- Permisos: `canCreate("claims_documentos")`, `canDelete("claims_documentos")`
- Columnas: Nombre, Tipo, Tamaño, Acciones (Ver, Eliminar)

#### Sección 2: Documentos de la Póliza (físicos, solo lectura)
- Query: `getPolicyDocuments(policyId)` (servicio existente)
- Solo lectura — no se pueden subir ni eliminar desde el siniestro
- Columnas: Nombre, Tipo, Tamaño, Ver
- Si no hay `policy_id`: mensaje "El siniestro no tiene póliza asociada"

#### Sección 3: Documentos Online (CMF, solo lectura)
- Queries:
  - `getPolicyCoveragesByPolicyIdDirect(policyId)` — coberturas de la póliza
  - `getCoverageCatalog()` — catálogo con `document_url`
  - `getSubcoveragesByCoverageIds(ids)` — subcoberturas con `document_url`
- Lógica `onlineDocuments` (useMemo): recorre `policyCoverages`, busca en catálogo, deduplica por URL
- Tipos: `POL` (cobertura) y `CAD` (subcobertura)
- Columnas: Tipo, Código, Cobertura, Subcobertura, Ver
- Si no hay `policy_id`: mensaje "El siniestro no tiene póliza asociada"

## Integración

### `src/app/dashboard/claims/[id]/page.tsx`

- Import: `import ClaimDocumentsTab from "./claim-documents-tab"`
- Reemplazo del placeholder estático (tab "documentos") por:
  ```tsx
  <ClaimDocumentsTab claimId={id} policyId={claim?.policy_id ?? null} />
  ```
- El `policy_id` viene de `getClaimById` (ya existente en el query del claim)

## Archivos Creados/Modificados

| Archivo | Acción |
|---|---|
| `migrations/117_claim_documents.sql` | Creado — extiende tabla existente |
| `src/services/claim-documents-physical.ts` | Creado — servicio CRUD |
| `src/app/dashboard/claims/[id]/claim-documents-tab.tsx` | Creado — componente con 3 secciones |
| `src/app/dashboard/claims/[id]/page.tsx` | Modificado — import + reemplazo placeholder |
| `scripts/track-claim-docs.cjs` | Creado — trackear tabla en Hasura |
| `scripts/check-claim-docs.cjs` | Creado — verificar columnas |
| `scripts/check-schema2.cjs` | Creado — verificar schema GraphQL |

## Verificación

- ✅ Migración ejecutada (`pnpm db:push`)
- ✅ Tabla trackeada en Hasura (campos visibles en GraphQL)
- ✅ Lint limpio (`eslint` sin errores)
- ✅ Typecheck limpio (`tsc --noEmit` sin errores)

## Notas

- El upload usa el mismo endpoint que la póliza: `/api/inspection/upload`
- Los documentos de la póliza (físicos y online) son de **solo lectura** desde el siniestro
- Si el siniestro no tiene `policy_id`, las secciones 2 y 3 muestran mensaje informativo
- La tabla `claim_documents` mantiene compatibilidad con la estructura anterior (columnas originales no se eliminaron)
