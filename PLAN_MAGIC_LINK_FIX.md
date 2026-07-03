# Plan: Fix Magic Link de Inspección (se queda cargando / no muestra capturas en vivo)

## Síntoma
- El magic link `/inspection/[token]` se queda en "Conectando a la inspección..." (spinner) y nunca muestra lo que el inspector captura en línea.

## Causa Raíz (3 problemas)

### 1. Nombres de campos GraphQL incorrectos en `getInspectionSessionLive`
`src/services/inspections.ts` líneas 130-144. La query pide campos que NO existen en el schema actual:

| Tabla | Query pide (incorrecto) | Schema real (migraciones 01, 55, 56, 09) |
|-------|------------------------|-------------------------------------------|
| `inspection_evidences` | `file_url`, `file_type` | `url`, `type` (renombrado en migración 55) + `category` (56) + `description` (55) |
| `inspection_checklists` | `item_name`, `item_status`, `item_observations` | `area`, `item`, `status`, `notes` |
| `inspection_chat_messages` | `message` | `content` |
| `inspection_damages` | `description`, `damage_type`, `severity` | ✓ correcto |
| `inspection_notes` | `content` | ✓ correcto |

**Impacto:** Cualquier campo inexistente hace que Hasura rechace TODA la query → error → React Query reintenta 3x → `isError` → "Link inválido". Durante los reintentos se ve el spinner ("se queda cargando").

### 2. UI del magic link usa los mismos nombres incorrectos
`src/app/inspection/[token]/page.tsx`:
- `ev.file_url`, `ev.file_type === "image"` → debe ser `ev.url`, `ev.type === "photo"` (valores reales: `photo|video|pdf|document`)
- `cl.item_name`, `cl.item_status` (`ok|fail`), `cl.item_observations` → debe ser `cl.item`, `cl.status` (`reviewed|pending|not_applicable`), `cl.notes`
- `msg.message` → debe ser `msg.content`

### 3. Permisos Hasura: rol `anonymous` sin SELECT
- El magic link es público (sin login). El middleware permite `/inspection/` sin auth.
- La página es Client Component y llama a `getInspectionSessionLive` → `graphqlRequest` → Nhost client del navegador → rol **anonymous**.
- `scripts/setup-hasura-permissions.ts` solo configura el rol **`user`**. No hay permisos para `anonymous`.
- Aunque se arreglen los nombres de campos, anonymous no puede leer → query falla.

**Solución elegida (segura, cumple AGENTS.md):** Crear una **API route server-side** `/api/inspection/live/[token]` que use `NHOST_ADMIN_SECRET` para ejecutar la query (admin secret solo en server). La página client hace `fetch()` a esta ruta cada 3s. Así no se exponen permisos anonymous amplios en Hasura (que serían un hole de seguridad para evidencias/notas de todos los tenants).

---

## Pasos de Implementación

- [x] **Paso 1:** Corregir nombres de campos en `getInspectionSessionLive` (`src/services/inspections.ts`).
  - evidences: `id url type description category created_at`
  - checklists: `id area item status notes created_at`
  - chat_messages: `id content sender_name sender_role created_at`
  - damages: `id description damage_type severity created_at` (sin cambio)
  - notes: `id content created_at` (sin cambio)
  - Extraído `INSPECTION_LIVE_QUERY` y `attachInspectionNumber` para reutilizar en la API route.

- [x] **Paso 2:** Crear helper server-side para GraphQL con admin secret.
  - `src/lib/nhost/admin-graphql.ts` — `adminGraphqlRequest(query, variables)` con header `x-hasura-admin-secret`, marca `server-only`.

- [x] **Paso 3:** Crear API route `/api/inspection/live/[token]/route.ts`.
  - GET handler con `adminGraphqlRequest` + `INSPECTION_LIVE_QUERY`. Retorna `{ session }` o `{ session: null }`.

- [x] **Paso 4:** Actualizar `src/app/inspection/[token]/page.tsx`.
  - `useQuery(() => fetchLiveSession(token))` con `fetch('/api/inspection/live/[token]')`.
  - Corregidos campos UI: `ev.url`/`ev.type === "photo"`, `cl.item`/`cl.status`/`cl.notes` (status `reviewed|not_applicable|pending`), `msg.content`.
  - Tipos `LiveSession` definidos; eliminados `any` y import `Wifi` no usado.

- [x] **Paso 5:** Verificar lint/typecheck.
  - `npx tsc --noEmit` → OK (exit 0, sin errores).
  - `pnpm lint` → la página del magic link y la API route sin errores nuevos (los `any` restantes en `services/inspections.ts` línea 174 son pre-existentes del patrón del archivo).

## Requisito para que funcione en runtime
- **`NHOST_ADMIN_SECRET` debe estar definido en `.env.local`** (server-side). La API route lo usa para leer la sesión. Sin esto, la ruta devuelve 500 y el magic link muestra "Link inválido".

## Notas
- No se modifican permisos Hasura ni migraciones (la solución server-side evita tocar Hasura y evita exponer permisos anonymous amplios).
- El admin secret NUNCA se expone al cliente (la API route corre en el server Next.js).
- El polling cada 3s se mantiene para tiempo real (cumple PLAN_INSPECCION.md).
- El chat input sigue siendo solo visual (TODO original); el envío de mensajes del cliente queda pendiente.
