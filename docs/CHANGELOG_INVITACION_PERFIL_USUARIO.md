# Changelog — Mejora de Invitación de Usuarios y Perfil de Usuario

> **Fecha:** 2026-07-29
> **Plan de referencia:** [`docs/PLAN_INVITACION_PERFIL_USUARIO.md`](PLAN_INVITACION_PERFIL_USUARIO.md)
> **Estado:** Implementado, pendiente de aplicar migraciones en producción

---

## Resumen

Se reescribió el flujo de invitación de usuarios para que `profiles.company_id`
vuelva a ser la fuente de verdad de la empresa principal. Se agregaron
validaciones de unicidad de email y RUT, eliminación suave con doble
confirmación, autogestión del perfil propio, y toggle chips visuales para
seleccionar clientes.

---

## Migraciones (4 nuevas)

### `275_profiles_deleted_at_timezone.sql`
- Agrega `profiles.deleted_at timestamptz` (eliminación suave).
- Agrega `profiles.timezone text` (zona horaria del usuario).
- Índice en `deleted_at` para filtrar eliminados.

### `276_profiles_unique_email_rut.sql`
- `uq_profiles_email_active`: email único (case-insensitive) entre no eliminados.
- `uq_profiles_rut_active`: RUT único entre no eliminados y no nulos.
- Parciales (`WHERE deleted_at IS NULL`) para no bloquear re-invitaciones.

### `277_backfill_profiles_company_id.sql`
- Completa `profiles.company_id` para usuarios existentes que lo tienen en
  `NULL` pero sí tienen filas en `user_clients`.
- Elige el cliente más antiguo (`DISTINCT ON` + `ORDER BY created_at ASC`).
- **No borra nada.** Solo completa el campo faltante.

### `278_can_delete_user_rpc.sql`
- `can_delete_user(p_profile_id)`: retorna `true` si el usuario no tiene
  registros en claims, claim_actions, inspection_sessions, inspection_chat_messages,
  inspection_notes, inspection_signatures, inspection_reports, audit_logs,
  user_secondary_roles.
- `soft_delete_user(p_profile_id)`: marca `deleted_at = now()` + `is_active = false`.
- `reactivate_user(p_profile_id)`: revierte la eliminación suave.

---

## Cambios en servicios

### `src/services/user-clients.ts`
- `setUserClients` cambiado de **delete + insert** a **upsert** (`ON CONFLICT DO NOTHING`).
  Antes peleaba con el trigger `sync_user_clients_on_profile_change`. Ahora es idempotente.
- Nueva función `removeUserClientsNotInList(userId, keepIds)`: elimina los
  `user_clients` que no estén en la lista, sin tocar el principal.

### `src/services/users-server.ts` (rewritten)
- `inviteUser` ahora recibe: `firstName, middleName, lastName, email, countryId,
  role, clientIds, phone, rut`.
- Calcula `fullName` automáticamente desde primer + segundo nombre + apellido.
- **Valida unicidad de email** antes de crear (query a `profiles` con `ilike` + `deleted_at IS NULL`).
- **Valida unicidad de RUT** si se ingresa.
- **Valida DV del RUT** si el país es Chile (`validateRut`).
- **Calcula el cliente principal** automáticamente: el más antiguo de los marcados
  (`companies` ordenado por `created_at ASC LIMIT 1`).
- **Deriva la zona horaria** del país (Chile → `America/Santiago`, etc.).
- Pasa `company_id`, `first_name`, `last_name`, `country_id`, `timezone` en
  `user_metadata` para que el trigger `handle_new_user` los use.
- Inserta los clientes adicionales vía upsert (no borrar).

### `src/services/users-ops-server.ts` (nuevo)
- `deleteUser(profileId)`: verifica `can_delete_user` → `soft_delete_user` →
  banea en `auth.users` (`ban_duration: 87600h` = 10 años).
- `reactivateUser(profileId)`: `reactivate_user` RPC → desbanea en `auth.users`.
- `canDeleteUser(profileId)`: wrapper de la RPC.
- `updateOwnProfile({ phone, rut, avatar_url })`: valida `auth.uid()`, unicidad
  de RUT, DV si es Chile. No permite tocar email, role, company_id, nombres, país.

### `src/lib/supabase/db.ts`
- Nueva función `upsertMany` para `INSERT ... ON CONFLICT DO UPDATE/NOTHING`.

### `src/lib/perf-metrics.ts`
- Agregado `"upsert"` al tipo `DbOperation`.

---

## Cambios en validaciones

### `src/lib/validations.ts`
- `inviteUserSchema` reescrito:
  - `firstName` (obligatorio), `middleName` (opcional), `lastName` (obligatorio)
    en vez de `fullName`.
  - `countryId` obligatorio (antes opcional).
  - `clientIds` array de strings (antes opcional).
  - `phone`, `rut` opcionales.
  - `.refine()` que exige al menos 1 cliente si el rol requiere clientes.

---

## Cambios en API routes

### `src/app/api/users/invite/route.ts`
- Body actualizado: `{ firstName, middleName?, lastName, email, countryId, role, clientIds, phone?, rut? }`.
- Ya no recibe `company_id` ni `fullName` (se calculan server-side).

### `src/app/api/users/delete/route.ts` (nuevo)
- `POST /api/users/delete` con `{ profileId }`.

### `src/app/api/users/reactivate/route.ts` (nuevo)
- `POST /api/users/reactivate` con `{ profileId }`.

### `src/app/api/users/me/route.ts` (nuevo)
- `POST /api/users/me` con `{ phone?, rut?, avatar_url? }`.
- Actualiza el perfil propio del usuario autenticado.

---

## Cambios en UI

### `src/app/dashboard/users/page.tsx` (rewritten)

**Modal de invitación:**
- 3 inputs de nombre: primer nombre (obligatorio), segundo nombre (opcional),
  apellido (obligatorio). El `full_name` se compone automáticamente.
- Select de país obligatorio.
- Inputs de teléfono y RUT opcionales.
- **Toggle chips** para clientes (clases CSS `.user-client-toggle-chip-on/off`).
  Todos empiezan apagados; se encienden al clickar. El principal se infiere
  automáticamente (el más antiguo de los marcados).
- Botón "Invitar" deshabilitado si no hay cliente seleccionado y el rol lo requiere.

**Modal de edición:**
- Mantiene los campos completos (primer nombre, segundo nombre, apellido, email,
  teléfono, RUT, país).
- Toggle chips para clientes en edición también.

**Lista de usuarios:**
- **Filtro de estado** con tabs: Activos / Desactivados / Eliminados
  (clases `.user-filter-tab` / `.user-filter-tab-active`).
- **Badge de cliente principal**: ícono de estrella dorada (`.user-client-primary-icon`)
  junto al nombre del cliente que coincide con `profiles.company_id`.
- Filas atenuadas para desactivados (`.user-row-inactive`) y eliminados
  (`.user-row-deleted` con `line-through`).
- Botones según estado:
  - Activos: Editar, Desactivar.
  - Desactivados: Editar, Eliminar (con doble confirmación), Reactivar.
  - Eliminados: Reactivar.

**Modal de eliminación (doble confirmación):**
- Modal `modal-sm` que pide escribir el email exacto del usuario.
- Botón "Eliminar definitivamente" (`.pg-btn-danger`) solo se habilita si el
  email coincide.
- Llama a `POST /api/users/delete`.

### `src/components/layout/my-profile-modal.tsx` (nuevo)
- Modal "Mi Perfil" que se abre al clickar el avatar en la topbar.
- Avatar grande arriba (`.my-profile-avatar-wrap`).
- Datos no editables (nombre, email) en inputs deshabilitados.
- Datos editables: teléfono, RUT, URL de avatar.
- Botón "Guardar" llama a `POST /api/users/me`.

### `src/components/layout/top-bar.tsx`
- Avatar ahora es un botón clickeable (`.topbar-avatar-btn`) que abre el modal
  "Mi Perfil".
- Importa `AvatarImage` (antes solo `AvatarFallback`).
- Muestra `profile.avatar_url` si existe.

### `src/hooks/use-auth.ts`
- `UserProfile` ampliado con `first_name, last_name, phone, rut, avatar_url`.
- Select de profiles ampliado para traer esos campos.

### `src/types/index.ts`
- `Profile` ampliado con `deleted_at: string | null`.

---

## Cambios en CSS

### `src/app/styles/modals.css`
Nuevas clases (todas con `!important` para inmunidad a skins):

- `.user-client-toggle-grid` — grid de toggle chips para clientes.
- `.user-client-toggle-chip` — chip base (pill, 12px, 500 weight).
- `.user-client-toggle-chip-off` — estado apagado (muted, opacity 0.6).
- `.user-client-toggle-chip-on` — estado encendido (primary, sombra).
- `.user-filter-tabs` — contenedor de tabs de filtro.
- `.user-filter-tab` — tab individual.
- `.user-filter-tab-active` — tab activo (background, sombra).
- `.user-client-badge-wrap` — wrap del badge de cliente en la lista.
- `.user-client-primary-icon` — estrella dorada (12px, fill amber).
- `.user-row-inactive` — fila atenuada (opacity 0.6).
- `.user-row-deleted` — fila eliminada (opacity 0.4, line-through).
- `.pg-btn-danger` — botón rojo de eliminación definitiva.
- `.topbar-avatar-btn` — botón del avatar en la topbar (hover scale 1.08).
- `.my-profile-avatar-wrap` — wrap del avatar grande en Mi Perfil.

---

## Verificación

- `npx tsc --noEmit` → **0 errores**.
- `npx eslint` (todos los archivos tocados) → **0 errores, 0 warnings**.

---

## Pendientes

- [ ] Aplicar migraciones 275-278 en producción (`pnpm db:push`).
- [ ] Subida directa de avatar a Supabase Storage (hoy se pega la URL;
      el plan dice bucket público `avatars`).
- [ ] Verificar que el middleware niegue acceso a usuarios baneados.
- [ ] Test end-to-end: invitar usuario nuevo con 2 clientes, verificar que
      el principal queda en `profiles.company_id` y ambos en `user_clients`.

---

## Fix posterior — Sincronización de email entre `profiles` y `auth.users`

### Problema

Al editar el email de un usuario desde el frontend, solo se actualizaba
`profiles.email` (vía `updateUser`). `auth.users.email` quedaba con el
valor antiguo, así que el usuario no podía entrar con el nuevo correo.

### Solución

- **Nuevo server action** `updateUserEmail(profileId, newEmail)` en
  `src/services/users-ops-server.ts`:
  1. Valida formato del email.
  2. Verifica unicidad en `profiles` (no eliminados, excluyendo el propio).
  3. Verifica unicidad en `auth.users` (vía `listUsers`).
  4. Actualiza `auth.users.email` con `admin.updateUserById`.
  5. Actualiza `profiles.email`.
  6. Loggea el cambio (email viejo → nuevo) para auditoría.

- **Nueva API route** `POST /api/users/update-email` con `{ profileId, newEmail }`.

- **`updateMutation`** en `src/app/dashboard/users/page.tsx`:
  - Guarda `originalEmail` al abrir la edición (`openEdit`).
  - Antes de llamar `updateUser`, compara el email nuevo con el original.
    Si cambió, llama a `/api/users/update-email` primero. Si falla, aborta
    la actualización (no se actualiza nada).
  - Si el email no cambió, no llama a la API route (sin overhead).

### Archivos tocados

- `src/services/users-ops-server.ts` — nuevo `updateUserEmail`.
- `src/app/api/users/update-email/route.ts` — nueva API route.
- `src/app/dashboard/users/page.tsx` — `originalEmail` state, `openEdit` lo guarda,
  `updateMutation` sincroniza email si cambió, `onSubmit` pasa `originalEmail`.
