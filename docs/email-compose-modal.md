# EmailComposeModal — Compositor de Correos Reutilizable

> Componente modal para redactar y enviar correos desde cualquier gestión del sistema.
> Incluye plantillas, sugerencia de destinatarios, preview en vivo, y envío con correlativo automático.

## Ubicación

```
src/components/claims/email-compose-modal.tsx
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

## Estructura visual

```
┌──────────────────────────────────────────────────────────────────────┐
│  DIALOGCONTENT (modal-xl)                                             │
│  ├─ Ancho: min(98vw, 1100px)                                          │
│  ├─ Alto máximo: 92vh                                                 │
│  ├─ border-radius: 18px                                               │
│  ├─ border: 1px solid color-mix(var(--border) 40%, transparent)       │
│  ├─ background: color-mix(var(--card) 85%, transparent)               │
│  ├─ backdrop-filter: blur(20px) saturate(140%)                        │
│  └─ box-shadow: 0 26px 55px rgba(2,12,27,0.25)                        │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  HEADER (p-4)                                                   │  │
│  │  ├─ border-bottom: 1px solid var(--border)                      │  │
│  │  ├─ background: var(--background)                               │  │
│  │  │                                                              │  │
│  │  │  [✉️]  Enviar Correo (14px semibold)                         │  │
│  │  │  40px  Gestión: L-000000141-HCIN-004 (10px)                 │  │
│  │  │  grad   Componer y enviar email (10px mono)                 │  │
│  │  │                                                              │  │
│  │  │                                              [X] (32x32)     │  │
│  │  └──────────────────────────────────────────────────────────────┘  │
│  │                                                                      │
│  ┌──────────────────────┬───────────────────────────────────────────┐  │
│  │  COMPOSICIÓN (420px) │  PREVIEW EN VIVO (resto)                   │  │
│  │  ├─ border-r          │  ├─ background: muted 12%                  │  │
│  │  ├─ background: muted │  │                                          │  │
│  │  │   8%               │  ├─ Preview bar                             │  │
│  │  │                    │  │  ├─ [Eye] Vista Previa                   │  │
│  │  ├─ [Plantilla|A mano]│  │  └─ [HTML/Texto] badge                  │  │
│  │  ├─ Plantilla select  │  │                                          │  │
│  │  ├─ Sugeridos (chips) │  ├─ Preview body (scroll)                  │  │
│  │  ├─ Para              │  │  ┌──────────────────────────────┐       │  │
│  │  ├─ CC / CCO          │  │  │  Tarjeta blanca (600px max)  │       │  │
│  │  ├─ Asunto            │  │  │  ├─ iframe HTML o            │       │  │
│  │  ├─ Cuerpo            │  │  │  │  texto plano               │       │  │
│  │  │  ├─ Texto/HTML     │  │  │  └─ min-height: 70vh         │       │  │
│  │  │  └─ Textarea       │  │  └──────────────────────────────┘       │  │
│  │  ├─ Historial         │  │                                          │  │
│  │  │  ├─ EML-001: ...   │  │                                          │  │
│  │  │  └─ EML-002: ...   │  │                                          │  │
│  │  └─ (scroll)          │  └─ (scroll)                                │  │
│  └──────────────────────┴───────────────────────────────────────────┘  │
│  │                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  FOOTER                                                         │  │
│  │  ├─ border-top: 1px solid var(--border)                         │  │
│  │  ├─ background: var(--background) 60% + blur(8px)               │  │
│  │  │                                                              │  │
│  │  │              [Cancelar]  [✈ Enviar]                          │  │
│  │  │               platinum    gradient primary                   │  │
│  │  └──────────────────────────────────────────────────────────────┘  │
│  └──────────────────────────────────────────────────────────────────────┘
```

## Header — 3 filas (igual que preview)

| Fila | Contenido | Clase | Estilo |
|------|-----------|-------|--------|
| 1 | "Enviar Correo" | `.app-compose-title` | 14px semibold |
| 2 | `Gestión: {codigo}` | `.app-compose-subtitle` | 10px muted (solo si existe) |
| 3 | "Componer y enviar email" | `.app-compose-subtitle-mono` | 10px mono muted |

### Ícono del header
- Clase: `.app-compose-header-icon`
- Tamaño: 40×40px
- Border-radius: 12px
- Background: `linear-gradient(135deg, #6366f1, #a855f7)`
- Box-shadow: `0 2px 8px -2px rgb(99 102 241 / 0.5)`

## Dos modos de composición

### Modo Plantilla
- Selecciona una plantilla vinculada a la gestión
- El backend renderiza subject + body con datos reales del siniestro
- El resultado es editable (subject y body)
- Si el usuario edita, se envía como manual (sin re-renderizar la plantilla)

### Modo Manual
- El usuario escribe subject y body desde cero
- Toggle de formato: Texto plano / HTML
- En modo HTML, se puede editar el código fuente directamente

## Destinatarios sugeridos

Chips liquid glass con un click para agregar al campo "Para":

| Origen | Label |
|--------|-------|
| `claim.owner_email` | Propietario |
| `claim.adjuster_id` | Liquidador |
| `claim.assigned_adjuster_id` | Liq. Asignado |
| `claim.inspector_id` | Inspector |
| `claim.assistant_id` | Asistente |
| `claim.dispatcher_id` | Despachador |
| `claims_participants` | Asegurado, Contratista, Beneficiario, Ejecutivo, Contacto |

### Estilo de chips
- Clase: `.app-compose-chip`
- Liquid glass: `color-mix(var(--card) 60%, transparent)` + `blur(8px)`
- Border: `color-mix(var(--border) 40%, transparent)`
- Hover: border primary, fondo primary 10%, color primary

## Preview en vivo

### Barra superior
- Clase: `.app-compose-preview-bar`
- Ícono `Eye` + "Vista Previa" (11px medium)
- Badge de formato: "HTML" o "Texto plano" (10px)

### Body del preview
- Clase: `.app-compose-preview-body`
- Scroll independiente
- HTML: tarjeta blanca (`max-width: 600px`) con iframe
- Texto: tarjeta con borde, `whitespace-pre-wrap`

### Tarjeta del preview
- Clase: `.app-compose-preview-card`
- `border-radius: 12px` + `overflow: hidden`
- `box-shadow: 0 4px 20px rgb(0 0 0 / 0.06)`
- `max-width: 600px` + `margin: 0 auto`
- Dark mode: `color-mix(var(--card) 92%, transparent)`

## Footer

| Botón | Clase | Estilo |
|-------|-------|--------|
| Cancelar | `pg-btn-platinum` | Platinum estándar |
| Enviar | `.app-compose-btn-primary` | Gradiente primary, glow, hover lift |

### Botón Enviar
- Gradiente: `linear-gradient(135deg, #6366f1, #a855f7)`
- Box-shadow: `0 2px 8px -2px rgb(99 102 241 / 0.4)`
- Hover: shadow más fuerte + `translateY(-1px)`
- Disabled: `opacity-50`, sin shadow, sin lift
- Loading: spinner `Loader2` animado

## Historial de envíos

Lista compacta de correos ya enviados desde esta gestión:

| Elemento | Clase | Estilo |
|----------|-------|--------|
| Contenedor | `.app-compose-history` | max-h 160px, scroll, border |
| Item | `.app-compose-history-item` | 11px, border-b |
| Status sent | `.app-compose-history-status-sent` | emerald |
| Status queued | `.app-compose-history-status-queued` | amber |
| Status error | `.app-compose-history-status-error` | rose |

## Clases CSS

### components.css — clases del compose

| Clase | Función |
|-------|---------|
| `.app-compose-header` | Header del modal (3 filas) |
| `.app-compose-header-icon` | Ícono gradiente (40×40) |
| `.app-compose-title` | Título "Enviar Correo" (14px) |
| `.app-compose-subtitle` | Gestión (10px) |
| `.app-compose-subtitle-mono` | Subtítulo mono (10px) |
| `.app-compose-btn` | Botones del header (liquid glass) |
| `.app-compose-btn-primary` | Botón Enviar (gradiente primary) |
| `.app-compose-tabs` | Contenedor de tabs |
| `.app-compose-tab` | Tab individual (Plantilla/A mano) |
| `.app-compose-chip` | Chip de destinatario sugerido |
| `.app-compose-label` | Label de campo (11px) |
| `.app-compose-panel-left` | Panel izquierdo (composición) |
| `.app-compose-panel-right` | Panel derecho (preview) |
| `.app-compose-preview-bar` | Barra del preview |
| `.app-compose-preview-title` | Título del preview |
| `.app-compose-preview-badge` | Badge de formato |
| `.app-compose-preview-body` | Body del preview (scroll) |
| `.app-compose-preview-card` | Tarjeta blanca del preview |
| `.app-compose-preview-text` | Tarjeta de texto plano |
| `.app-compose-footer` | Footer del modal |
| `.app-compose-history` | Lista de historial |
| `.app-compose-history-item` | Item del historial |
| `.app-compose-history-status-*` | Badges de estado (sent/queued/error) |
| `.app-compose-format-toggle` | Toggle Texto/HTML |
| `.app-compose-format-btn` | Botón del toggle |
| `.app-compose-loading` | Estado de carga |

## Dependencias

### Componentes
- `Dialog`, `DialogContent`, `DialogTitle` — `@/components/ui/dialog`
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` — `@/components/ui/select`
- `Input`, `Textarea`, `Label`, `Button` — shadcn/ui
- `wrapHtmlEmail` — `@/services/email-render`
- `getEmailTemplatesForAction` — `@/services/email-template-actions`
- `getSupabaseClient` — `@/lib/supabase/db`

### Íconos (lucide-react)
- `Mail` — ícono del header
- `Send` — botón enviar
- `X` — cerrar / cancelar
- `Plus` — agregar destinatario
- `History` — ver historial
- `FileText` — modo plantilla / texto plano
- `Code2` — modo HTML
- `Eye` — vista previa
- `Sparkles` — modo manual
- `Loader2` — loading state

### Servicios backend
- `POST /api/email/preview` — renderiza plantilla con datos del siniestro
- `POST /api/email/send` — envía el correo y guarda en `email_logs`

## Flujo de envío

```
1. Usuario abre modal
   ↓
2. Selecciona modo (Plantilla o Manual)
   ↓
3. [Plantilla] Backend renderiza subject + body con datos reales
   [Manual] Usuario escribe subject + body
   ↓
4. Usuario completa Para / CC / CCO
   (puede click en chips de sugeridos)
   ↓
5. Preview en vivo se actualiza automáticamente
   ↓
6. Usuario click "Enviar"
   ↓
7. POST /api/email/send
   ├─ to, cc, bcc arrays
   ├─ emailTemplateId (si plantilla sin edits)
   └─ manualSubject, manualBody, manualBodyFormat (si edits o manual)
   ↓
8. Backend guarda en email_logs con correlativo automático
   ↓
9. Toast "E-mail enviado" + cierra modal + invalida queries
```

## Puntos de extensión

### Agregar nuevo modo
Agregar tab en `.app-compose-tabs`:
```tsx
<button
  type="button"
  onClick={() => changeMode("nuevo-modo")}
  data-active={mode === "nuevo-modo"}
  className="app-compose-tab"
>
  <NuevoIcon className="h-3 w-3" />
  Nuevo Modo
</button>
```

### Cambiar tamaño del modal
Reemplazar `modal-xl` por `modal-lg` (910px) si se quiere más chico.

### Reutilizar en otros módulos
El componente necesita `claim` + `action` + `businessLineId`. Se puede usar desde:
- Gestiones del siniestro (actual)
- Módulo de notificaciones
- Bandeja de salida
- Cualquier lugar con una gestión y un siniestro

## Archivos relacionados

| Archivo | Función |
|---------|---------|
| `src/components/claims/email-compose-modal.tsx` | Componente principal |
| `src/app/api/email/preview/route.ts` | API de renderizado de plantillas |
| `src/app/api/email/send/route.ts` | API de envío |
| `src/services/email-render.ts` | `wrapHtmlEmail()` — envuelve HTML |
| `src/services/email-template-actions.ts` | Carga de plantillas vinculadas |
| `src/app/styles/components.css` | Clases `.app-compose-*` |
| `src/app/styles/modals.css` | Clase `modal-xl` |
| `src/app/dashboard/claims/[id]/page.tsx` | Integración con gestiones |
