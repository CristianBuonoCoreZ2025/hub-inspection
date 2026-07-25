# Plan de Plantillas de E-mail — Hub Inspection

> Estado al **2026-07-23**. Documento vivo: se actualiza con cada commit.
> Plan independiente del módulo de **Plantillas de E-mail**, ubicado dentro del catálogo de **Gestiones**.
>
> **Convención de estados:**
> - ✅ **Completado** — funcional y en producción
> - 🟡 **Parcial** — implementado pero con limitaciones conocidas
> - ⏳ **Pendiente** — no implementado aún
> - 🔴 **Bloqueado** — requiere decisión o infraestructura externa

---

## 1. Objetivo y Concepto

El módulo **Plantillas de E-mail** permite crear, configurar y usar plantillas de correo electrónico que se vinculan a **action_templates** (tipos de gestión). Su comportamiento es análogo al de las plantillas de documentos Office existentes, pero orientado a texto/plano y HTML para envío por e-mail.

### Casos de uso principales

1. **Envío manual desde una acción de siniestro**: Cuando una acción tiene plantillas de e-mail activas, el usuario ve un botón de e-mail. Al hacer clic elige una plantilla, se le carga el asunto y cuerpo con los placeholders reemplazados, completa el destinatario y envía.
2. **Emisión + envío automático**: Algunas acciones (ej: Aviso de Asignación) pueden configurarse para que, al crearse por workflow, se emitan automáticamente y se envíe un e-mail usando una plantilla predefinida.
3. **Coordinación manual**: Para acciones como Coordinación de Inspección, el usuario coordina, abre la plantilla de e-mail y envía al asegurado la información de la coordinación.

---

## 2. Ubicación en la Navegación

Dentro del menú lateral, en **Catálogos → Gestiones**, se agrega:

- **Plantillas de E-mail** → `/dashboard/catalogos/gestiones/email-templates`

Misma sección donde hoy están `Tipos de Gestión`, `Características`, `Pantallas`, `Gestiones`, `Dependencias`, `Campos Plantillas` y `Workflows`.

---

## 3. Modelo de Datos

### 3.1 Tablas nuevas

| Tabla | Descripción |
|-------|-------------|
| `email_templates` | Plantilla de e-mail propiamente tal (nombre, línea de negocio, asunto, cuerpo, placeholders, activa, etc.) |
| `email_logs` | Registro de e-mails enviados vinculados a una `claim_action` y a una `email_template` |

### 3.2 `email_templates`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK → `companies` | Multi-tenant |
| `business_line_id` | uuid FK → `business_lines` | Línea de negocio a la que aplica (hogar, comercial, etc.) |
| `action_template_id` | uuid FK → `action_template` | Tipo de gestión a la que está asociada (ej: AVI, CIN) |
| `name` | text | Nombre interno de la plantilla |
| `subject` | text | Asunto del e-mail. Soporta placeholders |
| `body` | text | Cuerpo del e-mail. Soporta placeholders |
| `detected_placeholders` | jsonb | Lista de placeholders detectados en `subject` + `body` |
| `placeholder_mapping` | jsonb | Mapa `{ "placeholder": "ruta_o_campo" }` para resolución de datos |
| `is_active` | boolean | Plantilla visible/enviable |
| `sort_order` | integer | Orden dentro de la lista de plantillas de una acción |
| `created_by` | uuid FK → `profiles` | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Índices**:
- `idx_email_templates_action_business` (`action_template_id`, `business_line_id`, `is_active`)
- `idx_email_templates_company` (`company_id`)

### 3.3 `email_logs`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK → `companies` | |
| `claim_id` | uuid FK → `claims` | |
| `claim_action_id` | uuid FK → `claim_actions` | Acción desde la cual se envió |
| `email_template_id` | uuid FK → `email_templates` | Plantilla usada |
| `to_address` | text[] | Destinatarios principales |
| `cc_address` | text[] | Con copia |
| `bcc_address` | text[] | Con copia oculta |
| `subject` | text | Asunto final ya reemplazado |
| `body` | text | Cuerpo final ya reemplazado |
| `status` | text | `sent`, `failed`, `queued` |
| `provider_response` | jsonb | Respuesta del proveedor de envío |
| `sent_by` | uuid FK → `profiles` | Usuario que disparó el envío |
| `sent_at` | timestamptz | |
| `created_at` | timestamptz | |

### 3.4 Cambios en `action_template`

Se agregan columnas para controlar emisión + envío automático:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `auto_complete` | boolean | Si `true`, la acción se emite automáticamente al crearse por workflow |
| `auto_email` | boolean | Si `true`, además de emitirse envía un e-mail automático |
| `auto_email_template_id` | uuid FK → `email_templates` | Plantilla a usar en el envío automático |

### 3.5 RLS

- `email_templates`: `company_id` = empresa del usuario actual (o perfil admin).
- `email_logs`: `company_id` = empresa del usuario actual.

---

## 4. Placeholders y Resolución de Datos

### 4.1 Formatos soportados

Se reutiliza la misma sintaxis de placeholders que las plantillas de documentos:

- `<placeholder>` — ángulos (docxtemplater style)
- `[PLACEHOLDER]` — corchetes y MAYÚSCULAS (formato chileno)
- `{{placeholder}}` — opcional, si se decide expandir

### 4.2 Origen de datos para reemplazo

Para reemplazar placeholders se construye un `data` object a partir de:

1. Datos del `claim` (`claim_number`, `liquidation_number`, `claim_address`, etc.)
2. Datos del `claim_action` (`created_on`, `issued_on`, `code`, `name`, etc.)
3. Datos del `action_data` de la acción (campos propios de la pantalla)
4. Perfiles asociados (`adjuster`, `inspector`, `insured`, etc.)
5. Datos de la `policy` vinculada
6. Datos de la `inspection_session` si aplica

El `placeholder_mapping` JSON permite que el usuario decida, si lo desea, qué campo del sistema alimenta cada placeholder. Si no hay mapeo, se resuelve por nombre (case-insensitive) contra el `data` object.

### 4.3 Servicio `renderEmailTemplate`

```ts
function renderEmailTemplate(
  template: { subject: string; body: string; placeholder_mapping?: Record<string, string> },
  data: Record<string, unknown>
): { subject: string; body: string }
```

- Extrae placeholders de `subject` y `body`.
- Aplica `placeholder_mapping` y luego busca en `data`.
- Sustituye tanto `<placeholder>` como `[PLACEHOLDER]`.
- Placeholders sin valor quedan como string vacío (`""`).

---

## 5. Flujos de Uso

### 5.1 Manual — Desde una acción de siniestro

1. El usuario entra a una acción que tiene `email_template = true` (característica de la acción) y existen plantillas activas para su `action_template_id` + `business_line_id`.
2. Aparece un botón `E-mail` (icono `Mail`).
3. Al hacer clic se abre un drawer/modal:
   - Lista de plantillas activas.
   - Al seleccionar una se renderiza el asunto y cuerpo reemplazados.
   - Campos editables: `Para`, `CC`, `CCO`.
   - Botón `Enviar`.
4. Al enviar:
   - Se guarda en `email_logs`.
   - Se dispara el envío real a través de proveedor configurado (SMTP / SendGrid / Resend / etc.).
   - Se actualiza el `claim_action` (opcional: marca `email_sent` o similar).

### 5.2 Automático — Emisión + E-mail al crear acción

1. Workflow crea una `claim_action` cuyo `action_template` tiene `auto_complete = true`.
2. El trigger `execute_workflow_on_status_change` (o un trigger/función posterior) llama a `autoIssueAndEmail(action_id)`.
3. `autoIssueAndEmail`:
   - Emite la acción (status `issued`, setea `issued_on`, `issued_by` = sistema).
   - Si `auto_email = true` y `auto_email_template_id` existe, renderiza y envía el e-mail.
   - Guarda en `email_logs` con `sent_by` = sistema o workflow.
4. El usuario ve la acción ya emitida y con el e-mail enviado en el historial.

### 5.3 Configuración desde `action_template`

En la pantalla de configuración de `action_template` (o en la característica) se agrega:

- Switch `Completar automáticamente`.
- Switch `Enviar e-mail automáticamente` (solo visible si `auto_complete` = true).
- Selector de plantilla de e-mail (filtrado por `business_line` de la plantilla).
- Botón `Crear nueva plantilla de e-mail` que abre el editor vinculado al `action_template` actual.

---

## 6. UI / Pantallas

### 6.1 Catálogo — Listado de Plantillas (`/dashboard/catalogos/gestiones/email-templates`)

- Tabla con: `Nombre`, `Acción vinculada`, `Línea de negocio`, `Asunto`, `Activa`.
- Filtros por `action_template`, `business_line`, `activa`.
- Botón `Nueva Plantilla`.
- Acciones: Editar, Duplicar, Activar/Desactivar.

### 6.2 Catálogo — Editor de Plantilla (`/dashboard/catalogos/gestiones/email-templates/[id]`)

- Campo `Nombre`.
- Selector `Línea de negocio`.
- Selector `Acción vinculada` (`action_template`).
- Campo `Asunto` con detección de placeholders.
- Editor `Cuerpo del e-mail` (textarea; futuro: rich text).
- Panel lateral: **Campos disponibles** (lista de placeholders del sistema) para copiar/pegar.
- Botón `Detectar placeholders` que escanea `subject` + `body` y muestra lista.
- Tab `Mapeo de placeholders` para vincular cada placeholder a un campo del sistema.
- Switch `Activa`.
- Preview: renderiza un ejemplo con datos de prueba.

### 6.3 En la acción del siniestro — Botón E-mail

- Ubicado en el header de la acción, junto a `Emitir`, `Revisar`, etc.
- Solo visible si la característica de la acción tiene `email_template = true` y existen plantillas activas para el `action_template` + `business_line` del claim.
- Al hacer clic: abre `SendEmailDrawer`.

### 6.4 `SendEmailDrawer` / Modal

- Select de plantilla activa.
- Preview de asunto y cuerpo reemplazados (read-only o editable limitado).
- Inputs `Para`, `CC`, `CCO` (multiples e-mails).
- Botón `Enviar`.
- Enlace `Ver e-mails enviados` que lista `email_logs` de esa acción.

### 6.5 Historial de E-mails de una acción

- Tab o sección dentro de la acción: lista de `email_logs` con fecha, destinatario, asunto, estado.

---

## 7. Servicios (capa `src/services`)

| Servicio | Responsabilidad |
|----------|-----------------|
| `email-templates.ts` | CRUD de `email_templates` (get, create, update, delete lógico) |
| `email-logs.ts` | CRUD de `email_logs` (listar por acción, crear registro) |
| `email-render.ts` | `renderEmailTemplate(template, data)` + `extractPlaceholders(text)` |
| `email-sender.ts` | Envío real vía proveedor configurado; guarda en `email_logs` |
| `email-actions.ts` | `getAvailableEmailTemplates(action)` y `sendEmailFromAction(...)` |
| `claim-actions.ts` (extensión) | `autoIssueAndEmail(actionId)` para emisión + envío automático |

### 7.1 `email-sender.ts`

Proveedor configurable mediante variables de entorno:

```
EMAIL_PROVIDER=sendgrid|resend|smtp
EMAIL_FROM=...
SENDGRID_API_KEY=...
RESEND_API_KEY=...
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
```

El servicio retorna `{ status, provider_response }` para guardar en `email_logs`.

---

## 8. Permisos

Sección sugerida: `catalogos_gestiones_email_templates`.

| Permiso | Quién lo tiene |
|---------|----------------|
| `view` | Perfiles operativos y administradores |
| `create/edit` | Administradores / configuradores de catálogos |
| `delete` | Administradores (soft delete) |

Para envío desde acción: permiso `edit` sobre la acción o `operaciones`.

---

## 9. Migraciones

| Nº | Archivo | Contenido |
|----|---------|-----------|
| 221 | `migrations/221_email_templates_and_logs.sql` | Crear `email_templates`, `email_logs`, agregar `auto_complete`, `auto_email`, `auto_email_template_id` a `action_template` |
| 222 | `migrations/222_email_templates_rls.sql` | RLS en `email_templates` y `email_logs` |

---

## 10. Fases de Implementación

### Fase 1 — Esqueleto y base de datos
- [ ] ⏳ Migración 221: tablas + columnas en `action_template`
- [ ] ⏳ Migración 222: RLS
- [ ] ⏳ Servicios base: `email-templates.ts`, `email-logs.ts`, `email-render.ts`

### Fase 2 — Catálogo de Plantillas
- [ ] ⏳ Pantalla listado `/dashboard/catalogos/gestiones/email-templates`
- [ ] ⏳ Pantalla editor `/dashboard/catalogos/gestiones/email-templates/[id]`
- [ ] ⏳ Menú lateral en `gestionCatalogLinks`
- [ ] ⏳ Detección de placeholders y preview

### Fase 3 — Configuración en `action_template`
- [ ] ⏳ Agregar switches `auto_complete` y `auto_email` en formulario de `action_template`
- [ ] ⏳ Selector de plantilla para envío automático
- [ ] ⏳ Crear plantilla desde el `action_template`

### Fase 4 — Envío manual desde acción
- [ ] ⏳ Botón `E-mail` en `DynamicScreen` / detalle de acción
- [ ] ⏳ `SendEmailDrawer` con selección de plantilla, preview, destinatarios
- [ ] ⏳ `email-sender.ts` con proveedor configurable
- [ ] ⏳ Guardado en `email_logs`
- [ ] ⏳ Historial de e-mails en la acción

### Fase 5 — Envío automático
- [ ] ⏳ Función `autoIssueAndEmail(actionId)`
- [ ] ⏳ Integrar en workflow trigger `execute_workflow_on_status_change`
- [ ] ⏳ Marcar acciones como emitidas por sistema

### Fase 6 — Refinamientos
- [ ] ⏳ Rich text editor para body (opcional)
- [ ] ⏳ Adjuntos en e-mails
- [ ] ⏳ Plantillas por compañía de seguros / evento / país

---

## 11. Notas y decisiones pendientes

1. **Proveedor de e-mail**: Se recomienda comenzar con **Resend** o **SendGrid** por simplicidad. SMTP como fallback.
2. **Rich text**: En MVP el body es texto plano/multilínea. HTML se puede agregar en Fase 6.
3. **Plantillas por idioma**: No incluido en MVP. Se mantiene una plantilla por `business_line` + `action_template`.
4. **Reintentos**: `email_logs.status = 'failed'` permite reintentar manualmente desde el historial.
5. **Datos de prueba para preview**: Usar el `claim` de ejemplo o un objeto de prueba estático.

---

## 12. Relación con Documentos Office

El módulo de Plantillas de E-mail reutiliza el mismo concepto de **placeholders** y **mapeo de campos** que ya existe para documentos Office. La diferencia es:

- **Documentos Office**: requiere archivo `.docx`/`.xlsx`/`.pptx`, se descarga/renderiza un archivo binario.
- **E-mail**: no requiere archivo; el cuerpo es texto con placeholders, se envía directamente vía API de e-mail.

Por tanto, `email_templates` es más simple que `document_templates` pero comparte la lógica de extracción y reemplazo de placeholders.
