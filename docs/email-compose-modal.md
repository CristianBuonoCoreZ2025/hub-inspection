# EmailComposeModal — Compositor de Correos

> Modal para redactar y enviar correos desde cualquier gestión del sistema.
> Modelo Outlook 365: Enviar en la fila Para, campos Para/CC/CCO/Asunto, body abajo.
> Pensado para un usuario experto en liquidación, no informático.

## Ubicación

```
src/components/claims/email-compose-modal.tsx
API:     src/app/api/email/send/route.ts
Preview: src/app/api/email/preview/route.ts
```

## API

### Props

```typescript
interface EmailComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: Record<string, unknown> | null;
  action: {
    id: string;
    company_id: string;
    claim_id: string;
    action_template_id: string;
    action_data?: Record<string, unknown> | null;
  };
  businessLineId?: string | null;
}
```

### Uso básico

```tsx
"use client";
import { useState } from "react";
import { EmailComposeModal } from "@/components/claims/email-compose-modal";

function MiComponente() {
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <>
      <button onClick={() => setComposeOpen(true)}>
        Redactar correo
      </button>

      <EmailComposeModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        claim={claim}
        action={action}
        businessLineId={claim?.business_line_id}
      />
    </>
  );
}
```

## Layout — Modelo Outlook 365

```
┌─────────────────────────────────────────────────────────────────┐
│  DIALOGCONTENT (modal-xl)                                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  HEADER — info de gestión que origina el correo           │   │
│  │  [✉️] COB-001                              [Historial][X]│   │
│  │  32px  13px semibold                                    28px│   │
│  │       Siniestro L-... · Gestión que origina este correo   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CAMPOS DE DESTINATARIO                                   │   │
│  │  [✈ Enviar 15%] Para: [escribe nombre...] [👥] CC/CCO   │   │
│  │                  CC:  [...]                  [👥]         │   │
│  │                  CCO: [...]                  [👥]         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ASUNTO (integrado al body, jerarquía mayor)              │   │
│  │  Asunto del correo aquí                                    │   │
│  │  15px font-semibold                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  TOOLBAR del HtmlEditor (Bold, tablas, colores, etc.)     │   │
│  │  [B][I][U][S] [Fuente▼] [Size▼] | [Color][Highlight] |   │   │
│  │  [Align] [List] [Link] [Image] [Table] [Indent]           │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                            │   │
│  │  BODY DEL CORREO (ocupa todo el espacio restante)         │   │
│  │                                                            │   │
│  │  Estimado Franco Buono,                                    │   │
│  │                                                            │   │
│  │  Le informamos que su siniestro L-000000141...            │   │
│  │                                                            │   │
│  │  (scroll si el contenido es largo)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MODAL DE PLANTILLAS (overlay, se abre al hacer clic en el link)   │   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │ [📄] Seleccionar Plantilla                     [X] │   │   │
│  │  ├────────────────────────────────────────────────────┤   │   │
│  │  │ [📄] Notificación SOL                  [default]   │   │   │
│  │  │ [📄] Solicitud de antecedentes                     │   │   │
│  │  │ [📄] Reserva aprobada                              │   │   │
│  │  ├────────────────────────────────────────────────────┤   │   │
│  │  │                                          [Cancelar]│   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Reglas de diseño

- **Sin clases CSS custom paralelas** — todo inline Tailwind, mismo patrón que el `EmailPreviewModal`
- **Botones**: `pg-btn-platinum` (regla del design system)
- **Inputs**: `app-input h-7` para selects
- **Modal**: `modal-xl`, `dismissible={false}`, `showCloseButton={false}`
- **Tipografía**: 13/12/11/10px según jerarquía (regla global)
- **Sin vista código HTML** — el usuario final nunca ve HTML crudo

## Header — Info de Gestión

El header muestra **la gestión que originó este correo**, no un título genérico:

| Elemento | Estilo |
|----------|--------|
| Icono | `h-8 w-8 rounded-lg`, gradient `linear-gradient(135deg, #6366f1, #a855f7)` |
| Título | Código de gestión (ej: `COB-001`) — `text-[13px] font-semibold` |
| Subtítulo | `Siniestro L-... · Gestión que origina este correo` — `text-[10px] text-muted-foreground` |
| Historial | Toggle a la derecha, abre/cierra panel colapsable |
| Cerrar | `h-7 w-7 rounded-lg border-border` a la derecha |

### Historial (colapsable)
Al activar el toggle Historial, se muestra un panel con los envíos anteriores:
- `EML-001: {subject}` + destinatarios + fecha + status badge
- Status: `sent` (verde), `queued` (ámbar), `failed` (rojo)

## Campos de Destinatario

```
[Enviar 15%] Para: [escribe nombre...] [�]   CC/CCO  Plantilla
              CC:  [...]                      [👥]
              CCO: [...]                      [👥]
```

### Botón Enviar
- **Posición**: inicio de la fila Para, ocupando **15% del ancho** de la sección
- **Clase**: `pg-btn-platinum`
- **Disabled** cuando: no hay destinatarios, no hay asunto, no hay body, o está enviando
- **Icono**: `Send` (o `Loader2` spin mientras envía)
- Las filas CC y BCC se alinean con el input de Para (offset por el ancho del botón)

### Estructura de campos
- **Label**: `w-10 text-muted-foreground font-medium`
- **Input**: `bg-transparent border-0 outline-none text-[12px]`
- **CC/CCO**: colapsables — link "CC / CCO" los muestra/ocupa

### Toggle Plantilla
- **Solo aparece** si la gestión tiene plantillas vinculadas
- Es un link pequeño al lado de "CC / CCO", mismo estilo (`text-[10px] text-primary hover:underline`)
- **`Plantilla`** aparece cuando hay plantillas y ninguna seleccionada
- **Click** → abre el **Modal de Plantillas** (ver abajo)
- **`Quitar plantilla`** aparece cuando una plantilla está activa → la desactiva

### Botón Libreta de Contactos [👥]

Cada campo (Para, CC, BCC) tiene un botón **[👥]** (icono `Users`) que abre un **popover** con la libreta completa del siniestro:

```
┌──────────────────────────────────────────┐
│  Libreta de contactos                     │
├──────────────────────────────────────────┤
│  PARTICIPANTES                            │
│  [FB] Franco Buono                        │
│       franco@...                          │
│       [Asegurado] [Beneficiario]          │
│  [CB] Cristian Buono                      │
│       cristian@...                        │
│       [Propietario]                       │
├──────────────────────────────────────────┤
│  EQUIPO                                   │
│  [AB] Ana Buono                           │
│       ana@...                             │
│       [Liquidador]                        │
├──────────────────────────────────────────┤
│  ASESOR                                   │
│  [JB] José Buono                          │
│       jose@...                            │
│       [Asesor]                            │
├──────────────────────────────────────────┤
│  DIRECTORIO                               │
│  [MB] María Buono                         │
│       maria@...                           │
│       [Interno]                           │
└──────────────────────────────────────────┘
```

**Agrupación por origen**:

| Grupo | Origen | Contenido |
|-------|--------|-----------|
| Participantes | `claims_participants` + `claim.owner_email` | Asegurado, Beneficiario, Contratista, etc. |
| Equipo | `claims.*_id` → `profiles` | Liquidador, Inspector, Asistente, etc. |
| Asesor | `claims.advisor_id` → `advisors` | Asesor comercial |
| Directorio | `profiles` (global) | Todos los usuarios del sistema |

**Cada contacto muestra**:
- Avatar con iniciales (gradient indigo→purple, 24×24px)
- Nombre completo (o email si no tiene nombre)
- Email en monospace debajo del nombre
- Badges de rol (hasta 2) — color `primary` si es interno, `muted` si es externo

**Click en un contacto** → agrega su email al campo correspondiente (Para/CC/BCC), con deduplicación (no agrega si ya está).

### Autocomplete (escribir en el campo)

Además del botón [👥], al escribir en Para/CC/CCO aparece un dropdown con sugerencias filtradas:

```
┌──────────────────────────────────────────┐
│  [CB] Cristian Buono                     │
│       cristian@...                       │
│       [Asegurado] [Beneficiario]         │
├──────────────────────────────────────────┤
│  [FB] Franco Buono                       │
│       franco@...                         │
│       [Liquidador]                       │
└──────────────────────────────────────────┘
```

**Filtrado**: por nombre, email o rol (case-insensitive, mínimo 1 carácter)
**Selección**: click en una sugerencia → agrega el email al campo actual (separado por coma)

### Dos formas de elegir contactos
1. **Escribir** en el campo → autocomplete con sugerencias filtradas
2. **Click [👥]** → navegar la libreta completa agrupada

## Modal de Plantillas

Al hacer clic en el link "Plantilla" se abre un modal (`modal-md`) con la lista de plantillas vinculadas a la gestión:

```
┌────────────────────────────────────────────────────┐
│  [📄] Seleccionar Plantilla                    [X] │
├────────────────────────────────────────────────────┤
│  [📄] Notificación SOL                  [default]  │
│       Notificación y solicitud de antecedentes     │
│                                                     │
│  [📄] Solicitud de antecedentes                    │
│       Solicita documentación al asegurado           │
│                                                     │
│  [📄] Reserva aprobada                             │
│       Notifica aprobación de reserva                │
├────────────────────────────────────────────────────┤
│                                         [Cancelar] │
└────────────────────────────────────────────────────┘
```

**Cada plantilla muestra**:
- Icono `FileText`
- Nombre (`text-[12px] font-medium`)
- Descripción (`text-[10px] text-muted-foreground`) si existe
- Badge `default` si es la plantilla default de la gestión
- Badge `seleccionada` si ya está seleccionada

**Al seleccionar**:
1. Cambia a modo plantilla
2. Renderiza subject + body con datos del siniestro (`/api/email/preview`)
3. Cierra el modal
4. Subject y body son completamente editables

**Si no hay plantillas vinculadas**, el link "Plantilla" no aparece — todo es escritura libre.

## Asunto — Integrado al Body

El Asunto NO está en la sección de destinatarios — está **integrado al body** como parte del correo, con jerarquía visual mayor:

| Propiedad | Valor |
|-----------|-------|
| Font-size | `15px` |
| Font-weight | `semibold` |
| Padding | `px-4 py-2.5` |
| Separator | `border-b border-border/40` |
| Placeholder | "Asunto" |

Esto crea la sensación de que el Asunto es parte del correo (no un campo más) pero visualmente se distingue del body.

## Body — Editor

### HTML (rich text)
Usa el componente `HtmlEditor` (TipTap) — **el mismo** que el configurador de plantillas:

| Capacidad | Disponible |
|-----------|-----------|
| Bold, Italic, Underline, Strikethrough | ✓ |
| Tablas (insertar, filas, columnas) | ✓ |
| Listas ordenadas/no ordenadas | ✓ |
| Font family, font size | ✓ |
| Text colors, highlight | ✓ |
| Alineación (izq, centro, der, justificado) | ✓ |
| Indent/Outdent (Tab/Shift+Tab) | ✓ |
| Links, imágenes | ✓ |
| Subscript, Superscript | ✓ |
| Undo/Redo | ✓ |

**Prop `showCodeView={false}`**: oculta los botones Eye/Code2 (vista HTML crudo). El usuario final nunca ve código.

### Texto plano
Si la plantilla es texto plano, se muestra un textarea simple (`text-sm leading-relaxed`, sin `font-mono`).

### Preservación de formato de plantilla
Cuando se carga una plantilla HTML, el editor preserva todos los estilos:
- Las extensiones `FontFamily`, `FontSize`, `Color`, `TextStyle`, `Highlight`, `TextAlign` de TipTap parsean y mantienen los estilos inline del HTML
- El `renderEmailTemplate()` solo reemplaza placeholders — no toca el HTML
- TipTap `setContent()` preserva los estilos que sus extensiones soportan

### Ocupación de espacio
- El editor tiene `flex-1 flex flex-col min-h-0`
- `.html-editor-wrap` en `globals.css` tiene `flex:1 + overflow-y:auto + min-height:0`
- La toolbar queda fija arriba, el content area crece y hace scroll

## Modos de Composición

### Con Plantilla
1. Usuario hace clic en el link "Plantilla"
2. Se abre el modal de plantillas
3. Selecciona una plantilla
4. Backend renderiza subject + body con datos del siniestro (`/api/email/preview`)
5. Subject y body son **completamente editables**
6. El formato (html/plain) lo define la plantilla — no cambiable
7. Al enviar, se guarda la versión original Y la final (auditoría)
8. Link cambia a "Quitar plantilla" — al hacer clic, desactiva la plantilla

### Sin Plantilla (escritura libre)
1. Link "Plantilla" no aparece (no hay plantillas) o no se usa
2. El editor arranca en modo HTML (rich text) automáticamente
3. El usuario escribe subject y body desde cero
4. No hay concepto de "modo manual" — simplemente escribe
5. **Sin toggle Texto/HTML** — el usuario no elige formato

## Auditoría de Plantilla (Migración 263)

Cuando se envía un correo con plantilla, `email_logs` guarda ambas versiones:

| Columna | Descripción |
|---------|-------------|
| `template_subject` | Asunto original renderizado (NULL si sin plantilla) |
| `template_body` | Body original renderizado (NULL si sin plantilla) |
| `template_body_format` | Formato original: plain o html (NULL si sin plantilla) |
| `was_modified` | TRUE si el usuario editó subject o body |

### Lógica del send API
```
Modo Plantilla (sin editar):
  → emailTemplateId = "xxx"
  → backend renderiza → guarda template_* = render, final = render, was_modified = false

Modo Plantilla (editado):
  → emailTemplateId = "xxx" + manualSubject + manualBody
  → backend renderiza plantilla (template_*) + usa manual como final
  → guarda template_* = original, final = editado, was_modified = true

Sin Plantilla:
  → sin emailTemplateId + manualSubject + manualBody
  → guarda template_* = NULL, final = manual, was_modified = false
```

Esto permite responder: "la plantilla dijo *Estimado Franco*, pero tú lo cambiaste a *Estimado Sr. Buono*".

## Envío

### API
```
POST /api/email/send
{
  claimActionId: string,
  emailTemplateId?: string,      // solo si hay plantilla
  to: string[],
  cc?: string[],
  bcc?: string[],
  manualSubject?: string,        // versión final (si editó plantilla o sin plantilla)
  manualBody?: string,
  manualBodyFormat?: "plain" | "html",
  templateSubject?: string,      // versión original (auditoría)
  templateBody?: string,
  templateBodyFormat?: "plain" | "html"
}
```

### Respuesta
```json
{
  "success": true,
  "log": { "id": "...", "correlativo": 42 },
  "result": { "status": "sent", "provider_response": "..." }
}
```

### Validaciones
- `to` no puede estar vacío
- `subject` no puede estar vacío
- `body` no puede estar vacío
- En modo plantilla: la plantilla debe estar activa y vinculada a la gestión
- En modo plantilla: debe pertenecer al mismo tenant (company_id)

### Post-envío
- Invalida queries `email-logs-by-claim` y `email-logs`
- Limpia campos (to, cc, bcc, subject, body)
- Cierra el modal
- Toast de éxito

## Componente ContactBookButton

Componente interno (no exportado) que renderiza el botón [👥] + popover de libreta.

```typescript
function ContactBookButton({
  contacts: EmailContact[],
  onPick: (email: string) => void,
}): JSX.Element
```

- Usa `Popover` de `@/components/ui/popover` (base-ui, z-9999, positionMethod fixed)
- Agrupa contactos por `group` (participants, team, advisor, global)
- Headers de grupo sticky dentro del popover
- No se renderiza si `contacts.length === 0`

## Dependencias

| Componente | Ubicación |
|-----------|-----------|
| `HtmlEditor` | `@/components/ui/html-editor` (TipTap) |
| `Popover` | `@/components/ui/popover` (base-ui) |
| `Dialog` | `@/components/ui/dialog` |
| `Button` | `@/components/ui/button` |
| `EmailContactBook` | `@/components/claims/email-contact-book` (reusable, no renderizado aquí) |
| `getEmailTemplatesForAction` | `@/services/email-template-actions` |
| `fetchClaimContacts` | `@/services/email-contacts` |
| `renderEmailTemplate` | `@/services/email-render` |
| `wrapHtmlEmail` | `@/services/email-render` |
| `sendEmail` | `@/services/email-sender` |
| `buildDocumentDataForClaim` | `@/services/document-data` |
| `buildTemplateData` | `@/lib/document-fields` |

## Filosofía de UX

Este componente está diseñado para un **experto en liquidación de siniestros**, no un informático:

- **Sin conceptos técnicos**: no hay "HTML", "texto plano", "modo manual", "vista código"
- **Sin decisiones de formato**: el formato lo define la plantilla, o por defecto es rich text
- **Dos formas de elegir contactos**: escribir (autocomplete) o botón [👥] (libreta completa)
- **Plantillas como modal**: link pequeño como CC/CCO, abre modal al hacer clic
- **Body ocupa todo**: el editor llena el espacio disponible, como Outlook/Mail
- **Asunto integrado**: parte del correo, no un campo más — pero jerarquizado visualmente
- **Enviar en la fila Para**: como Outlook 365, al inicio de la fila de destinatarios
- **Info de gestión en header**: el correo sabe de dónde viene (código de gestión + siniestro)
