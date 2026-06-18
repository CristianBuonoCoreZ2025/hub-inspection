# Plan de Desarrollo — Hub Inspections

> Plan reconstruido el 18-06-2026. Estado actual del codebase al momento de la reconstrucción.

---

## Fase 1: Base SaaS — LISTO

| Modulo | Estado | Detalle |
|--------|--------|---------|
| Landing page | Listo | Pagina publica con info del producto |
| Auth (Nhost) | Listo | Login, registro, forgot/reset password, onboarding obligatorio |
| Multi-tenant | Listo | Tabla `companies`, `company_id` en perfiles y siniestros |
| Usuarios | Listo | CRUD completo, invitacion por rol, activar/desactivar |
| Empresas | Listo | CRUD completo, upload de logo a Nhost Storage, validacion RUT Chile |
| Sidebar + Header | Listo | Navegacion responsive, breadcrumbs, tema dark/light, 5 skins |
| Dashboard | Mock | Metricas hardcodeadas, actividad reciente estatica |
| Configuracion | Listo | Cambio de tema, selector de skin, panel de diagnostico (logs) |
| Base de datos | Listo | 13 tablas base, triggers, RLS, migraciones versionadas |

---

## Fase 2: Core

### 2.1 Siniestros (Claims) — ~90%

**Hecho:**
- [x] Tabla `claims` con ~33 campos (generico, sin dependencia de ninguna empresa)
- [x] Eliminados campos exclusivos de McLarens (`mclarens_one_number` eliminado, `internal_number` renombrado a `client_reference`)
- [x] Servicios GraphQL: getClaims, getClaimById, createClaim, updateClaim, updateClaimStatus, deleteClaim
- [x] Frontend: lista con busqueda, modal creacion/edición (~40 campos, 7 secciones)
- [x] Validacion Zod completa
- [x] 7 estados: created → scheduled → in_progress → pending_info → in_review → signed → closed
- [x] Asignacion de equipo (ajustador, inspector, auditor, dispatcher, asistente)
- [x] Relacion con perfiles (joins GraphQL)

**Pendiente:**
- [ ] **Pagina de detalle de siniestro** (ver siniestro individual, no solo modal edicion)
- [ ] **Cambio de estado con workflow** (botones de accion: Agendar, Iniciar, Revisar, Firmar, Cerrar)
- [ ] **Historial de cambios** (audit log visible en el siniestro)
- [ ] **Asignar inspeccion** desde el siniestro (crear session vinculada)
- [ ] **Filtros avanzados** en lista (por estado, por ajustador, por fecha)
- [ ] **Exportar a Excel/CSV**

### 2.2 Agenda — 0%

**Pendiente:**
- [ ] Tabla/calendario de inspecciones programadas
- [ ] Integracion con `inspection_sessions.scheduled_at`
- [ ] Vista semanal/mensual
- [ ] Reagendar / cancelar desde calendario
- [ ] Notificaciones de proximas inspecciones

---

## Fase 3: Inspeccion Remota

> **Nota critica:** El backend esta 100% listo (14 tablas, todos los servicios GraphQL). El frontend es 0%. Esta es la brecha mas grande del proyecto.
>
> **Ver documento de flujo completo:** [`PLAN_INSPECCION.md`](./PLAN_INSPECCION.md) — incluye diagrama de flujo, estados, pantallas, reglas del workflow y orden de implementacion.

### 3.1 Sesiones de Inspeccion

**Backend (listo):**
- [x] Tabla `inspection_sessions` con datos del Acta
- [x] Servicios: CRUD completo, relacion con claim

**Frontend (pendiente):**
- [ ] Listar sesiones por siniestro
- [ ] Crear nueva sesion de inspeccion (desde un siniestro)
- [ ] Pantalla de ejecucion de sesion (wizard paso a paso)
- [ ] Magic link para invitar al asegurado
- [ ] Sala LiveKit (videollamada)
- [ ] Timer de sesion, estados (pending → active → completed → cancelled)

### 3.2 Acta de Inspeccion (6 formularios)

**Backend (listo):**
- [x] `property_risk` — Descripcion del riesgo
- [x] `property_materiality` — Materialidad del inmueble
- [x] `security_measures` — Medidas de asegurabilidad
- [x] `insured_statement` — Declaracion del asegurado
- [x] `third_parties` — Terceros afectados/responsables
- [x] `damage_sketches` — Croquis de areas afectadas
- [x] Servicios GraphQL: get + upsert/create + delete para todas

**Frontend (pendiente):**
- [ ] Formulario "Descripcion del Riesgo Siniestrado"
- [ ] Formulario "Materialidad del Inmueble"
- [ ] Formulario "Medidas de Asegurabilidad"
- [ ] Formulario "Declaracion del Asegurado"
- [ ] Formulario "Datos de Terceros" (tabla editable)
- [ ] Upload de croquis/planos

### 3.3 Checklist

**Backend (listo):**
- [x] Tabla `inspection_checklists`

**Frontend (pendiente):**
- [ ] Checklist interactivo por area
- [ ] Estados: reviewed / pending / not_applicable

### 3.4 Daños

**Backend (listo):**
- [x] Tabla `inspection_damages` extendida con campos McLarens
- [x] Servicios: CRUD completo

**Frontend (pendiente):**
- [ ] Tabla de daños con categoria, subcategoria, descripcion, severidad
- [ ] Distincion edificio vs contenido (con campos especificos para contenido)
- [ ] Montos estimados

### 3.5 Evidencias

**Backend (listo):**
- [x] Tabla `inspection_evidences` (foto, video, pdf, documento)
- [x] Conexion a Nhost Storage

**Frontend (pendiente):**
- [ ] Upload drag-and-drop de fotos/videos
- [ ] Galeria de evidencias por siniestro
- [ ] Preview de imagenes/videos
- [ ] Descargar evidencias

### 3.6 Firmas Digitales

**Backend (listo):**
- [x] Tabla `inspection_signatures`
- [x] Captura de IP, user-agent, device info

**Frontend (pendiente):**
- [ ] Canvas de firma para asegurado
- [ ] Canvas de firma para ajustador
- [ ] Guardar firma como imagen

### 3.7 Chat en Tiempo Real

**Backend (listo):**
- [x] Tabla `inspection_chat_messages`

**Frontend (pendiente):**
- [ ] Chat durante la sesion de inspeccion
- [ ] Identificacion de remitente (inspector vs asegurado)

### 3.8 Informes PDF

**Backend (listo):**
- [x] Tabla `inspection_reports`

**Frontend (pendiente):**
- [ ] Generar informe PDF consolidando toda la inspeccion
- [ ] Template generico del informe de inspeccion
- [ ] Descargar / compartir informe
- [ ] Firma digital incorporada al PDF

---

## Fase 4: Avanzado (Post-produccion)

| Modulo | Prioridad | Descripcion |
|--------|-----------|-------------|
| IA con OpenRouter | Baja | Analisis automatico de danos, sugerencias de monto |
| OCR | Baja | Extraer datos de documentos escaneados (polizas, partes policiales) |
| Croquis interactivo | Baja | Dibujar croquis digital en el navegador (canvas) |
| Realtime completo | Media | WebSockets para actualizaciones en vivo de siniestros |
| Notificaciones push | Media | Notificar cuando se asigna un siniestro, cuando inicia inspeccion |
| App mobile | Baja | Version responsive/PWA para inspeccion en terreno |

---

## Proximos Pasos Recomendados (Orden de ejecucion)

1. **Completar Siniestros:**
   - Pagina de detalle del siniestro (no solo modal)
   - Cambio de estado con workflow visual
   - Asignar inspeccion desde siniestro

2. **Construir Agenda:**
   - Vista calendario con sesiones programadas
   - Integracion con inspection_sessions

3. **Frontend de Inspecciones (Fase 3):**
   - Este es el trabajo mas grande. Se puede dividir en:
     a. Lista de sesiones + crear sesion
     b. Wizard del Acta (6 formularios)
     c. Checklist + Daños + Evidencias
     d. Firmas + Chat + Sala
     e. Informe PDF

4. **Dashboard con datos reales:**
   - Reemplazar mocks por queries reales a claims e inspection_sessions

---

## Estado por Pagina del Dashboard

| Ruta | Estado | Conectado a DB |
|------|--------|----------------|
| `/dashboard` | Mock | No |
| `/dashboard/claims` | ~95% funcional (modal optimizado, crea inspecciones) | Si |
| `/dashboard/inspecciones` | Lista + detalle con 7 tabs | Si |
| `/dashboard/inspecciones/[id]` | Detalle funcional (Resumen listo, resto placeholders) | Si |
| `/dashboard/agenda` | Vista semanal funcional | Si |
| `/dashboard/catalogos/causas` | CRUD completo | Si |
| `/dashboard/catalogos/companias` | CRUD completo | Si |
| `/dashboard/catalogos/corredores` | CRUD completo | Si |
| `/dashboard/catalogos/lineas-negocio` | CRUD completo | Si |
| `/dashboard/catalogos/productos` | CRUD completo | Si |
| `/dashboard/evidencias` | Placeholder | No |
| `/dashboard/informes` | Placeholder | No |
| `/dashboard/users` | Funcional | Si |
| `/dashboard/companies` | Funcional | Si |
| `/dashboard/configuracion` | Funcional | No (local) |

---

## Correcciones Aplicadas

### 2026-06-18 — Eliminar dependencia exclusiva de McLarens
**Problema:** La tabla `claims` tenia campos especificos de una empresa (`mclarens_one_number`, `internal_number` con comentario "Numero interno de McLarens"). El sistema debe ser generico para cualquier empresa de ajuste.

**Solucion:**
- Migracion `10_remove_mclarens_fields.sql`:
  - `mclarens_one_number` → **eliminado**
  - `internal_number` → **renombrado a `client_reference`** (referencia interna generica de la empresa de ajuste)
- Actualizado: tipos TypeScript, validaciones Zod, servicios GraphQL, frontend
- Eliminadas referencias a "McLarens" del codigo fuente

### 2026-06-18 — Arreglar creacion de usuarios (inviteUser)
**Problema:** `inviteUser` usaba `nhost.auth.signUpEmailPassword()` que retorna `session: null` cuando la verificacion de email esta activada (default en Nhost). El codigo lanzaba "No se pudo crear el usuario" porque esperaba `session.user`.

**Solucion:**
- El trigger `handle_new_user` ya crea el perfil automaticamente al insertar en `auth.users`
- Cuando `session` es null, buscamos el perfil que el trigger creo por email y retornamos el `user_id`
- Simplificado el flujo: ya no se crea perfil manualmente duplicado

### 2026-06-18 — Confirmar modelo de evidencias para informes
**Observacion:** Los informes de inspeccion y las inspecciones deben relacionarse con fotos, videos y documentos. Los informes se completan con evidencias multimedia.

**Verificacion:**
- `inspection_evidences` ya tiene `file_type` ('photo', 'video', 'pdf', 'document') y FK a `session_id` + `claim_id`
- Conexion a Nhost Storage ya implementada (`uploadFileToStorage`)
- Al generar informe PDF, se consolidaran todas las evidencias de la sesion
- Frontend pendiente: upload drag-drop, galeria, preview

---

## Notas Tecnicas

- **Backend:** 100% real con Nhost (PostgreSQL + Hasura GraphQL). No hay mocks.
- **Auth:** Nhost v4 con session storage. Trigger `handle_new_user` crea perfil automatico.
- **Migraciones:** Script propio `pnpm db:push` usando `pg`. Funciona en Windows.
- **Estilos:** Tailwind v4 + shadcn/ui + sistema propio de botones/modales/paneles (de hub-stock-ai).
- **Formularios:** React Hook Form + Zod en todos los modulos activos.
- **Datos:** TanStack Query (React Query) en todos los modulos activos.
