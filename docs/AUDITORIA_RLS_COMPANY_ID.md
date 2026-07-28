# Auditoría RLS — Tablas con `company_id` exigido vs. NULL

> **Fecha:** 2026-07-28
> **Generado por:** Devin (auditoría completa de políticas RLS)
> **Contexto:** Bug encontrado en `updateGestion` — `action_template` tenía
> `company_id = NULL` (38 filas globales) pero la política UPDATE exigía
> `is_tenant_allowed(company_id)` que devuelve `false` para NULL. Nadie podía
> editar gestiones. Fix aplicado en migración 268.
>
> Esta auditoría identifica **todas** las tablas con el mismo patrón problemático
> para corregirlas definitivamente.

---

## Resumen ejecutivo

| Estado | Tablas | Acción |
|--------|--------|--------|
| ❌ **Bloqueadas** (filas NULL + RLS exige company_id) | 3 | **Corregir YA** |
| ⚠️ **Riesgo** (0 filas NULL hoy, pero RLS exige) | 12 | Revisar caso a caso |
| ✅ **OK** (RLS permite NULL o no usa tenant) | 3 | Sin acción |

---

## Detalle tabla por tabla

### ❌ BLOQUEADAS — Corregir YA (tienen filas NULL + RLS exige company_id)

#### 1. `action_template` (gestiones)
- **Filas:** 38 total, **38 con `company_id = NULL`** (100% globales)
- **RLS:** SÍ habilitado
- **Políticas problemáticas:**
  - `action_template_tenant_delete` — DELETE: `is_tenant_allowed(company_id)` ❌
  - `action_template_tenant_insert` — INSERT: `with_check = is_tenant_allowed(company_id)` ❌
  - `action_template_tenant_update` — UPDATE: ✅ **YA CORREGIDO** (migración 268)
- **Impacto:**
  - No se pueden **eliminar** gestiones globales (deleteGestion falla)
  - No se pueden **crear** gestiones globales (createGestion falla si no setea company_id)
  - UPDATE ya funciona (fix 268)
- **Fix necesario:** Aplicar `(company_id IS NULL) OR is_tenant_allowed(company_id)` en DELETE e INSERT

#### 2. `document_requirements` (requisitos de documento)
- **Filas:** 11 total, **11 con `company_id = NULL`** (100% globales)
- **RLS:** SÍ habilitado
- **Políticas problemáticas:**
  - `document_requirements_tenant_delete` — DELETE: `is_tenant_allowed(company_id)` ❌
  - `document_requirements_tenant_insert` — INSERT: `with_check = is_tenant_allowed(company_id)` ❌
  - `document_requirements_tenant_update` — UPDATE: `is_tenant_allowed(company_id)` ❌
- **Impacto:** No se pueden editar, crear ni eliminar requisitos de documento globales
- **Fix necesario:** Aplicar `(company_id IS NULL) OR is_tenant_allowed(company_id)` en las 3 políticas

#### 3. `document_templates` (plantillas de documento)
- **Filas:** 6 total, **4 con `company_id = NULL`** (67% globales)
- **RLS:** SÍ habilitado
- **Políticas problemáticas:**
  - `document_templates_tenant_delete` — DELETE: `is_tenant_allowed(company_id)` ❌
  - `document_templates_tenant_insert` — INSERT: `with_check = is_tenant_allowed(company_id)` ❌
  - `document_templates_tenant_update` — UPDATE: `is_tenant_allowed(company_id)` ❌
- **Impacto:** No se pueden editar, crear ni eliminar plantillas globales (las 4 con NULL)
- **Fix necesario:** Aplicar `(company_id IS NULL) OR is_tenant_allowed(company_id)` en las 3 políticas

---

### ⚠️ RIESGO — 0 filas NULL hoy, pero RLS exige company_id

Estas tablas hoy no tienen filas con `company_id = NULL`, así que funcionan.
Pero si alguna vez se inserta una fila global (sin company_id), quedará
**bloqueada** para UPDATE/INSERT/DELETE. Revisar si alguna debería admitir
filas globales en el futuro.

| # | Tabla | Total filas | Políticas que EXIGEN | ¿Debería admitir NULL? |
|---|-------|-------------|---------------------|------------------------|
| 4 | `audit_logs` | 120 | DELETE, INSERT, UPDATE | ❌ No — siempre es de una empresa |
| 5 | `claim_document_requests` | 0 | DELETE, INSERT, UPDATE | ❌ No — siempre es de un claim |
| 6 | `claims` | 20 | DELETE, INSERT, UPDATE | ❌ No — siempre es de una empresa |
| 7 | `claims_staging` | 0 | DELETE, INSERT, UPDATE | ❌ No — siempre es de una empresa |
| 8 | `email_logs` | 0 | DELETE, INSERT, UPDATE | ❌ No — siempre es de una empresa |
| 9 | `email_templates` | 3 | DELETE, INSERT, UPDATE | ⚠️ Revisar — ¿plantillas globales? |
| 10 | `import_field_mappings` | 71 | DELETE, INSERT, UPDATE | ❌ No — siempre es de una empresa |
| 11 | `import_fixed_values` | 5 | DELETE, INSERT, UPDATE | ❌ No — siempre es de una empresa |
| 12 | `import_logs` | 4 | DELETE, INSERT, UPDATE | ❌ No — siempre es de una empresa |
| 13 | `import_value_mappings` | 14 | DELETE, INSERT, UPDATE | ❌ No — siempre es de una empresa |
| 14 | `policies` | 107 | DELETE, INSERT, UPDATE | ❌ No — siempre es de una empresa |
| 15 | `profiles` | 34 | DELETE, INSERT, UPDATE | ❌ No — siempre es de una empresa |
| 16 | `user_clients` | 34 | DELETE, INSERT, UPDATE | ❌ No — siempre es de una empresa |
| 17 | `user_secondary_roles` | 2 | DELETE, INSERT, UPDATE | ❌ No — siempre es de una empresa |

> **Nota sobre `email_templates`:** Hoy tiene 3 filas, todas con `company_id`.
> Si en el futuro se quieren plantillas de email globales (compartidas entre
> empresas), esta tabla necesitará el mismo fix que `action_template`.

---

### ✅ OK — RLS permite NULL o no usa tenant

| # | Tabla | Estado |
|---|-------|--------|
| 18 | `action_template` (SELECT) | ✅ `(company_id IS NULL) OR is_tenant_allowed(company_id)` |
| 19 | `action_template` (UPDATE) | ✅ Fix migración 268 |
| 20 | `inspection_sessions` | ✅ Políticas "other" (no usa is_tenant_allowed) |

---

## Patrón del fix

Para cada tabla bloqueada, cambiar las políticas de:

```sql
-- ANTES (bloquea NULL)
USING (is_tenant_allowed(company_id))
WITH CHECK (is_tenant_allowed(company_id))
```

a:

```sql
-- DESPUÉS (permite NULL = globales)
USING ((company_id IS NULL) OR is_tenant_allowed(company_id))
WITH CHECK ((company_id IS NULL) OR is_tenant_allowed(company_id))
```

El control de permisos (quién puede editar) lo hacen las server actions con
`requirePermission("seccion", "accion")`, no la RLS. La RLS solo asegura
aislamiento entre tenants — las filas globales (NULL) son visibles/editables
para todos los usuarios autenticados con permiso.

---

## Acción inmediata recomendada

Crear migración `269_fix_global_tables_rls.sql` que corrija las 3 tablas
bloqueadas:

1. `action_template` — DELETE e INSERT (UPDATE ya corregido en 268)
2. `document_requirements` — DELETE, INSERT, UPDATE
3. `document_templates` — DELETE, INSERT, UPDATE

**No tocar** las 12 tablas en "riesgo" — hoy funcionan y no deben admitir
filas globales. Solo revisar `email_templates` si se planean plantillas globales.
