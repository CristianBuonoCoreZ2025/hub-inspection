# Plan: Sistema de Gestiones (Claim Actions)

## Resumen

Implementar el sistema completo de gestión de gestiones para siniestros, replicando el modelo del cliente (McLarens) en nuestra plataforma. El sistema permite configurar plantillas de gestiones por línea de negocio, con SLAs, roles, características y estados; y luego instanciarlas en cada siniestro.

## Modelo de Datos (Ya existe — Migración 66)

### Jerarquía de Catálogos
```
claim_types (Tipo Siniestro: Property, R.Civil, Transporte, Vida)
  └─ business_lines (Línea Negocio: Comercial, Hogar, R.Civil, Transporte, Vida)
       └─ insurance_products (Ramo/Producto: Comercial, Hogar, etc.)
```

### Tablas del Sistema de Gestiones

| Tabla | Propósito |
|---|---|
| `action_type` (lookup_catalog) | 6 tipos: Ajuste, Inspección, Impugnación, Cierre, Comunicaciones, Reapertura |
| `action_status` (lookup_catalog) | 7 estados: Pendiente, Emitida, Revisada, Aprobada, Despachada, Rechazada, Cancelada |
| `action_features` | 22 features: Inspección, Cobertura, Reserva, Ajuste, Coordinación, etc. |
| `characteristic` | Características por feature: screen, control, issue, review, approve, doc_template, email_template, doc_type |
| `action_template` | Plantillas de gestión con SLAs, roles, código, flags (blocker, review, approve, dispatch) |
| `action_template_claim_status` | Puente: qué plantillas aplican a qué estados del siniestro |
| `claim_actions` | Instancia de gestión en un siniestro (con action_data JSON, tracking de emisión/revisión/aprobación/despacho) |

### Flujo de una Gestión
```
1. Pendiente (TODO) → created_on
2. Emitida (ISSUED) → issued_by/on + action_data
3. Revisada (REVIEWED) → reviewed_by/on (si is_review_applicable)
4. Aprobada (APPROVED) → approved_by/on (si is_approval_applicable)
5. Despachada (DISPATCHED) → dispatched_by/on (si is_dispatch_applicable)
```
Cualquier paso puede ser **Rechazado** con comentario.

## Etapa 1: Pantallas de Configuración (Esta etapa)

### 1.1 Nav: Nuevo grupo "Configuración de Gestiones"
Agregar al sidebar un nuevo grupo con 3 páginas:
- **Tipos de Gestión** (`action_type`) — CRUD de lookup_catalog category='action_type'
- **Características** (`action_features` + `characteristic`) — CRUD de features y sus características
- **Gestiones** (`action_template` + `action_template_claim_status`) — CRUD de gestiones con SLAs, roles, estados

> **Nota:** Lo que el cliente llama `action_template` es la **Gestión** (configuración con SLAs, roles, etc.).
> Las **Plantillas** son un concepto separado: documentos Office vinculados por compañía/país/evento
> que permiten auto-completar campos para facilitar la liquidación. (Futura etapa)

### 1.2 Página: Tipos de Gestión
- Ruta: `/dashboard/catalogos/gestiones/tipos`
- CRUD simple sobre `lookup_catalog` WHERE category='action_type'
- Campos: nombre, descripción, activo
- Tabla: código, nombre, descripción, estado

### 1.3 Página: Características (Features)
- Ruta: `/dashboard/catalogos/gestiones/caracteristicas`
- Lista `action_features` con sus `characteristic` expandibles
- CRUD de features: nombre, has_specific_screen, has_control, has_issue, has_review, has_approve
- CRUD de characteristics por feature: name, local_name, screen, control, issue, review, approve, document_template, email_template, document_type
- **Importante**: El `local_name` de la característica es lo que define el nombre visible de la gestión (no es solo una etiqueta)

### 1.4 Página: Gestiones
- Ruta: `/dashboard/catalogos/gestiones/gestiones`
- Lista `action_template` con joins a action_type, action_features, business_lines
- CRUD completo:
  - **Datos básicos**: nombre, descripción, código
  - **Asociaciones**: action_type (select), action_features (select), line_business (select)
  - **SLAs**: days_to_issue, days_to_review, days_to_approve + días de alerta
  - **Roles**: issuer_role, reviewer_role, approver_role
  - **Flags**: is_blocker, is_review_applicable, is_approval_applicable, is_dispatch_applicable
  - **Estados del siniestro**: multi-select de claim_status (action_template_claim_status)
- Tabla: código, nombre, tipo, feature, línea de negocio, SLA emisión, blocker, estado

## Etapa 2: Tab Gestiones en el Siniestro (Próxima etapa)

### 2.1 Lista de Gestiones
- Tab "Gestiones" en la vista del siniestro
- Tabla: código, nombre, fecha ejecución, días restantes, estado (semáforo)
- Botón "Nueva Gestión" → modal con select de plantillas disponibles según estado del siniestro

### 2.2 Pantallas Específicas por Feature
Según `characteristic` de cada feature:
- **Coordinación Inspección**: Inspector, ubicación, fecha/hora, tipo contacto, comentarios → **linkear con flujo de inspección existente**
- **Inspección**: Datos de inspección → **linkear con inspection_sessions**
- **Aviso Asignación**: Tipo contacto, plantilla de texto
- **Solicitud de Antecedentes**: De/Para, plantilla email, tabla de documentos con recomendaciones
- **Coberturas**: Tabla de coberturas del siniestro
- **Reserva**: Cobertura, montos, deducible, infraseguro
- **Recepción Antecedentes**: Tipo documento, nombre, fecha recibida
- **Cierre**: Datos de cierre
- **Prórroga**: Documentos generados + estado
- **Ajuste**: Planilla cuadro de ajuste + estados de revisión
- **Genérica**: Observación libre

### 2.3 Link con Inspección
- Cuando se emite la gestión "Coordinación de Inspección", se crea una `inspection_session`
- Cuando se emite la gestión "Inspección", se vincula con el acta de inspección
- El `action_data` JSON guarda: contact, inspector_id, location, inspection_date_time, coordination_type_id, etc.

## Etapa 3: Workflow Configurable (Futura)
- Motor de reglas que genera gestiones automáticamente al crear un siniestro
- Configuración visual del flujo (drag & drop)
- Dependencias entre gestiones (una bloquea a otra)
- Alertas automáticas por SLA vencido

## Orden de Implementación
1. ✅ Base de datos (migración 66 — ya existe)
2. ✅ Servicios GraphQL para action_features, characteristic, action_template
3. ✅ Página: Tipos de Gestión
4. ✅ Página: Características (Features)
5. ✅ Página: Plantillas de Gestión
6. ✅ Nav: agregar grupo "Configuración de Gestiones"
7. ✅ TypeScript check
8. ✅ Tab Gestiones en siniestro
9. ✅ Pantallas específicas por feature (DynamicScreen)
10. ✅ Link con inspección

---

## Implementación Completada (Sesiones Recientes)

### FASE 1 — UI/UX y Configuración

#### 1.1 Modal Nueva Gestión simplificado
- Modal con select de plantillas disponibles según estado del siniestro
- Solo muestra plantillas aplicables al `claim_status` actual

#### 1.2 DynamicScreen reordenado
- Sección "Niveles de Revisión" movida al final (no al inicio del modal)
- `ReviewLevelsIndicator` removido de `page.tsx` para evitar duplicación
- `DynamicScreen` ya incluye su propia sección `review_levels`

#### 1.3 Rol 'assistant' creado
- Migración 117: agrega `assistant` a los roles del sistema
- `userTypeLabels` y `WORKFLOW_ROLES` actualizados dinámicamente

### FASE 2 — Workflow y Permisos

#### 2.1 Roles configurables como arrays
- `issuer_role`, `reviewer_role`, `approver_role` cambiados a arrays (`issuer_roles`, `reviewer_roles`, `approver_roles`)
- Permite múltiples roles por nivel (ej: emisor puede ser liquidador O inspector)

#### 2.2 Auto-asignación inteligente
- `createClaimAction` asigna responsables automáticamente:
  1. Busca usuarios con los roles configurados en el template
  2. Prioriza usuarios asignados al siniestro (liquidador → inspector → asistente)
  3. Entre candidatos, elige el usuario con menos gestiones pendientes

#### 2.3 Combo de responsables filtrado por roles
- `LevelCard` muestra solo usuarios con los roles configurados para cada nivel
- Permite reasignar el responsable del nivel activo (no solo pendientes)

#### 2.4 Permiso por responsable
- Solo el responsable asignado puede editar coberturas y completar el nivel
- `canEditCoverages` basado en `profile.id` vs `issuer_id`/`reviewer_id`/`approver_id`

#### 2.5 Botones Emitir/Revisar/Aprobar + Rechazar
- Modal de edición tiene botones específicos según el nivel activo:
  - `todo` → **Emitir** (solo el emisor asignado)
  - `issued` → **Revisar** (solo el revisor asignado)
  - `reviewed` → **Aprobar** (solo el aprobador asignado)
- Botón **Rechazar** con cuadro de motivo (comentario obligatorio opcional)
- `readOnly` ahora permite editar en cualquier nivel activo (no solo `todo`)
- Si hay cambios sin guardar, el botón de avance guarda primero y luego avanza

#### 2.6 Lógica de rechazo con retroceso
- **Rechazar emisión** → acción queda `rejected` (permanente)
- **Rechazar revisión** → vuelve a `todo` (emisión)
- **Rechazar aprobación** → vuelve a `issued` (revisión)
- **Rechazar despacho** → vuelve a `approved` (aprobación)
- Cada rechazo guarda: `*_rejected_on`, `*_rejected_by`, comentario
- Migración 121: agrega campos de rechazo de emisión (`issue_rejected_on`, `issue_rejected_by`, `issuer_rejection_comment`)

### FASE 3 — Trazabilidad e Historial

#### 3.1 Tabla `claim_action_history` (Migración 122)
- Tabla **append-only** (inalterable — RLS impide UPDATE y DELETE)
- Registra cada evento con: tipo, estado anterior/nuevo, usuario, fecha, comentario, responsable anterior/nuevo
- Índices por `claim_action_id`, `performed_by`, `event_type`

#### 3.2 Logging integrado en todas las operaciones
| Función | Evento registrado |
|---------|-------------------|
| `createClaimAction` | `created` |
| `issueClaimAction` | `issued` (todo → issued) |
| `reviewClaimAction` | `reviewed` (issued → reviewed) |
| `approveClaimAction` | `approved` (reviewed → approved) |
| `rejectClaimAction` | `rejected_issue` / `rejected_review` / `rejected_approve` |
| `updateActionResponsible` | `reassigned_issuer` / `reassigned_reviewer` / `reassigned_approver` |

- `logActionHistory()` es **best-effort** — no bloquea la operación principal si falla
- `getActionHistory(actionId)` — obtiene historial completo ordenado desc

#### 3.3 Vista de historial en el modal
- Componente `ActionHistoryView` — sección colapsable "Ver historial"
- Timeline cronológico con icono y color por tipo de evento
- Muestra: tipo de evento, usuario, fecha/hora, comentario, cambio de responsable

### FASE 4 — Semáforo de Estado en Listado

#### 4.1 Indicador visual tipo semáforo
Reemplazado el Badge de texto por un círculo de color con icono:

| Color | Icono | Estado | Condición |
|-------|-------|--------|-----------|
| � Gris/blanco | `Clock` | Pendiente | `todo` sin plazo configurado |
| 🟡 Amarillo | `AlertTriangle` | En alerta | `todo` con días ≥ 70% del plazo |
| 🔴 Rojo | `AlertTriangle` | Atrasada | `todo` con días > plazo |
| 🟡 Amarillo | `Clock` | En curso | `issued` / `reviewed` |
| 🟢 Verde | `CheckCircle` | Completada | `approved` / `dispatched` |
| 🔴 Rojo | `XCircle` | Rechazada | `rejected` |

- Cálculo basado en `created_on` + `days_to_issue` del template
- Tooltip con descripción del estado

### FASE 5 — Datos del Siniestro en DynamicScreen

#### 5.1 Campos del siniestro visibles en el modal
- `DynamicScreen` carga el `claim` completo y `claimParticipants` via `useQuery`
- `EntityField` recibe `claim` y `claimParticipants` como props
- `getClaimEntityValue()` extrae y formatea datos del siniestro (número, estado, liquidador, etc.)

#### 5.2 Relaciones en CLAIM_FIELDS
- `CLAIM_FIELDS` en `src/services/claims.ts` actualizado con relaciones:
  - `status` (nombre del estado)
  - `assigned_adjuster`, `adjuster`, `inspector`, `assistant` (nombres, no UUIDs)
  - `broker`, `insurance_company`

### FASE 6 — Campos Adicionales de Usuarios (Migración 123)

#### 6.1 Nuevos campos en `profiles`
- `first_name` (text) — Nombre
- `last_name` (text) — Apellido
- `rut` (text) — RUT/identificación
- `country_id` (uuid → countries) — País

#### 6.2 Modal de edición de usuarios ampliado
- Modo edición muestra: nombre, apellido, nombre completo, email, teléfono, RUT, país, rol, clientes
- Modo creación mantiene campos mínimos (nombre completo + email)
- `updateUser` soporta todos los nuevos campos
- `getCountries()` integrado como select de país

---

## Migraciones Aplicadas

| # | Archivo | Descripción |
|---|---------|-------------|
| 113 | `113_gestion_linea_negocio_y_codificacion.sql` | Línea de negocio y codificación de gestiones |
| 116 | `116_claim_actions_is_automatic.sql` | Campo `is_automatic` en claim_actions |
| 117 | `117_add_assistant_role.sql` | Rol `assistant` en el sistema |
| 121 | `121_rejection_fields.sql` | Campos de rechazo de emisión |
| 122 | `122_claim_action_history.sql` | Tabla de historial append-only |
| 123 | `123_profile_extra_fields.sql` | Campos adicionales en profiles (nombre, apellido, RUT, país) |

## Archivos Clave Modificados

| Archivo | Cambios |
|---------|---------|
| `src/services/claim-actions.ts` | issue/review/approve/reject con historial, auto-asignación, validación de responsable |
| `src/services/claim-action-history.ts` | **NUEVO** — logging y consulta de historial |
| `src/services/users.ts` | `updateUser` ampliado, `PROFILE_FIELDS` con nuevos campos |
| `src/services/claims.ts` | `CLAIM_FIELDS` con relaciones para DynamicScreen |
| `src/app/dashboard/claims/[id]/page.tsx` | Semáforo, botones Emitir/Revisar/Aprobar/Rechazar, historial, DynamicScreen |
| `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx` | Carga claim completo, permisos por responsable, reordenado |
| `src/app/dashboard/users/page.tsx` | Modal de edición con campos adicionales |
| `src/app/dashboard/catalogos/gestiones/gestiones/page.tsx` | `WORKFLOW_ROLES` dinámico desde `userTypeLabels` |
| `src/types/index.ts` | `Profile` ampliado, `ClaimAction` con campos de rechazo |
| `src/lib/validations.ts` | Schemas de validación actualizados |

## Etapa 3: Workflow Configurable (Futura)
- Motor de reglas que genera gestiones automáticamente al crear un siniestro
- Configuración visual del flujo (drag & drop)
- Dependencias entre gestiones (una bloquea a otra)
- Alertas automáticas por SLA vencido
