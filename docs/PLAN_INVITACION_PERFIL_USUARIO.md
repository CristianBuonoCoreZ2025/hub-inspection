# Plan: Mejora de Invitación de Usuarios y Perfil de Usuario

> **Estado:** Borrador para aprobación
> **Fecha:** 2026-07-29
> **Autor:** Reunión de producto
> **Alcance:** Pantalla de Invitación de Usuarios + Autogestión del Perfil propio

---

## 1. Contexto — por qué esto es necesario

Hoy el flujo de invitación tiene una grieta estructural:

- `profiles.company_id` (la empresa **principal**) casi siempre queda en `NULL`
  porque la pantalla invoca `inviteUser` con `company_id: ""`.
- La única fuente que queda viva es `user_clients` (la caja de amistades),
  escrita a mano por `setUserClients` después de crear el usuario.
- Las dos funciones que buscan "quién pertenece a la empresa X"
  (`getUsers` y `getUsersByCompany`) no se ponen de acuerdo sobre cuál es
  la fuente de verdad, y por eso una misma persona aparece o desaparece
  según la pantalla.

**Decisión de producto:** `profiles.company_id` vuelve a ser la fuente de
verdad de la empresa principal. `user_clients` mantiene las empresas
**adicionales**. Nunca más se invita sin empresa principal cuando el rol
la requiere.

---

## 2. Reglas funcionales (las que valen)

### 2.1 Invitación — campos obligatorios

| Campo | Obligatorio | Notas |
|---|---|---|
| Primer nombre | Sí | |
| Segundo nombre | Opcional | |
| Apellido | Sí | |
| Email | Sí | Único en `profiles.email` y en `auth.users.email` |
| País (`country_id`) | Sí | Define la zona horaria por defecto (Chile → America/Santiago) |
| Rol | Sí | Uno de: internal, adjuster, inspector, assistant, auditor, dispatcher |
| Cliente principal | Sí si el rol requiere clientes | Uno solo. Si el rol no requiere clientes, se deja vacío |
| Clientes adicionales | Opcional | Multi-selección. El principal siempre queda incluido |
| RUT | Opcional, pero si se ingresa: válido y único | Solo se valida dígito verificador si el país es Chile |
| Teléfono | Opcional | |
| Zona horaria | Automática | Derivada del país (Chile → America/Santiago). No la elige el usuario |

> **`full_name`** se arma automáticamente desde primer + segundo nombre + apellido.
> El usuario administrador **no** lo escribe a mano. Se compone y se guarda
> en `profiles.full_name` para no romper lo que ya existe.

### 2.2 Regla del cliente principal

- Si el rol está en `rolesWithClients` (internal, adjuster, inspector,
  assistant, auditor, dispatcher) **debe** haber un cliente principal
  elegido. No se puede invitar sin uno.
- Si solo se marca un cliente, ese es el principal.
- Si se marcan varios, el **principal es el más antiguo** (el de menor
  `created_at` en `companies`, o en su defecto el de menor `id`).
  Ej: si están McLarens y otra, McLarens queda como principal.
- El cliente principal se guarda en `profiles.company_id`.
- Todos los clientes marcados (incluido el principal) se guardan en
  `user_clients`. El trigger `sync_user_clients_on_profile_change`
  ya se encarga de mantener sincronizado el principal; los adicionales
  los escribe `setUserClients`.

### 2.3 Reglas de unicidad (validación estricta)

- **Email:** no puede existir otro `profiles.email` igual, ni otro
  `auth.users.email` igual. Validación en Zod (async) + checkeo en
  `inviteUser` server-side antes de crear.
- **RUT:** si se ingresa, no puede existir otro `profiles.rut` igual.
  Puede ser `NULL` (no todas las personas tienen RUT), pero si tiene
  valor, es único. Validación en Zod (async) + checkeo server-side.
- **RUT chileno:** si `country_id` corresponde a Chile, el RUT debe
  pasar `validateRut` (dígito verificador correcto). Si el país no es
  Chile, el RUT se guarda tal cual sin validación de DV.

### 2.4 Toggle de clientes (UI)

- Los clientes se muestran como **toggle chips / botones**, no como
  checkboxes sueltos con texto plano.
- Cliente **no marcado** = apagado (gris, opacidad baja).
- Cliente **marcado** = iluminado (color brand, borde activo).
- Al abrir el modal de invitación, **todos los clientes están
  desmarcados**. El usuario los va encendiendo uno a uno.
- El principal se infiere automáticamente (el más antiguo de los
  marcados). No se elige a mano cuál es el principal.
- Mínimo 1 marcado si el rol requiere clientes. Botón "Invitar"
  deshabilitado mientras no se cumpla.

---

## 3. Eliminación y desactivación de usuarios

### 3.1 Dos estados, no uno solo

| Estado | Significado | Cómo se llega |
|---|---|---|
| **Activo** | Usuario normal, puede entrar y operar | Por defecto al invitar |
| **Desactivado** | No puede entrar, pero **se conserva** todo su historial. Aparece en listas atenuado. Se puede reactivar. | Botón "Desactivar" |
| **Eliminado** | Desaparece de la lista principal. Doble confirmación. Solo permitido si **no tiene ningún registro** en el sistema. | Botón "Eliminar" con doble confirmación |

### 3.2 Regla de eliminación (duro)

Un usuario **solo se puede eliminar** si NO tiene ninguno de estos
registros asociados:

- `claims` donde es `adjuster_id`, `inspector_id`, `auditor_id`,
  `dispatcher_id`, `assistant_id`
- `claim_actions` donde es responsable
- `inspection_sessions` donde es inspector
- `inspection_chat_messages`
- `inspection_notes`, `inspection_signatures`
- `audit_logs` donde es el actor
- `user_secondary_roles` (se limpian antes, pero si quedan, bloquea)

Si tiene al menos uno, el botón "Eliminar" se deshabilita y muestra
tooltip: *"No se puede eliminar: tiene registros asociados.
Desactivar en su lugar."*

### 3.3 Doble confirmación

Para eliminar:
1. Primer click → modal: "¿Eliminar a X? Esta acción no se puede deshacer."
2. Segundo click → input: "Escribe el email del usuario para confirmar".
   Solo se habilita el botón rojo si el email coincide exacto.

### 3.4 Vista de desactivados / eliminados

- En la lista de usuarios, un **toggle de filtro**:
  - Activos (default)
  - Desactivados
  - Eliminados
- Los desactivados se muestran atenuados con badge "Inactivo".
- Los eliminados se muestran con badge "Eliminado" y sin acciones.

### 3.5 Implementación de "Eliminado"

Para no perder integridad referencial, "eliminado" se implementa como:

- `profiles.is_active = false`
- `profiles.deleted_at = now()` (columna nueva)
- `profiles.email` se conserva (para auditoría)
- `auth.users` se desactiva (no se borra) — `ban_duration = '87600h'`
  (10 años) vía admin API, o se le revoca el acceso.

> **No se hace `DELETE` físico** de `auth.users` ni de `profiles`.
> Respeta la regla #1 del proyecto (nunca borrar datos sin autorización
> explícita). Aquí el usuario lo autoriza, pero igual conservamos el
> registro para auditoría.

---

## 4. Autogestión del perfil propio

### 4.1 Dónde se accede

- Click en el avatar del usuario (barra superior) → abre panel/modal
  "Mi perfil".
- Arriba del todo va el **blur/avatar** grande del usuario.
- Debajo, los campos editables.

### 4.2 Campos que el usuario puede editar de su propio perfil

| Campo | Editable | Validación |
|---|---|---|
| Foto / avatar | Sí | Subida a Supabase Storage, formato imagen, máx 2MB |
| Teléfono | Sí | Formato libre, saneado |
| RUT | Sí, si está vacío; si ya existe, se puede corregir | Único + DV si es Chile |
| | | |
| Primer nombre | **No** | Solo el admin lo cambia |
| Apellido | **No** | Solo el admin lo cambia |
| Email | **No** | Solo el admin lo cambia |
| Rol | **No** | Solo el admin lo cambia |
| Cliente principal | **No** | Solo el admin lo cambia |
| Clientes adicionales | **No** | Solo el admin lo cambia |
| País | **No** | Solo el admin lo cambia |

### 4.3 Validaciones al guardar el perfil propio

- **RUT:** si lo cambia y ya existe en otro `profiles.rut`, se rechaza
  con error "RUT ya registrado por otro usuario".
- **RUT chileno:** si su `country_id` es Chile, debe pasar `validateRut`.
- **Avatar:** si sube uno nuevo, el viejo se borra del Storage
  (no acumular archivos huérfanos).

### 4.4 Server action

Nuevo server action `updateOwnProfile(input)` que:

- Recibe `{ phone, rut, avatar_url }`.
- Verifica que el `auth.uid()` coincide con el `user_id` del perfil
  que se edita (no se puede editar el perfil de otro).
- Aplica las validaciones de unicidad de RUT.
- No permite tocar `email`, `role`, `company_id`, `first_name`,
  `last_name`, `country_id`.

---

## 5. Cambios técnicos concretos

### 5.1 Migraciones

1. **Migración N — `profiles.deleted_at`**
   ```sql
   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
   CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
     ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;
   ```

2. **Migración N+1 — Unique constraints**
   ```sql
   -- Email único en profiles (parcial: solo no eliminados)
   CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_email_active
     ON profiles(email) WHERE deleted_at IS NULL;

   -- RUT único en profiles (parcial: solo no nulos y no eliminados)
   CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_rut_active
     ON profiles(rut) WHERE rut IS NOT NULL AND deleted_at IS NULL;
   ```

3. **Migración N+2 — Backfill de `company_id` faltante**
   Para los usuarios existentes que tengan `company_id = NULL` pero
   sí tengan filas en `user_clients`, setear `company_id` al más
   antiguo de sus `user_clients`. **No borra nada**, solo completa
   el campo que faltaba.
   ```sql
   UPDATE profiles p
   SET company_id = sub.company_id
   FROM (
     SELECT uc.user_id, min_by(uc.company_id, uc.created_at) AS company_id
     FROM user_clients uc
     GROUP BY uc.user_id
   ) sub
   WHERE p.company_id IS NULL
     AND sub.user_id = p.user_id;
   ```
   (`min_by` disponible en PostgreSQL 14+; si no, usar
   `DISTINCT ON` con subquery.)

### 5.2 Cambios en `inviteUserSchema` (Zod)

```ts
export const inviteUserSchema = z.object({
  firstName: z.string().min(1, "Primer nombre requerido"),
  middleName: z.string().optional().or(z.literal("")),
  lastName: z.string().min(1, "Apellido requerido"),
  email: z.string().email("Correo inválido"),
  countryId: z.string().min(1, "País requerido"),
  role: z.enum(["internal", "adjuster", "inspector", "assistant", "auditor", "dispatcher"]),
  clientIds: z.array(z.string()).default([]),
  phone: z.string().optional().or(z.literal("")),
  rut: z.string().optional().or(z.literal("")),
})
  // Cliente principal obligatorio si el rol requiere clientes
  .refine((d) => {
    const rolesWithClients = ["internal", "adjuster", "inspector", "assistant", "auditor", "dispatcher"];
    if (rolesWithClients.includes(d.role)) return d.clientIds.length > 0;
    return true;
  }, {
    message: "Debes seleccionar al menos un cliente para este rol",
    path: ["clientIds"],
  })
  // RUT con DV si el país es Chile
  .refine((d) => {
    if (!d.rut || d.rut.trim() === "") return true;
    // countryId chileno se resuelve async en el server; aquí validación
    // básica de formato, la de DV se hace server-side con el país real.
    return true;
  });
```

> La validación de **unicidad de email y RUT** se hace **async** con
> `z.refine` consultando a Supabase, o se hace en el server action
> `inviteUser` antes de crear el usuario (preferido: server-side, más
> seguro).

### 5.3 Cambios en `inviteUser` (server action)

- Recibe `firstName, middleName, lastName, email, countryId, role, clientIds, phone, rut`.
- Calcula `fullName = [firstName, middleName, lastName].filter(Boolean).join(" ")`.
- Calcula `company_id` = el más antiguo de los `clientIds` (query a
  `companies` ordenado por `created_at ASC LIMIT 1`).
- Antes de crear el usuario:
  - Verifica que no exista `profiles.email` igual (no eliminado).
  - Verifica que no exista `profiles.rut` igual si se pasó RUT.
  - Si `countryId` es Chile, valida DV del RUT.
- Crea el usuario en `auth.users` con metadata incluyendo `company_id`,
  `first_name`, `last_name`, `country_id`.
- El trigger `handle_new_user` crea el perfil con `company_id` correcto.
- El trigger `sync_user_clients_on_profile_change` crea la fila de
  `user_clients` para el principal automáticamente.
- Después, `setUserClients` agrega los **adicionales** (sin borrar el
  principal que ya puso el trigger). **Importante:** cambiar
  `setUserClients` para que haga `INSERT ON CONFLICT DO NOTHING` en
  vez de borrar y reinsertar, o que excluya al principal del borrado.

### 5.4 Cambios en `setUserClients`

Hoy borra todo y reinserta. Eso choca con el trigger de sincronización.
Cambiar a upsert:

```ts
export async function setUserClients(userId: string, companyIds: string[]): Promise<void> {
  // No borrar: hacer upsert para no pelear con el trigger
  if (companyIds.length === 0) return;
  await upsertMany(
    "user_clients",
    companyIds.map((companyId) => ({ user_id: userId, company_id: companyId })),
    { onConflict: "user_id,company_id" },
  );
}
```

Y agregar un `removeUserClientsNotInList(userId, keepIds)` para cuando
se quita un cliente adicional en edición.

### 5.5 UI — modal de invitación

- Reemplazar input `fullName` por tres inputs: `firstName`, `middleName`
  (opcional), `lastName`.
- Agregar select de país (obligatorio).
- Reemplazar checkboxes de clientes por **toggle chips** visuales:
  - Estado off: `bg-muted text-muted-foreground border-border`
  - Estado on: `bg-primary text-primary-foreground border-primary`
  - Clases CSS en `modals.css` (regla #2: cero inline styles).
- Botón "Invitar" deshabilitado hasta que se cumplan todas las reglas.
- Mensajes de error inline para: email duplicado, RUT duplicado, RUT
  inválido, falta cliente principal.

### 5.6 UI — perfil propio

- Nuevo componente `MyProfileModal` o ruta `/dashboard/mi-perfil`.
- Se abre desde el avatar de la barra superior.
- Muestra avatar grande arriba (con upload).
- Campos editables: teléfono, RUT, avatar.
- Botón "Guardar" llama a `updateOwnProfile`.

### 5.7 UI — lista de usuarios

- Agregar toggle de filtro: Activos / Desactivados / Eliminados.
- Para eliminados: badge "Eliminado", sin acciones.
- Para desactivados: badge "Inactivo", botón "Reactivar" + "Eliminar"
  (si cumple la regla de sin registros).
- Para activos: botones "Editar", "Desactivar", "Eliminar" (si cumple).

### 5.8 Server actions nuevos

- `deleteUser(profileId)` — verifica sin registros, setea
  `deleted_at = now()`, `is_active = false`, banea en `auth.users`.
- `reactivateUser(profileId)` — `is_active = true`, `deleted_at = NULL`,
  desbanea en `auth.users`.
- `canDeleteUser(profileId)` — retorna boolean + razón si no se puede.
- `updateOwnProfile(input)` — validado contra `auth.uid()`.

---

## 6. Orden de implementación sugerido

1. **Migraciones** (deleted_at, unique indexes, backfill company_id).
2. **`setUserClients` → upsert** (no borrar).
3. **`inviteUser` server action** con nuevos campos + validaciones.
4. **`inviteUserSchema`** Zod actualizado.
5. **UI modal de invitación** (3 nombres, país, toggle chips).
6. **Server actions** `deleteUser`, `reactivateUser`, `canDeleteUser`.
7. **UI lista de usuarios** (filtro Activos/Desactivados/Eliminados,
   botones según estado).
8. **`updateOwnProfile`** server action.
9. **UI Mi Perfil** (modal desde avatar).

---

## 7. Lo que NO se toca en este plan

- Sistema de permisos por página (RLS, `usePermissions`).
- Roles secundarios (`user_secondary_roles`) — se siguen gestionando
  desde la edición del usuario, no desde la invitación.
- Workflow de claims, inspecciones, emails.
- Schema de `companies` (solo se lee `created_at` para elegir el
  principal).

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Backfill de `company_id` elige mal para usuarios con varios clientes | Elegir el más antiguo es una heurística; el admin puede corregir a mano después. Documentar en changelog. |
| `setUserClients` upsert vs trigger race condition | El trigger es `AFTER INSERT/UPDATE` en `profiles`; `setUserClients` corre después. El upsert con `ON CONFLICT DO NOTHING` es idempotente. |
| Eliminación suave deja `auth.users` activo | Banear con `ban_duration` largo. Verificar middleware niega acceso a baneados. |
| Validación async de email/RUT duplicado en el cliente | Doble checkeo server-side en `inviteUser` antes de crear. El cliente es solo UX. |

---

## 9. Decisiones confirmadas

- [x] **Zona horaria:** País sugiere valor por defecto + override manual.
      Requiere columna `timezone text` en `profiles` (ej:
      `America/Santiago`). El admin puede cambiarla en la edición; el
      usuario no la toca en su perfil propio.
- [x] **Eliminado:** Suave. `profiles.deleted_at = now()` + ban en
      `auth.users`. No se hace `DELETE` físico. Conserva auditoría.
- [x] **Avatar:** Supabase Storage **público**. Bucket `avatars`. URL
      directa sin token firmado.
- [x] **Cliente principal en lista:** Badge distintivo en la columna
      Clientes (ícono estrella o etiqueta "Principal"). Los adicionales
      van sin marca.

### Migración adicional (timezone)

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text;
```

Default al invitar: derivado del país (Chile → `America/Santiago`).
Se guarda en `profiles.timezone` y el admin puede sobreescribirlo en
la edición del usuario.
