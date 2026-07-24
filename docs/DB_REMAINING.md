# Reporte de Base de Datos y Arquitectura

> Estado al `2026-07-23` después de las migraciones 212 y 213.

---

## ✅ Completado

| # | Tarea | Evidencia |
|---|-------|-----------|
| 1 | `inspection_sessions` recibe `company_id` (backfill desde `claims`), FK a `companies`, índice y RLS forzada. | `migrations/212_inspection_sessions_company_id_rls.sql` |
| 2 | FKs faltantes agregadas para `claim_document_requests.company_id` y `document_requirements.company_id`. | `migrations/213_fix_company_fks.sql` |
| 3 | Reglas de multi-tenancy corregidas en `AGENTS.md`: solo tablas de negocio particionables necesitan `company_id`; catálogos globales no. | `AGENTS.md` |
| 4 | Migración 137 (`DELETE FROM workflow_steps`) documentada como ejemplo de lo que no debe repetirse. | `docs/MIGRATIONS.md` |
| 5 | Audit automatizado en `scripts/db-audit.cjs`. | `scripts/db-audit.cjs` |

---

## 📊 Hallazgos principales del audit

- **RLS está `ENABLED`/`FORCED` en casi todas las tablas**, pero las políticas existentes (`*_select`, `*_insert`, `*_update`, `*_delete`) son permissive y, en la práctica, abiertas.
- **Las tablas de negocio ya tienen `company_id` y FK** en su mayoría. Las tablas hijas (`claim_documents`, `claim_images`, `inspection_evidences`, etc.) **no necesitan** `company_id` directo porque se alcanzan por relación a `claims`/`inspections`.
- **La seguridad real por tenant no está activa** porque las políticas no restringen por `company_id`.

---

## ⚠️ Pendientes (en orden de riesgo/impacto)

### 1. Estrategía de RLS — requiere decisión de arquitectura

**Opción A (más rápida, menos segura):**
- `services` en server usan `SUPABASE_SERVICE_ROLE_KEY`.
- La aplicación filtra por `company_id` en código.
- RLS sigue existente pero no es la línea principal de defensa.

**Opción B (recomendada, más segura):**
- Crear `src/lib/supabase/server.ts` con `createServerClient` usando cookies.
- Las políticas RLS usan `auth.uid()` + `profiles.user_id` para obtener `company_id`/`role`.
- El rol `internal` puede ver todo; los demás solo su `company_id`.
- Requiere que **todos** los `services` en server usen el cliente server.

> **Riesgo:** si se activan políticas restrictivas antes de que los services pasen el tenant/contexto correcto, la app dejará de leer/escribir datos.

### 2. Reemplazar políticas RLS abiertas

Una vez elegida la estrategía, hay que:

1. Borrar las políticas `*_select` / `*_insert` / `*_update` / `*_delete` existentes.
2. Crear políticas tenant por tabla:
   - Tablas con `company_id`: `company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid())`.
   - Tablas hijas: join a `claims`/`inspection_sessions` para obtener el `company_id`.
   - Excepción `internal`.

### 3. `internal` hardcodeado en lógica de negocio

Archivos con `role === "internal"` que deben migrar a permisos:

| Archivo | Línea | Uso actual |
|---------|-------|------------|
| `src/app/dashboard/page.tsx` | 110 / 140 | Filtrar claims, KPIs, secciones del dashboard |
| `src/services/my-gestiones.ts` | 73 | Filtrar gestiones por rol |
| `src/services/topbar-stats.ts` | 133 | Filtrar stats por rol |
| `src/app/dashboard/inspecciones/[id]/page.tsx` | 171 | Seleccionar inspectores |
| `src/app/dashboard/configuracion/page.tsx` | 84 | Mostrar tab "Integraciones" |
| `src/app/dashboard/users/page.tsx` | 156 / 459 / 660 | Lógica de roles secundarios y clientes |
| `src/services/claim-actions.ts` | 499 | Mapeo `internal` → `assigned_adjuster_id` |

### 4. Validar formularios con Zod

- Revisar todos los formularios y agregar esquemas Zod (campos obligatorios, emails, teléfonos, montos).

### 5. Llamadas a datos siempre por `src/services/`

- Revisar pantallas que llaman a Supabase directo y mover a `services/`.

### 6. Preferir Server Components

- Revisar páginas de lectura/catálogo con `"use client"` innecesario.

---

## 🗺️ Próximos pasos recomendados

1. **Elegir estrategía A o B** para RLS.
2. **Implementar el cliente server** (`src/lib/supabase/server.ts`) si se elige B.
3. **Crear `usePermissions` / helper `can()`** y empezar a reemplazar los `role === "internal"` en `page.tsx` y `configuracion/page.tsx`.
4. **Generar migración 214** con políticas RLS tenant para las tablas con `company_id` primero.
5. **Migración 215** con políticas RLS tenant para tablas hijas (joins).

---

## Nota

No se activaron políticas restrictivas todavía para evitar romper la app. El esquema (`company_id` e integridad referencial) ya está saneado.
