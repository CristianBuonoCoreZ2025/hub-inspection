# Auditoría `company_id` — Dónde está, dónde es NULL, dónde no se carga

> **Fecha:** 2026-07-28
> **Propósito:** Identificar todas las tablas con columna `company_id`,
> clasificarlas por uso real (NULL vs. con valor), y detectar qué
> mantenedores NO lo envían al crear/editar registros.
>
> **Objetivo:** Decidir de qué tablas quitar `company_id` definitivamente
> (las que son globales y nunca lo usan) vs. las que sí lo necesitan.

---

## 1. Dónde está `company_id` (18 tablas)

Todas las tablas con columna `company_id` en el schema:

| # | Tabla | Total filas | NULL | % NULL | RLS | NOT NULL constraint |
|---|-------|-------------|------|--------|-----|---------------------|
| 1 | `action_template` | 38 | 38 | **100%** | SÍ | nullable |
| 2 | `audit_logs` | 120 | 0 | 0% | SÍ | nullable |
| 3 | `claim_document_requests` | 0 | 0 | 0% | SÍ | nullable |
| 4 | `claims` | 20 | 0 | 0% | SÍ | **NOT NULL** |
| 5 | `claims_staging` | 0 | 0 | 0% | SÍ | nullable |
| 6 | `document_requirements` | 11 | 11 | **100%** | SÍ | nullable |
| 7 | `document_templates` | 6 | 4 | **67%** | SÍ | nullable |
| 8 | `email_logs` | 0 | 0 | 0% | SÍ | **NOT NULL** |
| 9 | `email_templates` | 3 | 0 | 0% | SÍ | **NOT NULL** |
| 10 | `import_field_mappings` | 71 | 0 | 0% | SÍ | **NOT NULL** |
| 11 | `import_fixed_values` | 5 | 0 | 0% | SÍ | **NOT NULL** |
| 12 | `import_logs` | 4 | 0 | 0% | SÍ | **NOT NULL** |
| 13 | `import_value_mappings` | 14 | 0 | 0% | SÍ | **NOT NULL** |
| 14 | `inspection_sessions` | 0 | 0 | 0% | SÍ | **NOT NULL** |
| 15 | `policies` | 107 | 0 | 0% | SÍ | **NOT NULL** |
| 16 | `profiles` | 34 | 0 | 0% | SÍ | nullable |
| 17 | `user_clients` | 34 | 0 | 0% | SÍ | **NOT NULL** |
| 18 | `user_secondary_roles` | 2 | 0 | 0% | SÍ | nullable |

---

## 2. Tablas donde TODAS las filas son NULL (globales)

Estas tablas tienen `company_id` pero **nunca se usa** — todas las filas son NULL:

### 2.1 `action_template` (gestiones) — 38 filas, 100% NULL

- **Columna:** nullable (acepta NULL)
- **Mantenedor:** `src/app/dashboard/catalogos/gestiones/gestiones/page.tsx`
- **Server action:** `src/server/actions/gestiones.ts` → `createGestion()`
- **¿Envía `company_id`?** ❌ **NO**
  - `FormState` no tiene campo `company_id`
  - `createGestion()` recibe `input` sin `company_id`
  - El INSERT se hace con `filtered` que no incluye `company_id`
- **Conclusión:** `company_id` en esta tabla **nunca se setea**.
  Las 38 gestiones son globales (visibles para todas las empresas).
  **Se puede quitar la columna.**

### 2.2 `document_requirements` (requisitos de documento) — 11 filas, 100% NULL

- **Columna:** nullable
- **Mantenedor:** `src/app/dashboard/catalogos/lineas-negocio/page.tsx`
- **Service:** `src/services/claim-documents.ts` → `createDocumentRequirement()`
- **¿Envía `company_id`?** ❌ **NO**
  - `createDocumentRequirement()` recibe: `business_line_id`, `document_type_code`,
    `description`, `is_required`, `sort_order`
  - No recibe ni setea `company_id`
  - El INSERT no incluye `company_id`
- **Conclusión:** `company_id` en esta tabla **nunca se setea**.
  Los requisitos son globales (asociados a línea de negocio, no a empresa).
  **Se puede quitar la columna.**

### 2.3 `document_templates` (plantillas de documento) — 4 de 6 NULL (67%)

- **Columna:** nullable
- **Mantenedor:** `src/app/dashboard/catalogos/gestiones/gestiones/document-templates-card.tsx`
- **Service:** `src/services/document-templates.ts` → `createDocumentTemplate()`
- **¿Envía `company_id`?** ⚠️ **SÍ, opcional** (`input.company_id ?? null`)
  - El service SÍ acepta `company_id` en `DocumentTemplateInput`
  - Pero el mantenedor (`document-templates-card.tsx`) lo gestiona como
    **asociación posterior** (no en la creación):
    - Crea la plantilla sin `company_id` (global)
    - Luego permite asociarla a una empresa via `handleAssociationChange()`
  - 4 plantillas son globales (NULL), 2 tienen `company_id` asignado
- **Conclusión:** `company_id` aquí **sí se usa** para asociar plantillas a
  empresas específicas, pero es opcional. Las globales (NULL) son visibles
  para todos. **NO quitar la columna** — es funcional.

---

## 3. Tablas donde NO se carga `company_id` por el mantenedor

Resumen de las 3 tablas auditadas a nivel código:

| Tabla | ¿Mantenedor envía `company_id`? | Tipo | Conclusión |
|-------|--------------------------------|------|------------|
| `action_template` | ❌ NO | nullable | **Quitar columna** — nunca se usa |
| `document_requirements` | ❌ NO | nullable | **Quitar columna** — nunca se usa |
| `document_templates` | ⚠️ SÍ (opcional, post-creación) | nullable | **Conservar** — es funcional |

### Detalle por mantenedor

#### `action_template` — Gestiones
- **Archivo UI:** `src/app/dashboard/catalogos/gestiones/gestiones/page.tsx`
- **FormState (líneas 55-83):** NO incluye `company_id`
- **createGestion (línea 202):** envía `...rest` sin `company_id`
- **Server action:** `src/server/actions/gestiones.ts`
  - `ALLOWED_ON_CREATE` (línea 87) incluye `"company_id"` pero el frontend
    nunca lo envía, así que llega como `undefined` y no se inserta
- **Resultado:** 38 filas, todas con `company_id = NULL`

#### `document_requirements` — Requisitos de documento
- **Archivo UI:** `src/app/dashboard/catalogos/lineas-negocio/page.tsx`
- **createDocumentRequirement (línea 311):** envía solo `business_line_id`,
  `document_type_code`, `is_required`, `sort_order`
- **Service:** `src/services/claim-documents.ts` (línea 235)
  - El INSERT no incluye `company_id`
- **Resultado:** 11 filas, todas con `company_id = NULL`

#### `document_templates` — Plantillas de documento
- **Archivo UI:** `src/app/dashboard/catalogos/gestiones/gestiones/document-templates-card.tsx`
- **createDocumentTemplate (línea 88):** envía `input` que puede incluir `company_id`
- **Service:** `src/services/document-templates.ts` (línea 105)
  - El INSERT incluye `company_id: input.company_id ?? null`
  - Si no se envía, queda NULL (global)
- **Asociación post-creación (línea 327):** `handleAssociationChange()`
  permite asignar `company_id` después de crear
- **Resultado:** 4 globales (NULL) + 2 con empresa asignada

---

## 4. Recomendación final

### Quitar `company_id` definitivamente (2 tablas)

| Tabla | Razón | Migración necesaria |
|-------|-------|---------------------|
| `action_template` | 38/38 filas NULL. Nunca se setea. Gestiones son globales. | DROP COLUMN + dropear políticas RLS que la referencian |
| `document_requirements` | 11/11 filas NULL. Nunca se setea. Requisitos son por línea de negocio. | DROP COLUMN + dropear políticas RLS que la referencian |

### Conservar `company_id` (16 tablas)

| Tabla | Razón |
|-------|-------|
| `document_templates` | 2/6 filas lo usan. Es opcional pero funcional. |
| `claims`, `policies`, `profiles`, etc. (15 tablas) | 0% NULL. NOT NULL constraint. Esencial para multi-tenant. |

---

## 5. Plan de migración (si se aprueba quitar)

Para `action_template` y `document_requirements`:

```sql
-- 1. Dropear políticas RLS que referencian company_id
DROP POLICY IF EXISTS action_template_tenant_select ON action_template;
DROP POLICY IF EXISTS action_template_tenant_insert ON action_template;
DROP POLICY IF EXISTS action_template_tenant_update ON action_template;
DROP POLICY IF EXISTS action_template_tenant_delete ON action_template;

DROP POLICY IF EXISTS document_requirements_tenant_select ON document_requirements;
DROP POLICY IF EXISTS document_requirements_tenant_insert ON document_requirements;
DROP POLICY IF EXISTS document_requirements_tenant_update ON document_requirements;
DROP POLICY IF EXISTS document_requirements_tenant_delete ON document_requirements;

-- 2. Dropear la columna
ALTER TABLE action_template DROP COLUMN IF EXISTS company_id;
ALTER TABLE document_requirements DROP COLUMN IF EXISTS company_id;

-- 3. Crear políticas RLS simples (sin company_id)
--    o deshabilitar RLS si no hay otro criterio de aislamiento
```

**Nota:** Si se quita `company_id`, hay que decidir qué política RLS aplicar:
- Sin RLS: cualquier usuario autenticado ve/edita todas las filas
- RLS por rol: solo usuarios con permiso `catalogos` pueden editar
- RLS por otra columna: si existe otro criterio de aislamiento

**Recomendación:** Deshabilitar RLS en estas 2 tablas (son catálogos
globales de configuración) y dejar el control de permisos en las server
actions con `requirePermission("catalogos", "edit")`.
