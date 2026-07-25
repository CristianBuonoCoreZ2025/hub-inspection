# Plan de Plantillas de E-mail — Hub Inspection

> Estado al **2026-07-25**. Documento vivo: se actualiza con cada commit.
> Módulo **Plantillas de E-mail**, dentro del catálogo de **Gestiones**.
>
> **Convención de estados:**
> - ✅ **Completado** — funcional y en producción
> - 🟡 **Parcial** — implementado pero con limitaciones conocidas
> - ⏳ **Pendiente** — no implementado aún
> - 🔴 **Bloqueado** — requiere decisión o infraestructura externa

---

## 0. Correcciones respecto al plan anterior (2026-07-23)

El plan anterior tenía 3 errores de diseño que se corrigen en esta versión:

| # | Error anterior | Corrección |
|---|----------------|------------|
| 1 | `email_templates.action_template_id` era FK **obligatoria 1:1** (una plantilla → una acción) | **Many-to-many** vía tabla junction `email_template_actions`. Una plantilla se crea **sin** acción y se vincula a **N** acciones **después**. |
| 2 | UI mostraba el formulario arriba y la grilla abajo | **Grilla primero**. El formulario se abre en página editor aparte (`/new` y `/[id]`). |
| 3 | Botón "Crear" bloqueado por `action_template_id` obligatorio | El botón "Crear" se habilita solo con `name` + `subject` + `body`. La acción se vincula después. |
| 4 | Placeholders por copiar/pegar | **Insertor interactivo**: panel lateral de campos disponibles, click-to-insert o drag-and-drop. |
| 5 | Solo texto plano | Soporte **texto plano Y HTML** (toggle `body_format`), con logos, imágenes y estilos. |

Lo que **NO cambia** respecto al plan anterior:
- Ubicación en navegación: `Catálogos → Gestiones → Plantillas de E-mail`.
- Tabla `email_logs` y su estructura.
- Switches `auto_complete` / `auto_email` en `action_template`.
- Servicios `email-render`, `email-sender`, `email-actions`, `email-logs`.

---

## 1. Objetivo y Concepto

El módulo **Plantillas de E-mail** permite crear, configurar y reutilizar plantillas de correo
electrónico (texto plano o HTML rico) y **vincularlas a una o varias gestiones**
(`action_template`) después de creadas, filtrando por línea de negocio.

### Principio rector
> **Una plantilla de e-mail es un activo reutilizable.** Se crea una vez, se perfecciona,
> y después se asocia a las gestiones que la necesiten. Una misma plantilla puede servir
> para múltiples gestiones (ej: "Aviso de asignación" puede usarse en COI, AVI, CIN).

### Casos de uso principales
1. **Envío manual desde una acción de siniestro** — la acción tiene plantillas activas
   vinculadas → botón `E-mail` → elegir plantilla → preview con placeholders reemplazados →
   completar destinatario → enviar.
2. **Emisión + envío automático** — `action_template.auto_complete = true` emite al crear;
   `auto_email = true` envía un e-mail automático usando `auto_email_template_id`
   (obligatorio si `auto_email = true`).
3. **Coordinación manual** — acciones como Coordinación de Inspección: el usuario coordina,
   abre la plantilla y envía al asegurado.

---

## 2. Ubicación en la Navegación

`Catálogos → Gestiones`:
- **Plantillas de E-mail** → `/dashboard/catalogos/gestiones/email-templates` (grilla)
- **Editor de plantilla** → `/dashboard/catalogos/gestiones/email-templates/new` y `/[id]`

Misma sección donde hoy están `Tipos de Gestión`, `Características`, `Pantallas`,
`Gestiones`, `Dependencias`, `Campos Plantillas` y `Workflows`.

---

## 3. Modelo de Datos

### 3.1 Tablas

| Tabla | Descripción |
|-------|-------------|
| `email_templates` | Plantilla de e-mail (nombre, línea de negocio, formato, asunto, cuerpo, placeholders, activa). **Sin FK directa a action_template.** |
| `email_template_actions` | **Junction many-to-many** entre `email_templates` y `action_template`. |
| `email_logs` | Registro de e-mails enviados vinculados a una `claim_action` y a una `email_template`. |

### 3.2 `email_templates` (corregida)

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK → `companies` | Multi-tenant |
| `business_line_id` | uuid FK → `business_lines` | Línea de negocio a la que aplica (hogar, comercial, etc.). Nullable = aplica a todas |
| ~~`action_template_id`~~ | ~~uuid FK~~ | **Queda como columna nullable obsoleta** después de migrar (ver §9.1). No se usa en código nuevo. Se dropea solo con autorización explícita (REGLA #1). |
| `name` | text | Nombre interno |
| `description` | text | Descripción opcional |
| `body_format` | text | `'plain'` (default) o `'html'`. Determina cómo se renderiza y envía |
| `subject` | text | Asunto. Soporta placeholders |
| `body` | text | Cuerpo. Texto plano o HTML según `body_format`. Soporta placeholders |
| `logo_url` | text | URL del logo embebido (opcional). Para HTML |
| `header_color` | text | Color de cabecera HTML (opcional) |
| `detected_placeholders` | jsonb | Lista de placeholders detectados en `subject` + `body` |
| `placeholder_mapping` | jsonb | Mapa `{ "placeholder": "ruta_o_campo" }` |
| `is_active` | boolean | Visible/enviable |
| `sort_order` | integer | Orden |
| `created_by` | uuid FK → `profiles` | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Índices**:
- `idx_email_templates_company` (`company_id`)
- `idx_email_templates_business` (`business_line_id`, `is_active`)

### 3.3 `email_template_actions` (NUEVA — junction)

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `email_template_id` | uuid FK → `email_templates` | `ON DELETE CASCADE` |
| `action_template_id` | uuid FK → `action_template` | `ON DELETE CASCADE` |
| `is_default` | boolean | `true` = plantilla por defecto para esa acción (solo una por acción+línea) |
| `created_by` | uuid FK → `profiles` | |
| `created_at` | timestamptz | |

**Restricciones**:
- PK compuesta alternativa: `UNIQUE (email_template_id, action_template_id)`.
- **Partial unique**: solo una `is_default = true` por `(action_template_id, business_line_id)`
  vía índice único parcial.
- `is_default = true` es **obligatoria** cuando la acción tiene `auto_email = true`
  (validación en servicio, no en DB — el switch exige seleccionar plantilla por defecto).

### 3.4 `email_logs` (sin cambios)

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK → `companies` | |
| `claim_id` | uuid FK → `claims` | |
| `claim_action_id` | uuid FK → `claim_actions` | |
| `email_template_id` | uuid FK → `email_templates` | |
| `to_address` | text[] | |
| `cc_address` | text[] | |
| `bcc_address` | text[] | |
| `subject` | text | Asunto final ya reemplazado |
| `body` | text | Cuerpo final ya reemplazado |
| `body_format` | text | `'plain'` o `'html'` (copia del de la plantilla) |
| `status` | text | `sent`, `failed`, `queued` |
| `provider_response` | jsonb | |
| `sent_by` | uuid FK → `profiles` | |
| `sent_at` | timestamptz | |
| `created_at` | timestamptz | |

### 3.5 Cambios en `action_template`

Ya existen (migración 221/222): `auto_complete`, `auto_email`, `auto_email_template_id`,
`auto_email_recipients`, `auto_field_mapping`.

**Cambio**: `auto_email_template_id` pasa a ser **referencia directa** a una plantilla
marcada como `is_default = true` en la junction para esa acción. Se conserva la columna
para no romper datos existentes; el selector en UI filtra plantillas vinculadas con
`is_default = true`.

### 3.6 RLS
- `email_templates`: `is_tenant_allowed(company_id)`.
- `email_template_actions`: hereda vía join a `email_templates.company_id` —
  política que valida `is_tenant_allowed((SELECT company_id FROM email_templates WHERE id = email_template_id))`.
- `email_logs`: `is_tenant_allowed(company_id)`.

---

## 4. Placeholders y Resolución de Datos

### 4.1 Formatos soportados
- `<placeholder>` — ángulos (docxtemplater style)
- `[PLACEHOLDER]` — corchetes y MAYÚSCULAS (formato chileno)
- `{{placeholder}}` — opcional

### 4.2 Origen de datos para reemplazo
Mismo `data` object que las plantillas de documentos:
1. `claim` (`claim_number`, `liquidation_number`, `claim_address`, etc.)
2. `claim_action` (`created_on`, `issued_on`, `code`, `name`, etc.)
3. `action_data` de la acción (campos propios de la pantalla)
4. Perfiles asociados (`adjuster`, `inspector`, `insured`, etc.)
5. `policy` vinculada
6. `inspection_session` si aplica

El `placeholder_mapping` permite al usuario decidir qué campo del sistema alimenta cada
placeholder. Si no hay mapeo, se resuelve por nombre (case-insensitive) contra `data`.

### 4.3 Servicio `renderEmailTemplate`
```ts
function renderEmailTemplate(
  template: { subject: string; body: string; body_format: 'plain' | 'html'; placeholder_mapping?: Record<string, string> },
  data: Record<string, unknown>
): { subject: string; body: string; body_format: 'plain' | 'html' }
```
- Extrae placeholders de `subject` y `body`.
- Aplica `placeholder_mapping` y luego busca en `data`.
- Sustituye `<placeholder>`, `[PLACEHOLDER]` y `{{placeholder}}`.
- Placeholders sin valor → string vacío.

---

## 5. Flujos de Uso

### 5.1 Crear plantilla (sin acción)
1. Usuario entra a la grilla `/dashboard/catalogos/gestiones/email-templates`.
2. Clic en **Nueva Plantilla** → navega a `/new`.
3. Completa: nombre, línea de negocio (opcional), formato (`plain`/`html`), asunto, cuerpo.
4. Inserta placeholders desde el panel lateral de campos disponibles (click-to-insert).
5. Guarda. Vuelve a la grilla. **Aún no tiene acción vinculada.**

### 5.2 Vincular plantilla a una o varias gestiones
1. Usuario entra a `Catálogos → Gestiones → Tipos de Gestión` y abre una gestión.
2. En la ficha de la gestión, aparece la card **Plantillas de E-mail** (espejo de la card
   de Templates de documentos).
3. La card lista las plantillas vinculadas a esa acción (filtradas por línea de negocio
   de la gestión si aplica).
4. Botón **Vincular plantilla** → multi-select de plantillas existentes (filtradas por
   `business_line_id` compatible). Al vincular, crea fila en `email_template_actions`.
5. Marca una como **Por defecto** (radio). Solo una por acción+línea.
6. Permite desvincular (delete fila junction — **NO borra la plantilla**).

### 5.3 Envío manual desde una acción de siniestro
1. Usuario entra a una acción que tiene plantillas activas vinculadas a su
   `action_template_id` + `business_line_id`.
2. Aparece botón `E-mail` (icono `Mail`).
3. Clic → drawer/modal:
   - Select de plantillas activas (default preseleccionada si existe).
   - Preview de asunto y cuerpo reemplazados.
   - Inputs `Para`, `CC`, `CCO`.
   - Botón `Enviar`.
4. Al enviar: guarda en `email_logs`, dispara proveedor, actualiza `claim_action`.

### 5.4 Emisión + envío automático
1. Workflow crea `claim_action` cuyo `action_template` tiene `auto_complete = true`.
2. Trigger/función llama a `autoIssueAndEmail(action_id)`.
3. `autoIssueAndEmail`:
   - Emite la acción (`status = issued`, `issued_on`, `issued_by = sistema`).
   - Si `auto_email = true`: busca la plantilla con `is_default = true` en
     `email_template_actions` para esa acción (valida que exista — si no, loguea error
     y no envía). Renderiza y envía.
   - Guarda en `email_logs` con `sent_by = sistema`.
4. Usuario ve la acción ya emitida y con e-mail enviado en el historial.

### 5.5 Configuración desde `action_template`
En la ficha de la gestión (mismo lugar que la card de plantillas vinculadas):
- Switch `Completar automáticamente` (`auto_complete`).
- Switch `Enviar e-mail automáticamente` (`auto_email`) — visible solo si
  `auto_complete = true`.
- Si `auto_email = true`: **obliga** a tener una plantilla por defecto vinculada
  (bloquea guardar si no hay). Selector de plantilla por defecto entre las vinculadas.

---

## 6. UI / Pantallas

### 6.1 Grilla de plantillas (`/dashboard/catalogos/gestiones/email-templates`)
- **Grilla primero** (cards o tabla densa estilo Linear/Vercel).
- Columnas: `Nombre`, `Línea de negocio`, `Formato` (plain/html badge), `Asunto`,
  `Acciones vinculadas` (chips con código de gestión), `Activa`, `Acciones` (editar/desactivar).
- Filtros: por `business_line`, por `acción vinculada`, por `activa`, búsqueda por nombre.
- Botón **Nueva Plantilla** → navega a `/new`.
- Clic en fila → navega a `/[id]`.
- Acciones por fila: Editar, Duplicar, Activar/Desactivar (soft delete).
- **NO** hay formulario arriba. La grilla es el protagonista.

### 6.2 Editor de plantilla (`/new` y `/[id]`)
Layout de 2 columnas (desktop) / 1 columna (mobile):
- **Columna principal** (izquierda, ~70%):
  - Campo `Nombre`.
  - Textarea `Descripción` (opcional).
  - Selector `Línea de negocio` (opcional).
  - Toggle `Formato`: **Texto plano** / **HTML**.
  - Campo `Asunto` con detección de placeholders en vivo.
  - Editor `Cuerpo`:
    - Si `plain`: textarea mono-fuente.
    - Si `html`: editor rich-text (Tiptap o similar) con toolbar (negrita, itálica,
      listas, enlaces, imagen, logo, color de cabecera).
  - Switch `Activa`.
  - Preview en vivo (render con datos de prueba).
- **Columna lateral** (derecha, ~30%): **Insertor de campos**
  - Buscador de campos disponibles.
  - Lista agrupada por `FIELD_GROUPS` (claim, acción, perfiles, póliza, inspección).
  - **Click en campo → inserta placeholder en posición del cursor** del asunto o cuerpo
    (según cuál tenga foco).
  - **Drag-and-drop**: arrastrar campo al cuerpo lo inserta donde se suelta.
  - Sección `Placeholders detectados` con mapeo manual opcional (placeholder → campo).
  - Botón `Detectar placeholders` (re-escanea).
- Botones: `Guardar`, `Cancelar`, `Guardar y vincular a gestiones` (atajo que lleva a
  la ficha de gestión con esta plantilla preseleccionada).

### 6.3 Card en ficha de gestión (`action_template`)
Mismo patrón que `DocumentTemplatesCard`:
- Header `Plantillas de E-mail` + botón `Vincular plantilla`.
- Lista de plantillas vinculadas a esta acción (chips con nombre, línea de negocio,
  badge `Por defecto`).
- Acciones por fila: marcar/desmarcar `Por defecto`, desvincular.
- Botón `Vincular plantilla` → modal con multi-select filtrado por `business_line_id`
  compatible con la gestión.
- Debajo: switches `auto_complete` / `auto_email` + selector de plantilla por defecto
  (obligatorio si `auto_email = true`).

### 6.4 Botón E-mail en acción de siniestro
- En header de la acción, junto a `Emitir`, `Revisar`, etc.
- Visible si la acción tiene plantillas activas vinculadas.
- Clic → `SendEmailDrawer`.

### 6.5 `SendEmailDrawer`
- Select de plantilla activa (default preseleccionada).
- Preview asunto + cuerpo reemplazados (editable limitado).
- Inputs `Para`, `CC`, `CCO` (múltiples e-mails, chips).
- Botón `Enviar`.
- Enlace `Ver e-mails enviados` → lista `email_logs` de esa acción.

### 6.6 Historial de e-mails de una acción
- Tab/sección dentro de la acción: `email_logs` con fecha, destinatario, asunto, estado.

---

## 7. Servicios (capa `src/services`)

| Servicio | Responsabilidad |
|----------|-----------------|
| `email-templates.ts` | CRUD de `email_templates` (sin `action_template_id` obligatorio) |
| `email-template-actions.ts` | **NUEVO**. CRUD de la junction: `linkTemplateToAction`, `unlinkTemplateFromAction`, `setDefaultTemplate`, `getTemplatesForAction`, `getActionsForTemplate` |
| `email-logs.ts` | CRUD de `email_logs` |
| `email-render.ts` | `renderEmailTemplate(template, data)` + `extractPlaceholders(text)` + soporte HTML |
| `email-sender.ts` | Envío real vía proveedor; guarda en `email_logs` |
| `email-actions.ts` | `getAvailableEmailTemplates(action)` (vía junction) y `sendEmailFromAction(...)` |
| `claim-actions.ts` | `autoIssueAndEmail(actionId)` |

### 7.1 `email-sender.ts`
Proveedor configurable:
```
EMAIL_PROVIDER=sendgrid|resend|smtp
EMAIL_FROM=...
SENDGRID_API_KEY=...
RESEND_API_KEY=...
SMTP_HOST=... SMTP_PORT=... SMTP_USER=... SMTP_PASS=...
```
Retorna `{ status, provider_response }` para `email_logs`.

---

## 8. Permisos
Sección: `catalogos_gestiones_email_templates`.

| Permiso | Quién lo tiene |
|---------|----------------|
| `view` | Perfiles operativos y administradores |
| `create/edit` | Administradores / configuradores de catálogos |
| `delete` | Administradores (soft delete) |

Para envío desde acción: permiso `edit` sobre la acción o `operaciones`.

---

## 9. Migraciones

### 9.1 Migración 234 — Junction + formato HTML + migración de vínculos existentes

`migrations/234_email_templates_junction_and_html.sql`:

1. **Crear** `email_template_actions` (junction) con PK, FKs, unique parcial
   `(action_template_id, business_line_id) WHERE is_default = true`.
2. **Migrar vínculos existentes**: `INSERT INTO email_template_actions
   (email_template_id, action_template_id, is_default, created_by)
   SELECT id, action_template_id, true, created_by FROM email_templates
   WHERE action_template_id IS NOT NULL;` — preserva todos los vínculos existentes
   marcándolos como default (no se pierde nada).
3. **Agregar columnas** a `email_templates`:
   - `description TEXT`
   - `body_format TEXT NOT NULL DEFAULT 'plain'`
   - `logo_url TEXT`
   - `header_color TEXT`
4. **Hacer nullable** `email_templates.action_template_id` (para que las nuevas
   plantillas se puedan crear sin acción). **NO se dropea** — se conserva como
   columna obsoleta (REGLA #1). El código nuevo ignora esta columna y usa la junction.
5. **Agregar** `email_logs.body_format TEXT NOT NULL DEFAULT 'plain'`.
6. Índices y RLS sobre la junction.

### 9.2 Migración 235 — RLS junction
`migrations/235_email_template_actions_rls.sql`:
- `ALTER TABLE email_template_actions ENABLE ROW LEVEL SECURITY;`
- Políticas usando `is_tenant_allowed((SELECT company_id FROM email_templates WHERE id = email_template_id))`.

### 9.3 Pendiente (futuro, con autorización explícita)
- Drop de `email_templates.action_template_id` — **solo cuando se confirme que ningún
  código la usa y con autorización explícita** (REGLA #1).

---

## 10. Fases de Implementación

### Fase 1 — Base de datos
- [ ] ⏳ Migración 234: junction + columnas HTML + migración de vínculos existentes
- [ ] ⏳ Migración 235: RLS junction
- [ ] ⏳ Actualizar `email-templates.ts` (quitar `action_template_id` obligatorio)
- [ ] ⏳ Nuevo `email-template-actions.ts`
- [ ] ⏳ `email-render.ts`: soporte HTML

### Fase 2 — Catálogo de plantillas (grilla + editor)
- [ ] ⏳ Grilla `/dashboard/catalogos/gestiones/email-templates` (grilla primero)
- [ ] ⏳ Editor `/new` y `/[id]` con layout 2 columnas
- [ ] ⏳ Insertor de campos lateral (click-to-insert + drag-and-drop)
- [ ] ⏳ Toggle plain/html + editor rich-text (Tiptap) para HTML
- [ ] ⏳ Preview en vivo
- [ ] ⏳ Menú lateral en `gestionCatalogLinks`

### Fase 3 — Vinculación desde ficha de gestión
- [ ] ⏳ Card `EmailTemplatesCard` en ficha de `action_template` (espejo de `DocumentTemplatesCard`)
- [ ] ⏳ Modal de vinculación con multi-select filtrado por `business_line_id`
- [ ] ⏳ Marcar/desmarcar `is_default`
- [ ] ⏳ Switches `auto_complete` / `auto_email` con validación de plantilla por defecto obligatoria

### Fase 4 — Envío manual desde acción
- [ ] ⏳ Botón `E-mail` en `DynamicScreen` / detalle de acción
- [ ] ⏳ `SendEmailDrawer` con selección, preview, destinatarios
- [ ] ⏳ `email-sender.ts` con proveedor configurable
- [ ] ⏳ Guardado en `email_logs`
- [ ] ⏳ Historial de e-mails en la acción

### Fase 5 — Envío automático
- [ ] ⏳ `autoIssueAndEmail(actionId)` usando `is_default` de la junction
- [ ] ⏳ Integrar en workflow trigger `execute_workflow_on_status_change`
- [ ] ⏳ Marcar acciones como emitidas por sistema

### Fase 6 — Refinamientos
- [ ] ⏳ Adjuntos en e-mails
- [ ] ⏳ Plantillas por compañía de seguros / evento / país
- [ ] ⏳ Reintentos desde `email_logs.status = 'failed'`

---

## 11. Notas y decisiones

1. **Proveedor de e-mail**: comenzar con **Resend** o **SendGrid**. SMTP como fallback.
2. **Rich text**: Tiptap para HTML. Body plain sigue siendo textarea mono-fuente.
3. **Imágenes/logos**: se suben a Supabase Storage y se embeben por URL en HTML.
4. **Plantillas por idioma**: no incluido en MVP. Una plantilla por `business_line` + acción.
5. **Reintentos**: `email_logs.status = 'failed'` permite reintentar manualmente.
6. **Datos de prueba para preview**: objeto estático + `claim` de ejemplo.
7. **`action_template_id` obsoleta**: la columna vieja se conserva hasta Fase 6+ con
   autorización explícita para dropear (REGLA #1).

---

## 12. Relación con Documentos Office

Mismo concepto de placeholders y mapeo que `document_templates`. Diferencias:
- **Documentos Office**: requiere `.docx`/`.xlsx`/`.pptx`, renderiza binario.
- **E-mail**: no requiere archivo; cuerpo es texto/HTML con placeholders, se envía vía API.
- **Vinculación**: documentos Office son 1:N (una plantilla → una acción, varias plantillas
  por acción). E-mail es **N:M** (una plantilla → varias acciones, una acción → varias
  plantillas) vía junction, porque las plantillas de e-mail son más reutilizables.

---

## 13. Checklist de aceptación (definición de "hecho")

- [ ] Puedo crear una plantilla **sin** vincular acción y el botón Crear se habilita.
- [ ] La grilla se ve primero, sin formulario arriba.
- [ ] Puedo vincular una misma plantilla a varias gestiones desde la ficha de cada gestión.
- [ ] Puedo marcar una plantilla como por defecto por acción+línea.
- [ ] Si `auto_email = true`, no puedo guardar sin plantilla por defecto.
- [ ] Puedo insertar placeholders con click o drag-and-drop desde el panel lateral.
- [ ] Puedo elegir formato plain o HTML; HTML soporta logo, imágenes, estilos.
- [ ] Los vínculos existentes (los que ya tenían `action_template_id`) siguen funcionando.
- [ ] `npx tsc --noEmit` y `npx eslint` retornan 0 errores y 0 warnings.
