# Plan de Gestiones — Hub Inspection

> Estado al **2026-07-23**. Documento vivo: se actualiza con cada commit.
>
> **Convención de estados:**
> - ✅ **Completado** — funcional y en producción
> - 🟡 **Parcial** — implementado pero con limitaciones conocidas
> - ⏳ **Pendiente** — no implementado aún
> - 🔴 **Bloqueado** — requiere decisión o infraestructura externa
>
> **Documentos relacionados:**
> - [`PLAN_INSPECCIONES.md`](PLAN_INSPECCIONES.md) — Plan detallado del módulo de Inspecciones
> - [`PLAN_DOCUMENTOS_GESTION.md`](PLAN_DOCUMENTOS_GESTION.md) — Plan específico de documentos DOCX/PDF
> - [`PLAN_GESTIONES_PANTALLAS.md`](PLAN_GESTIONES_PANTALLAS.md) — Plan específico de pantallas dinámicas

---

## 1. Arquitectura General

### 1.1 Modelo de datos (PostgreSQL / Supabase)

| Tabla | Estado | Migración | Descripción |
|-------|--------|-----------|-------------|
| `action_template` | ✅ | 113, 128, 184 | Plantillas de gestión (código, nombre, roles, días, estados) |
| `action_features` | ✅ | 113 | Características de gestión (has_issue, has_review, has_approve) |
| `action_template_dependencies` | ✅ | 139, 142 | Dependencias entre plantillas (COB→RES→PCA, NSA→RTA) |
| `action_types` | ✅ | 113 | Tipos de gestión (catálogo) |
| `claim_actions` | ✅ | 113, 116, 121, 125, 131, 136, 150, 190 | Gestiones del siniestro (instancias de templates) |
| `claim_action_history` | ✅ | 122 | Historial de cambios en gestiones |
| `claim_action_documents` | ✅ | 180 | Documentos de gestión con versionado y lock |
| `claim_documents` | ✅ | 117, 172, 175 | Documentos generales del siniestro |
| `claim_document_requests` | ✅ | 117 | Solicitudes de documentos al cliente |
| `workflow_configs` | ✅ | 135, 137, 138, 145 | Configuración de workflow (país + línea + evento + estado) |
| `workflow_steps` | ✅ | 135, 136 | Steps del workflow (level, depends_on, is_automatic, is_required) |
| `gestion_screens` | ✅ | 110, 158 | Pantallas dinámicas (form_schema JSON) |
| `field_configs` | ✅ | 158 | Configuración de campos de pantallas |
| `audit_logs` | ✅ | 014 | Auditoría completa |
| `claim_participants` | ✅ | 189 | Participantes del siniestro (con `person_type`) |

### 1.2 Reglas de negocio

- ✅ Las gestiones **solo se crean** desde el workflow del siniestro (automáticas) o manualmente desde el siniestro.
- ✅ Cada gestión es una **instancia** de un `action_template` (plantilla).
- ✅ Las gestiones siguen una **cadena de dependencias**: COB → RES → PCA, NSA → RTA. Cada gestión requiere que la anterior esté **cerrada** (issued/reviewed/approved/dispatched).
- ✅ El workflow actúa en **3 instantes**: cambio de estado del siniestro, emisión de gestión, rechazo de gestión.
- ✅ Las inspecciones se crean automáticamente al emitir la gestión COI (ver [`PLAN_INSPECCIONES.md`](PLAN_INSPECCIONES.md)).

---

## 2. Workflow Automático

### 2.1 Configuración

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| `workflow_configs` (país + línea + evento + estado) | ✅ | Migración 135 |
| `workflow_steps` (level, depends_on, is_automatic, is_required) | ✅ | Migración 136 |
| Status del workflow (draft / online / suspended) | ✅ | Migración 145 |
| Solo workflows `online` crean gestiones | ✅ | Migración 146 |
| Editor de workflows en UI | ✅ | `/dashboard/catalogos/workflows` |
| Sincronización manual de siniestro con workflow | ✅ | API `/api/workflows/sync-claim` |

### 2.2 Triggers SQL

| Trigger | Estado | Migración | Descripción |
|---------|--------|-----------|-------------|
| `execute_workflow_on_status_change` | ✅ | 135, 147 | Crea gestiones de nivel 1 al cambiar estado del siniestro |
| `cascade_workflow_on_issue` | ✅ | 140, 143, 147 | Crea gestiones dependientes al emitir una gestión |
| `auto_recreate_rejected_workflow_action` | ✅ | 136, 147 | Recrea gestiones `is_required=true` rechazadas |
| `sync_no_parent_if_child_exists` | ✅ | 148 | No crea padre retroactivo si el hijo ya existe |
| `assign_action_responsibles` | ✅ | 149 | Auto-asigna responsables según roles del template |
| `snapshot_parent_data` | ✅ | 150 | Snapshot de datos del padre en gestiones dependientes |
| `screen_snapshot` en claim_actions | ✅ | 190, 192, 193, 194 | Snapshot de pantalla al crear gestión |

### 2.3 Regla SIMPLE del workflow

El workflow actúa en **3 instantes** y solo en esos instantes:

1. **Cambio de estado del siniestro** → crea TODAS las gestiones de nivel 1
2. **Emisión de gestión** → crea gestiones dependientes (level 2+)
3. **Rechazo de gestión** → recrea si `is_required=true`

**Lo que NO importa:** si es manual o automática, historial pasado, origen (M/W), cuántas veces se rechazó.

**Lo que SÍ importa:** workflow `online`, coincide país + línea + evento + estado actual, no duplicar si ya existe gestión activa no rechazada.

---

## 3. Ciclo de Vida de una Gestión

### 3.1 Estados

```
todo → issued → reviewed → approved → dispatched
  ↑        |         |          |           |
  └────────┴─────────┴──────────┴───────────┘
              (rechazo → recrea si is_required)
```

| Estado | Estado | Descripción |
|--------|--------|-------------|
| `todo` | ✅ | Pendiente (recién creada) |
| `issued` | ✅ | Emitida (cerrada — cuenta como prerequisito) |
| `reviewed` | ✅ | Revisada (cerrada) |
| `approved` | ✅ | Aprobada (cerrada) |
| `dispatched` | ✅ | Despachada (cerrada) |
| `rejected` | ✅ | Rechazada (no cuenta como prerequisito) |

**Estados cerrados válidos:** `issued`, `reviewed`, `approved`, `dispatched`

### 3.2 Operaciones

| Operación | Estado | Función | Descripción |
|-----------|--------|---------|-------------|
| Crear gestión manual | ✅ | `createClaimAction()` | Desde el siniestro |
| Crear gestión automática | ✅ | Triggers SQL | Desde el workflow |
| Editar datos | ✅ | `updateClaimAction()` | Autoguardado 500ms |
| Emitir | ✅ | `issueClaimAction()` | todo → issued |
| Revisar | ✅ | `reviewClaimAction()` | issued → reviewed |
| Aprobar | ✅ | `approveClaimAction()` | reviewed → approved |
| Despachar | ✅ | `dispatchClaimAction()` | approved → dispatched |
| Rechazar | ✅ | `rejectClaimAction()` | Con comentario, recrea si `is_required` |
| Eliminar | ✅ | Soft delete | `is_active = false` |
| Reactivar | ✅ | `reactivateSoftDeleted()` | Migración 132 |

### 3.3 Cadena de dependencias

| Cadena | Estado | Descripción |
|--------|--------|-------------|
| COB → RES → PCA | ✅ | Coberturas → Reserva → Planilla Cuadro de Ajuste |
| NSA → RTA | ✅ | Notificación → Recepción Total de Antecedentes |
| Validación de prerequisito cerrado | ✅ | `checkPrerequisiteGestion()` |
| Múltiples templates con mismo código | ✅ | Busca en TODOS los template_ids con ese código |
| "Al menos una cerrada" | ✅ | Basta con 1 gestión del prerequisito cerrada |

### 3.4 Auto-asignación de responsables

| Rol | Estado | Mapeo |
|-----|--------|-------|
| `issuer_id` | ✅ | `claim.<default_issuer_role>_id` |
| `reviewer_id` | ✅ | `claim.<default_reviewer_role>_id` |
| `approver_id` | ✅ | `claim.<default_approver_role>_id` |
| `dispatcher_id` | ✅ | `claim.<default_dispatcher_role>_id` |

**Roles disponibles:** `adjuster`, `assigned_adjuster`, `assistant`, `inspector`, `auditor`, `dispatcher`

**Diferencia `issuer_id` vs `issued_by`:**
- `issuer_id` = responsable asignado (automático al crear)
- `issued_by` = quien realmente emitió (al emitir)

---

## 4. Pantallas Dinámicas

> Documentación detallada en [`PLAN_GESTIONES_PANTALLAS.md`](PLAN_GESTIONES_PANTALLAS.md)

### 4.1 Componente DynamicScreen

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Renderizado basado en `form_schema` JSON | ✅ | `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx` |
| Autoguardado (debounce 500ms) | ✅ | Hook `useAutoSave` |
| Reglas de visibilidad condicional | ✅ | `visibleIf` |
| Reglas de obligatoriedad condicional | ✅ | `requiredIf` |
| Validación de fechas | ✅ | `greater_than`, `less_than` |
| Indicador visual de guardado | ✅ | "Guardando..." / "Guardado" |

### 4.2 Tipos de campos

**Campos propios (own):**
- ✅ `text` — Texto corto
- ✅ `textarea` — Descripción larga
- ✅ `number` — Número con decimales
- ✅ `date` — Fecha (dateType: date/datetime)
- ✅ `select` — Selección de opciones
- ✅ `checkbox` — Casilla de verificación
- ✅ `toggle_chip` — Chip toggle

**Campos de entidad simple (simple_entity):**
- ✅ `claim_number`, `claim_status`, `liquidation_number`, `adjuster_name`, `policy_number`

**Campos de entidad compleja (complex_entity):**
- ✅ `claim_coverages` — Coberturas (CRUD inline)
- ✅ `claim_reserves` — Reservas (CRUD inline)
- ✅ `claim_document_receipt` — Recepción de documentos
- ✅ `claim_document_templates` — Plantillas de documento
- ✅ `coordination` — Coordinación de inspección
- ✅ `inspector_schedule` — Agenda de inspectores
- ✅ `claim_participants` — Participantes del siniestro
- ✅ `coverage_catalog` — Catálogo de coberturas

### 4.3 Pantallas específicas

| Pantalla | Estado | Archivo |
|----------|--------|---------|
| Coberturas | ✅ | `CoberturasScreen.tsx` |
| Coordinación de Inspección | ✅ | `CoordinacionScreen.tsx` |
| Email/Avisos | ✅ | `EmailScreen.tsx`, `EmailViewScreen.tsx` |
| Genérica | ✅ | `GenericaScreen.tsx` |
| Liquidación | ✅ | `LiquidacionScreen.tsx` |
| Reserva | ✅ | `ReservaScreen.tsx` |
| Solicitud de Documentos | ✅ | `SolicitudDocumentosScreen.tsx` |

### 4.4 Editor visual de pantallas

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Editor drag-and-drop | ✅ | `/dashboard/catalogos/pantallas/[screenId]` |
| Propiedades de campos | ✅ | Editables en panel lateral |
| Preview en tiempo real | ✅ | |
| Asociación a características | ✅ | Via `action_features` |
| Refresco de snapshots prístinos | 🟡 | Manual via API `refresh-pristine-snapshots` |

---

## 5. Documentos de Gestión

> Documentación detallada en [`PLAN_DOCUMENTOS_GESTION.md`](PLAN_DOCUMENTOS_GESTION.md)

### 5.1 Generación desde plantillas

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Generación DOCX | ✅ | `docxtemplater` — `src/services/document-render.ts` |
| Generación XLSX | 🟡 | `xlsx-template` — parcialmente probado |
| Generación PPTX | 🟡 | `node-pptx-templater` — parcialmente probado |
| Placeholders con sintaxis `<campo>` | ✅ | Detección automática |
| Mapeo de datos del siniestro | ✅ | `src/services/document-data.ts` |
| Catálogo de campos | ✅ | `/dashboard/catalogos/gestiones/campos` |
| API de generación | ✅ | `/api/claims/actions/[actionId]/generate-document` |

### 5.2 Conversión a PDF

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Conversión via Gotenberg | ✅ | `src/services/pdf-conversion.ts` |
| API de conversión | ✅ | `/api/claims/actions/[actionId]/convert-to-pdf` |
| Variable `GOTENBERG_URL` | 🔴 | Requiere Gotenberg desplegado |
| Alternativa LibreOffice | ⏳ | No implementado |

### 5.3 Versionado y lock

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Versionado de documentos | ✅ | `claim_action_documents` con `is_current` |
| Lock para edición offline | ✅ | `lockDocument()` |
| Unlock al subir nueva versión | ✅ | Automático |
| Force unlock (admin) | ✅ | `forceUnlockDocument()` |
| Restaurar versión anterior | ✅ | `restoreDocumentVersion()` |
| UI de admin para ver locks | ⏳ | Pendiente |

### 5.4 Upload de documentos

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Upload DOCX/XLSX/PPTX | ✅ | `/api/claims/actions/[actionId]/upload-document` |
| Upload PDF directo | ❌ | No permitido — debe generarse via conversión |
| Storage en R2 | ✅ | Path estructurado |
| IA en background | ✅ | `ai_summary`, `ai_model`, `ai_status` (migración 175) |

---

## 6. Catálogos de Gestiones

### 6.1 Catálogos principales

| Catálogo | Ruta | Estado | Descripción |
|----------|------|--------|-------------|
| Gestiones (action_template) | `/dashboard/catalogos/gestiones/gestiones` | ✅ | CRUD de plantillas con roles, días, estados |
| Campos | `/dashboard/catalogos/gestiones/campos` | ✅ | Placeholders para documentos Word |
| Características | `/dashboard/catalogos/gestiones/caracteristicas` | ✅ | CRUD de action_features |
| Dependencias | `/dashboard/catalogos/gestiones/dependencias` | ✅ | Cadenas COB→RES→PCA, NSA→RTA |
| Tipos | `/dashboard/catalogos/gestiones/tipos` | ✅ | Catálogo de action_types |
| Pantallas | `/dashboard/catalogos/pantallas` | ✅ | CRUD de gestion_screens |
| Editor de pantallas | `/dashboard/catalogos/pantallas/[screenId]` | ✅ | Editor visual drag-and-drop |

### 6.2 Configuración de plantillas

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Roles (issuer, reviewer, approver) | ✅ | Por plantilla |
| Tiempos (days_to_issue, days_to_review, days_to_approve) | ✅ | Por plantilla |
| Asociación a estados de siniestro | ✅ | `action_template_claim_status` |
| Asociación a características | ✅ | `action_features` |
| Asociación a línea de negocio | ✅ | `business_lines` |
| Plantillas de documento | ✅ | Upload + mapeo de placeholders |
| `has_template` (solo ILI) | ✅ | Migración 188 |

---

## 7. APIs de Gestiones

### 7.1 APIs de acciones

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/claims/actions/[actionId]/documents` | GET | ✅ | Lista versiones de documentos |
| `/api/claims/actions/[actionId]/generate-document` | POST | ✅ | Genera documento desde plantilla |
| `/api/claims/actions/[actionId]/upload-document` | POST | ✅ | Sube documento editable |
| `/api/claims/actions/[actionId]/convert-to-pdf` | POST | ✅ | Convierte a PDF via Gotenberg |
| `/api/claims/actions/[actionId]/documents/[docId]/lock` | POST | ✅ | Bloquea documento |
| `/api/claims/actions/[actionId]/documents/[docId]/unlock` | POST | ✅ | Desbloquea documento |
| `/api/claims/actions/[actionId]/documents/[docId]/force-unlock` | POST | ✅ | Fuerza desbloqueo (admin) |
| `/api/claims/actions/[actionId]/documents/[docId]/restore` | POST | ✅ | Restaura versión anterior |

### 7.2 APIs de documentos de siniestro

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/claims/documents/upload` | POST | ✅ | Sube documento general del siniestro |
| `/api/claims/documents/[documentId]` | GET, DELETE | ✅ | Obtiene o elimina documento |
| `/api/claims/images/upload` | POST | ✅ | Sube imagen del siniestro (con IA background) |
| `/api/claims/images/[id]` | DELETE | ✅ | Elimina imagen (soft delete) |

### 7.3 APIs de workflow y pantallas

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/workflows/sync-claim` | POST | ✅ | Sincroniza siniestro con workflow |
| `/api/gestion-screens/update-schema` | POST | ✅ | Actualiza form_schema de pantalla |
| `/api/gestion-screens/refresh-pristine-snapshots` | POST | ✅ | Refresca snapshots prístinos |
| `/api/ai/analyze-document` | POST | ✅ | Reanálisis de IA para cualquier documento |

---

## 8. Servicios

### 8.1 claim-actions.ts

| Función | Estado | Descripción |
|---------|--------|-------------|
| `getActionTemplatesByClaimStatus()` | ✅ | Plantillas aplicables según estado del siniestro |
| `getActionTemplates()` | ✅ | Todas las plantillas (activas/inactivas) |
| `getClaimActionById()` | ✅ | Gestión por ID |
| `createClaimAction()` | ✅ | Crea gestión manual |
| `updateClaimAction()` | ✅ | Actualiza datos |
| `issueClaimAction()` | ✅ | Emite gestión |
| `reviewClaimAction()` | ✅ | Revisa gestión |
| `approveClaimAction()` | ✅ | Aprueba gestión |
| `dispatchClaimAction()` | ✅ | Despacha gestión |
| `rejectClaimAction()` | ✅ | Rechaza gestión |
| `checkPrerequisiteGestion()` | ✅ | Verifica prerequisito cerrado |
| `checkGestionExists()` | ✅ | Verifica si existe gestión del prerequisito |
| `CHAIN_DEPENDENCIES` | ✅ | Mapa de código → prerequisito |

### 8.2 claim-action-documents.ts

| Función | Estado | Descripción |
|---------|--------|-------------|
| `getClaimActionDocuments()` | ✅ | Lista versiones de documentos |
| `getCurrentDocument()` | ✅ | Documento actual |
| `getCurrentEditableDocument()` | ✅ | Documento editable actual (Word/Excel/PPT) |
| `getCurrentPdf()` | ✅ | PDF actual |
| `createDocumentVersion()` | ✅ | Crea nueva versión |
| `lockDocument()` / `unlockDocument()` | ✅ | Lock/unlock |
| `forceUnlockDocument()` | ✅ | Force unlock (admin) |
| `restoreDocumentVersion()` | ✅ | Restaura versión anterior |

### 8.3 claim-documents.ts

| Función | Estado | Descripción |
|---------|--------|-------------|
| `getDocumentRequirements()` | ✅ | Documentos requeridos por línea |
| `getClaimDocumentRequests()` | ✅ | Solicitudes de documentos |
| `createClaimDocumentRequest()` | ✅ | Crea solicitud |
| `updateClaimDocumentRequestItem()` | ✅ | Actualiza item (status, archivo, notas) |
| `closeClaimDocumentRequest()` | ✅ | Cierra solicitud |
| `cancelClaimDocumentRequest()` | ✅ | Cancela solicitud |

### 8.4 workflow-configs.ts

| Función | Estado | Descripción |
|---------|--------|-------------|
| `getWorkflowConfigs()` | ✅ | Todas las configuraciones |
| `createWorkflowConfig()` | ✅ | Crea workflow |
| `updateWorkflowConfig()` | ✅ | Actualiza workflow |
| `setWorkflowStatus()` | ✅ | Cambia status (draft/online/suspended) |
| `getWorkflowSteps()` | ✅ | Steps de un workflow |
| `createWorkflowStepWithChain()` | ✅ | Crea step raíz + cadena de dependencias |

### 8.5 gestion-screens.ts

| Función | Estado | Descripción |
|---------|--------|-------------|
| `getGestionScreens()` | ✅ | Todas las pantallas |
| `getGestionScreenByCode()` | ✅ | Pantalla por código |
| `getGestionScreensForClaimAction()` | ✅ | Determina pantalla de una gestión |
| `updateGestionScreen()` | ✅ | Actualiza form_schema |
| `refreshPristineSnapshots()` | ✅ | Refresca snapshots |
| `screenHasDocumentTemplates()` | ✅ | Verifica si soporta templates |

### 8.6 my-gestiones.ts

| Función | Estado | Descripción |
|---------|--------|-------------|
| `getMyGestiones()` | ✅ | Gestiones del usuario con filtros (all, in-progress, reviews, approvals, alert, overdue) |

---

## 9. Permisos y Auditoría

### 9.1 Permisos

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Roles por plantilla (issuer, reviewer, approver) | ✅ | `action_template` |
| Roles secundarios de usuarios | ✅ | Migración 151 |
| Hook `usePermissions()` | ✅ | En componentes |
| Validación server-side | ✅ | En server actions |
| Permisos por campo | ✅ | `src/services/field-permissions.ts` |
| Permisos de informes | ✅ | Migración 171 |

### 9.2 Auditoría

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Tabla `audit_logs` | ✅ | Migración 014 |
| Triggers de auditoría | ✅ | Registran quién crea/modifica/elimina |
| Historial de gestiones | ✅ | `claim_action_history` (migración 122) |
| Historial de cambios de estado | ✅ | Registrado con timestamps y usuario |

---

## 10. Pendientes y Mejoras Futuras

### 10.1 Pendiente

- ⏳ **Firmas de gestiones**
  - Solo existen firmas para inspecciones (`inspection_signatures`)
  - No hay tabla `claim_action_signatures` ni componente de firma
  - Podría reutilizarse la lógica de inspecciones adaptándola
  - **Prioridad:** Media (depende del requerimiento legal/regulatorio)

- ⏳ **UI de admin para ver documentos bloqueados**
  - Las funciones de lock/unlock/force-unlock existen
  - No hay interfaz para ver qué documentos están bloqueados
  - Solo se desbloquea al subir nueva versión o force-unlock manual

- ⏳ **Refresco automático de snapshots prístinos**
  - La función `refreshPristineSnapshots()` existe
  - Actualmente es manual via API
  - Debería ejecutarse automáticamente al cambiar una pantalla
  - Solo afecta a gestiones prístinas (sin datos editados)

### 10.2 Mejoras opcionales

- 🟡 **Plantillas Excel/PowerPoint**
  - Los servicios de renderizado existen (`xlsx-template`, `node-pptx-templater`)
  - DOCX es el principal y mejor probado
  - XLSX/PPTX no se han validado extensivamente

- 🔴 **Alternativa a Gotenberg para conversión PDF**
  - Gotenberg funciona pero requiere despliegue propio
  - Alternativa: LibreOffice headless (no implementado)
  - Alternativa: OnlyOffice (documentado en `DEPLOY_ONLYOFFICE_GOTENBERG.md`)

- ⏳ **Notificaciones push para gestiones asignadas**
  - Actualmente no hay notificaciones cuando se asigna una gestión
  - El usuario debe revisar "Mis Gestiones" manualmente
  - Podría integrarse con Supabase Realtime

- ⏳ **Dashboard de KPIs de gestiones**
  - Tiempos promedio de emisión/revisión/aprobación
  - Cuellos de botella por tipo de gestión
  - Gestiones atrasadas vs a tiempo

---

## 11. Archivos Clave

### Páginas
- `src/app/dashboard/gestiones/page.tsx` — "Mis Gestiones" con filtros y KPIs
- `src/app/dashboard/claims/[id]/gestiones/[actionId]/page.tsx` — Detalle de gestión
- `src/app/dashboard/claims/[id]/page.tsx` — Detalle del siniestro con lista de gestiones

### Componentes
- `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx` — Pantallas dinámicas
- `src/app/dashboard/claims/[id]/gestion-screens/*.tsx` — Pantallas específicas
- `src/app/dashboard/claims/[id]/claim-images-tab.tsx` — Imágenes del siniestro (con IA background)

### Servicios
- `src/services/claim-actions.ts` — Lógica de gestiones (CRUD + estados)
- `src/services/claim-action-documents.ts` — Versionado de documentos
- `src/services/claim-documents.ts` — Solicitudes de documentos
- `src/services/workflow-configs.ts` — Configuración de workflows
- `src/services/gestion-screens.ts` — Pantallas dinámicas
- `src/services/document-render.ts` — Generación DOCX/XLSX/PPTX
- `src/services/pdf-conversion.ts` — Conversión a PDF (Gotenberg)
- `src/services/document-data.ts` — Construcción de datos del siniestro
- `src/services/my-gestiones.ts` — Gestiones del usuario actual

### Librerías
- `src/lib/document-fields.ts` — Catálogo de campos para plantillas
- `src/lib/storage/claim-upload.ts` — Upload a R2 con path estructurado
- `src/lib/storage/optimize.ts` — Optimización de imágenes (sharp)

### Catálogos
- `src/app/dashboard/catalogos/gestiones/` — Gestiones, campos, características, dependencias, tipos
- `src/app/dashboard/catalogos/pantallas/` — Pantallas y editor visual

---

## 12. Migraciones Relevantes

### Workflow (135-149)
- `135_workflow_configs.sql` — Tablas workflow_configs + workflow_steps
- `136_workflow_final.sql` — Modelo final (depends_on, origin)
- `137_workflow_unique.sql` — Unicidad de configs
- `138_workflow_rls.sql` — RLS
- `139_template_dependencies.sql` — Tabla de dependencias
- `140_cascade_trigger.sql` — Trigger cascade
- `142_dependencies_by_code.sql` — Dependencias por código
- `143_cascade_trigger_v2.sql` — Trigger v2
- `144_sync_workflow.sql` — Función sync_workflow_for_claim
- `145_workflow_status.sql` — Status draft/online/suspended
- `146_triggers_online.sql` — Triggers con status=online
- `147_fix_workflow_triggers.sql` — Corrección de triggers
- `148_sync_no_parent_if_child_exists.sql` — No crear padre retroactivo
- `149_auto_assign_responsibles.sql` — Auto-asignación de responsables

### Gestiones (113-132)
- `113_gestion_linea_negocio_y_codificacion.sql` — Sistema por línea de negocio
- `116_claim_actions_is_automatic.sql` — Campo is_automatic
- `117_claim_documents.sql` — Tabla claim_documents
- `121_rejection_fields.sql` — Campos de rechazo
- `122_claim_action_history.sql` — Historial
- `125_fix_claim_action_code_format.sql` — Formato de código
- `131_correlativo_por_template.sql` — Correlativo por template
- `132_reactivate_soft_deleted.sql` — Reactivación

### Documentos (150-180)
- `150_snapshot_parent_data.sql` — Snapshot de datos del padre
- `162_claim_action_file_seq.sql` — Secuencia de archivos
- `163_file_sequences.sql` — Secuencias de archivos
- `172_claim_documents_ai_columns.sql` — Columnas AI
- `175_claim_documents_ai_status.sql` — Status AI en claim_documents
- `180_claim_action_documents.sql` — Tabla con versionado y lock

### Screens (110, 158, 183-188)
- `110_screen_layouts.sql` — Layouts multi-columna
- `158_field_config_catalogs.sql` — Catálogos de campos
- `183_clean_generica_screen.sql` — Limpieza pantalla genérica
- `184_fix_action_template_codes.sql` — Corrección códigos
- `185_enable_has_template.sql` — Habilitación has_template
- `188_only_ili_has_template.sql` — Solo ILI tiene template

### Snapshots (190-194)
- `190_add_screen_snapshot_to_claim_actions.sql` — Snapshot en claim_actions
- `192_workflow_trigger_screen_snapshot.sql` — Trigger con snapshot
- `193_all_triggers_screen_snapshot.sql` — Todos los triggers
- `194_refresh_pristine_snapshots.sql` — Refrescar snapshots

---

## 13. Decisiones Técnicas

### 13.1 Workflow con triggers SQL en lugar de aplicación

**Decisión:** El workflow se ejecuta con triggers SQL en PostgreSQL, no en la aplicación.

**Ventajas:**
- Atomicidad garantizada (si el trigger falla, el cambio de estado falla)
- Performance (no hay round-trips app → DB)
- Consistencia (no depende de que la app esté funcionando)

**Desventajas:**
- Lógica de negocio en SQL (más difícil de debuggear)
- Cambios requieren migraciones
- Tests más complejos

### 13.2 Pantallas dinámicas con form_schema JSON

**Decisión:** Las pantallas se definen como JSON en `gestion_screens.form_schema`, no como código.

**Ventajas:**
- Editables sin deploy (via editor visual)
- Reutilizables entre gestiones
- Configurables por característica

**Desventajas:**
- Validación más compleja
- Debugging más difícil (no hay TypeScript para el schema)
- Campos complejos requieren componentes específicos

### 13.3 Versionado de documentos con lock

**Decisión:** Cada documento tiene versionado (`is_current`) y lock para edición offline.

**Ventajas:**
- Trazabilidad completa (quién editó qué y cuándo)
- Permite edición offline sin conflictos
- Restauración de versiones anteriores

**Desventajas:**
- Complejidad adicional
- Posible lock olvidado (requiere force-unlock)

### 13.4 Autoguardado sin botón "Guardar"

**Decisión:** Ninguna pantalla de gestión tiene botón "Guardar". Todo se guarda automáticamente con debounce 500ms.

**Ventajas:**
- UX tipo Excel (sin fricción)
- No se pierden datos por olvidar guardar
- Feedback visual inmediato

**Desventajas:**
- Guardados innecesarios (cada keystroke después de 500ms de inactividad)
- Requiere manejo cuidadoso de race conditions
- No hay "deshacer" cambios
