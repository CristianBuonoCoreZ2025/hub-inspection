# Plan de Desarrollo — Hub Inspections

> Plan actualizado el 18-06-2026. Estado completo del codebase.

---

## Fase 1: Base SaaS — LISTO

| Modulo | Estado | Detalle |
|--------|--------|---------|
| Landing page | Listo | Pagina publica con info del producto |
| Auth (Nhost) | Listo | Login, registro, forgot/reset password, onboarding obligatorio |
| Multi-tenant | Listo | Tabla `companies`, `company_id` en perfiles y siniestros |
| Usuarios | Listo | CRUD completo, invitacion por rol, activar/desactivar |
| Empresas | Listo | CRUD completo, upload de logo a Nhost Storage, validacion RUT Chile |
| Sidebar + Header | Listo | Navegacion responsive, breadcrumbs, tema dark/light, 5 skins, menu acordeon |
| Dashboard | Listo | Metricas reales desde DB (claims por estado, inspecciones, actividad reciente via audit_logs) |
| Configuracion | Listo | Cambio de tema, selector de skin, panel de diagnostico (logs) |
| Base de datos | Listo | 15 tablas base, triggers, RLS, migraciones versionadas |

---

## Fase 2: Core

### 2.1 Siniestros (Claims) — ~95%

**Hecho:**
- [x] Tabla `claims` con campos genericos (sin dependencia de ninguna empresa)
- [x] Eliminados campos exclusivos de McLarens (`mclarens_one_number`, `internal_number` renombrado a `client_reference`)
- [x] Servicios GraphQL: getClaims, getClaimById, createClaim, updateClaim, updateClaimStatus, deleteClaim
- [x] Frontend: lista con busqueda, modal creacion/edición optimizado
- [x] Validacion Zod completa
- [x] 7 estados: created → scheduled → in_progress → pending_info → in_review → signed → closed
- [x] Equipo asignado simplificado: Inspector + Ajustador
- [x] Seccion Asesor con combobox de catalogo
- [x] Seccion Corredor: Corredor (combobox) + N° Corredor
- [x] Empresa (Cliente) como primer campo del formulario
- [x] Compañia de Seguros dentro de seccion Siniestro y Liquidacion
- [x] Inputs compactos: h-7, gaps reducidos
- [x] Relacion con perfiles (joins GraphQL)
- [x] Boton "Inspeccionar" crea sesion y redirige al detalle

**Pendiente:**
- [x] **Pagina de detalle de siniestro** — `/dashboard/claims/[id]` con datos completos, equipo, corredor, fechas
- [x] **Filtros avanzados** en lista — por estado, por rango de fecha, busqueda texto + exportar CSV
- [x] **Cambio de estado con workflow** — automatico via inspeccion (session → claim) + boton manual "Cerrar caso" (signed → closed)
- [x] **Historial de cambios** — audit log visible en el detalle del siniestro (triggers PostgreSQL + servicio GraphQL + UI)

### 2.2 Catálogos Maestros — 100%

**Tablas creadas:**
- [x] `claim_causes` — Causas de siniestro
- [x] `insurance_companies` — Compañias de seguros
- [x] `brokers` — Corredores
- [x] `advisors` — Asesores
- [x] `business_lines` — Lineas de negocio
- [x] `insurance_products` — Ramos/Productos

**Frontend:**
- [x] 6 paginas CRUD completas con busqueda, crear, editar, desactivar
- [x] Menu "Catálogos" expandible en sidebar
- [x] Comboboxes conectados al formulario de siniestros

### 2.3 Carga Masiva — 100%

- [x] Libreria `xlsx` (SheetJS) instalada
- [x] **Carga Siniestros**: parseo Excel, mapeo flexible de columnas, preview, validacion, carga progresiva
- [x] **Carga Catálogos**: selector de catalogo, mapeo por tipo, preview dinamico, carga progresiva
- [x] Menu "Operaciones" expandible en sidebar

### 2.4 Agenda — 100%

- [x] Vista semanal (Lunes a Domingo)
- [x] Navegacion: semana anterior/siguiente, boton "Hoy"
- [x] Filtro por inspector
- [x] Eventos con estado, hora, siniestro, asegurado, direccion

---

## Fase 3: Inspeccion Remota

> **Backend 100% listo** (15 tablas, todos los servicios GraphQL).
>
> **Ver documento de flujo completo:** [`PLAN_INSPECCION.md`](./PLAN_INSPECCION.md)

### 3.1 Sesiones de Inspeccion

**Backend (listo):**
- [x] Tabla `inspection_sessions` con datos del Acta
- [x] Servicios: CRUD completo, relacion con claim

**Frontend:**
- [x] Listar sesiones por estado (pending, scheduled, active, completed, cancelled)
- [x] Filtros por estado y busqueda
- [x] Acciones segun estado: Agendar, Iniciar, Completar, Cancelar
- [x] Modal "Nueva Inspeccion" con selector de siniestro
- [x] Pagina de detalle con 7 tabs

### 3.2 Acta de Inspeccion — 100%

**Backend (listo):**
- [x] 5 columnas JSONB en `inspection_sessions`: `property_risk`, `property_materiality`, `security_measures`, `insured_statement`, `third_parties`
- [x] Servicio GraphQL: update con todos los campos JSONB

**Frontend:**
- [x] Wizard de 6 pasos: Datos Generales, Riesgo, Materialidad, Seguridad, Declaracion, Terceros
- [x] Stepper de navegacion
- [x] Guardado por mutation unica
- [x] Validacion Zod (`actaSchema`)

### 3.3 Checklist — 100%

- [x] Tabla `inspection_checklists` + servicios GraphQL CRUD
- [x] Frontend: agregar items por area, toggle estado (reviewed/pending/not_applicable), notas, eliminar
- [x] Agrupado por area con iconos de estado

### 3.4 Daños — 100%

- [x] Tabla `inspection_damages` + servicios GraphQL CRUD
- [x] Frontend: formulario con categoria (edificio/contenido), subcategoria, severidad (low/medium/high/total)
- [x] Campos especiales para contenido: producto, marca/modelo, fecha compra
- [x] Tabla con badge de severidad, monto estimado, total acumulado

### 3.5 Evidencias — 100%

- [x] Tabla `inspection_evidences` + servicios GraphQL CRUD
- [x] Frontend: drop zone drag-and-drop, upload a Nhost Storage
- [x] Galería por tipo (fotos/videos/documentos) con preview
- [x] Hover overlay con botón eliminar

### 3.6 Firmas Digitales — 100%

- [x] Tabla `inspection_signatures` + servicios GraphQL
- [x] Frontend: canvas HTML5 con mouse y touch, guarda como PNG
- [x] Firma del Asegurado + Firma del Ajustador
- [x] Preview de firmas guardadas con fecha/hora

### 3.7 Informes PDF — 100%

- [x] Tabla `inspection_reports` + servicios GraphQL
- [x] Frontend: preview del informe con datos del siniestro
- [x] Generar/Regenerar informe, imprimir (abre ventana con print CSS)
- [x] Estado: draft / generated / sent

---

## Fase 4: Avanzado (Post-produccion)

| Modulo | Prioridad | Descripcion |
|--------|-----------|-------------|
| IA con OpenRouter | Baja | Analisis automatico de danos, sugerencias de monto |
| OCR | Baja | Extraer datos de documentos escaneados |
| Croquis interactivo | Baja | Dibujar croquis digital en el navegador |
| Realtime completo | Media | WebSockets para actualizaciones en vivo |
| Notificaciones push | Media | Notificar asignaciones, inicio de inspeccion |
| App mobile | Baja | Version responsive/PWA para inspeccion en terreno |

---

## Proximos Pasos Recomendados

1. **Ajustar mapeo de Excel** cuando el usuario entregue los archivos de su cliente
2. **Notificaciones push** — cuando se asigna un siniestro o inicia inspeccion
3. **Dashboard mejorado** — graficos, comparativas mensuales, KPIs adicionales
4. **Croquis interactivo** — canvas para dibujar areas afectadas (actualmente es upload de imagen)
5. **Realtime chat** — suscripciones GraphQL para actualizaciones en vivo del chat

---

## Estado por Pagina del Dashboard

| Ruta | Estado | Conectado a DB |
|------|--------|----------------|
| `/dashboard` | Funcional (datos reales) | Si |
| `/dashboard/claims` | ~100% funcional (detalle + filtros + exportar + workflow + audit log) | Si |
| `/dashboard/inspecciones` | Lista + detalle con tabs | Si |
| `/dashboard/inspecciones/[id]` | 8 tabs funcionales (Acta, Checklist, Daños, Evidencias, Croquis, Firmas, Informe, Chat) | Si |
| `/dashboard/agenda` | Vista semanal funcional | Si |
| `/dashboard/catalogos/causas` | CRUD completo | Si |
| `/dashboard/catalogos/companias` | CRUD completo | Si |
| `/dashboard/catalogos/corredores` | CRUD completo | Si |
| `/dashboard/catalogos/asesores` | CRUD completo | Si |
| `/dashboard/catalogos/lineas-negocio` | CRUD completo | Si |
| `/dashboard/catalogos/productos` | CRUD completo | Si |
| `/dashboard/operaciones/carga-siniestros` | Carga masiva Excel | Si |
| `/dashboard/operaciones/carga-catalogos` | Carga masiva Excel (6 catálogos) | Si |
| `/dashboard/evidencias` | Redirige a /inspecciones | Si |
| `/dashboard/informes` | Redirige a /inspecciones | Si |
| `/dashboard/users` | Funcional | Si |
| `/dashboard/companies` | Funcional | Si |
| `/dashboard/configuracion` | Funcional | No (local) |

---

## Migraciones SQL

| Archivo | Descripcion |
|---------|-------------|
| `01_tables.sql` | Tablas base (companies, profiles, claims, etc.) |
| `02_triggers.sql` | Triggers `update_updated_at_column` |
| `03_policies.sql` | RLS policies |
| `04_claim_fields.sql` | Campos adicionales de claims |
| `05_claim_participants.sql` | Tabla claim_participants |
| `06_inspections.sql` | Tablas de inspeccion (sessions, checklists, damages, evidences, etc.) |
| `07_inspection_chat.sql` | Tabla inspection_chat_messages |
| `08_claim_status.sql` | Campo status en claims |
| `09_business_lines.sql` | Tabla business_lines |
| `10_remove_mclarens_fields.sql` | Elimina mclarens_one_number, renombra internal_number |
| `11_add_acta_fields.sql` | Campos JSONB del Acta en inspection_sessions |
| `12_catalogs.sql` | 5 tablas de catalogos (causas, companias, corredores, lineas, productos) |
| `13_add_advisors_catalog.sql` | Tabla advisors |
| `14_audit_triggers.sql` | Triggers audit_log para claims e inspection_sessions |
