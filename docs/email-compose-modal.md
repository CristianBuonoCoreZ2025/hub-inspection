# EmailComposeModal — Compositor de Correos

> Modal para redactar y enviar correos desde cualquier gestión del sistema.
> Modelo Outlook 365: toolbar arriba, campos Para/CC/CCO/Asunto, body abajo.
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
│  │  HEADER compacto                                          │   │
│  │  [✉️] Correo                        Gestión: COB-001  [X] │   │
│  │  32px  13px semibold                10px muted        28px│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ACTION BAR                                               │   │
│  │  [✈ Enviar]  |  [📄 Plantilla] [Plantilla ▼]   [Historial]│   │
│  │   platinum      toggle      dropdown          toggle      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CAMPOS DE DESTINATARIO                                   │   │
│  │  Para:    [escribí un nombre → autocomplete ↓]   CC/CCO  │   │
│  │  CC:      [...]                                           │   │
│  │  CCO:     [...]                                           │   │
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
└─────────────────────────────────────────────────────────────────┘
```

### Reglas de diseño

- **Sin clases CSS custom paralelas** — todo inline Tailwind, mismo patrón que el `EmailPreviewModal`
- **Botones**: `pg-btn-platinum` (regla del design system)
- **Inputs**: `app-input h-7` para selects
- **Modal**: `modal-xl`, `dismissible={false}`, `showCloseButton={false}`
- **Tipografía**: 13/12/11/10px según jerarquía (regla global)
- **Sin vista código HTML** — el usuario final nunca ve HTML crudo

## Header compacto

| Elemento | Estilo |
|----------|--------|
| Icono | `h-8 w-8 rounded-lg`, gradient `linear-gradient(135deg, #6366f1, #a855f7)` |
| Título | "Correo" — `text-[13px] font-semibold` |
| Subtítulo | `Gestión: {codigo}` — `text-[10px] text-muted-foreground` (solo si existe) |
| Botón cerrar | `h-7 w-7 rounded-lg border-border` |

## Action Bar

```
[Enviar]  |  [📄 Plantilla] [Plantilla ▼]    [Historial]
```

### Botón Enviar
- **Posición**: izquierda (como Outlook 365)
- **Clase**: `pg-btn-platinum`
- **Disabled** cuando: no hay destinatarios, no hay asunto, no hay body, o está enviando
- **Icono**: `Send` (o `Loader2` spin mientras envía)

### Toggle Plantilla
- **Solo aparece** si la gestión tiene plantillas vinculadas
- **Activado** (azul/primary): muestra el dropdown de plantillas al lado
- **Desactivado** (gris/muted): oculta el dropdown, el usuario escribe libre
- Si no hay plantillas vinculadas, el toggle no aparece — todo es escritura libre

### Dropdown de Plantillas
- **Solo visible** cuando Plantilla está activado
- **Clase**: `app-input h-7 w-50`
- Lista las plantillas activas vinculadas a la gestión
- Marca la default con "· default"
- Al seleccionar, el backend renderiza subject + body con datos del siniestro

### Botón Historial
- **Posición**: derecha
- Toggle colapsable que muestra los envíos anteriores de esta gestión
- Cada item: `EML-001: {subject}` + destinatarios + fecha + status badge

## Campos de Destinatario

```
Para:    [escribí un nombre → autocomplete ↓]   CC/CCO
CC:      [...]
CCO:     [...]
```

### Estructura
- **Label**: `w-10 text-muted-foreground font-medium`
- **Input**: `bg-transparent border-0 outline-none text-[12px]`
- **CC/CCO**: colapsables — botón "CC / CCO" los muestra/oculta

### Autocomplete de Libreta de Contactos

Al escribir en Para/CC/CCO, aparece un dropdown con contactos que coinciden:

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

**Fuentes de contactos** (servicio `email-contacts.ts`):
- Participantes del siniestro (claims_participants + owner_email)
- Equipo del siniestro (claims.*_id → profiles)
- Asesor (claims.advisor_id → advisors)
- Directorio global (profiles)

**Deduplicación**: si Asegurado y Beneficiario comparten email, se muestra un solo contacto con ambos roles.

**Filtrado**: por nombre, email o rol (case-insensitive, mínimo 1 carácter)

**Selección**: click en una sugerencia → agrega el email al campo actual (separado por coma)

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
1. Usuario activa toggle "Plantilla"
2. Selecciona una plantilla del dropdown
3. Backend renderiza subject + body con datos del siniestro (`/api/email/preview`)
4. Subject y body son **completamente editables**
5. El formato (html/plain) lo define la plantilla — no cambiable
6. Al enviar, se guarda la versión original Y la final (auditoría)

### Sin Plantilla (escritura libre)
1. Toggle "Plantilla" desactivado (o no existe)
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

## Dependencias

| Componente | Ubicación |
|-----------|-----------|
| `HtmlEditor` | `@/components/ui/html-editor` (TipTap) |
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
- **Autocomplete natural**: escribir un nombre en "Para" sugiere contactos — como Outlook
- **Plantillas solo si existen**: si la gestión no tiene plantillas, el toggle no aparece
- **Body ocupa todo**: el editor llena el espacio disponible, como Outlook/Mail
- **Asunto integrado**: parte del correo, no un campo más — pero jerarquizado visualmente
- **Enviar arriba**: como Outlook 365, no abajo a la derecha
