# EmailPreviewModal — Visor de Correos Reutilizable

> Componente modal para visualizar correos enviados desde cualquier parte del sistema.
> Incluye vista previa del body (HTML o texto plano), metadatos, impresión y descarga .eml.

## Ubicación

```
src/components/claims/email-preview-modal.tsx
```

## API

### Props

```typescript
interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: EmailLogLite | null;
}
```

### Tipo de datos requerido

```typescript
interface EmailLogLite {
  id: string;
  to_address: string[];           // Destinatarios principales
  cc_address: string[];           // Con copia
  bcc_address: string[];          // Con copia oculta
  subject: string;                // Asunto del correo
  body: string;                   // Cuerpo (HTML o texto plano)
  body_format: "plain" | "html";  // Formato del body
  status: string;                 // "sent" | "queued" | "error"
  sent_at: string;                // ISO date string
  correlativo: number;            // Número correlativo (ej: 1 → EML-001)
  parent_action_code: string | null;  // Código de gestión vinculada (ej: "L-000000141-HCIN-004")
  sent_by_user?: {                // Quién envió el correo (opcional)
    id: string;
    full_name: string;
    email: string;
  } | null;
}
```

### Uso básico

```tsx
"use client";
import { useState } from "react";
import { EmailPreviewModal } from "@/components/claims/email-preview-modal";

function MiComponente() {
  const [emailPreviewLog, setEmailPreviewLog] = useState<EmailLogLite | null>(null);

  return (
    <>
      {/* Botón que abre el modal */}
      <button onClick={() => setEmailPreviewLog(log)}>
        Ver correo
      </button>

      {/* Modal */}
      <EmailPreviewModal
        open={!!emailPreviewLog}
        onOpenChange={(v) => { if (!v) setEmailPreviewLog(null); }}
        log={emailPreviewLog}
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
│  │  HEADER (p-4 = 16px)                                            │  │
│  │  ├─ border-bottom: 1px solid var(--border)                      │  │
│  │  ├─ background: var(--background)                               │  │
│  │  │                                                              │  │
│  │  │  [✉️]  Asunto del correo (14px semibold)                     │  │
│  │  │  40px  Gestión: L-000000141-HCIN-004 (10px)                 │  │
│  │  │  grad   email: EML-001 (10px mono)                          │  │
│  │  │                                                              │  │
│  │  │                          [📥] [🖨️] [X]  (32x32 c/u)         │  │
│  │  └──────────────────────────────────────────────────────────────┘  │
│  │                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  METADATOS (px-4 py-3)                                          │  │
│  │  ├─ border-bottom: 1px solid var(--border)                      │  │
│  │  ├─ background: color-mix(var(--muted) 20%, transparent)        │  │
│  │  ├─ grid: 2 columnas, gap-x: 24px, gap-y: 6px                   │  │
│  │  ├─ font-size: 11px                                              │  │
│  │  │                                                              │  │
│  │  │  Para   cristian@...        CC     —                          │  │
│  │  │  CCO    —                   Fecha  26-07-2026, 09:18          │  │
│  │  └──────────────────────────────────────────────────────────────┘  │
│  │                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ÁREA DE SCROLL (flex-1 overflow-y-auto w-full)                │  │
│  │  │                                                              │  │
│  │  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  │  IFRAME (HTML) o PRE (texto plano)                    │   │  │
│  │  │  │  ├─ width: 100%                                        │   │  │
│  │  │  │  ├─ min-height: 60vh                                   │   │  │
│  │  │  │  ├─ background: #ffffff                                │   │  │
│  │  │  │  └─ sandbox: allow-same-origin                         │   │  │
│  │  │  │                                                      │   │  │
│  │  │  │  [Body del correo con su propio HTML]               │   │  │
│  │  │  │  ├─ Banner McLarens (azul #0080C8)                  │   │  │
│  │  │  │  ├─ Texto del correo                                 │   │  │
│  │  │  │  ├─ Magic link box                                   │   │  │
│  │  │  │  └─ Footer copyright                                 │   │  │
│  │  │  │                                                      │   │  │
│  │  │  │  padding-bottom: 64px (dentro del iframe)            │   │  │
│  │  │  └──────────────────────────────────────────────────────┘   │  │
│  │  │                                                              │  │
│  │  │  [Espaciador 20px]                                           │  │
│  │  └──────────────────────────────────────────────────────────────┘  │
│  └──────────────────────────────────────────────────────────────────────┘
```

## Header — 3 filas

El header del modal muestra la identidad del correo en 3 filas:

| Fila | Contenido | Estilo |
|------|-----------|--------|
| 1 | Asunto del correo | `text-sm font-semibold text-foreground` (14px) |
| 2 | `Gestión: {parent_action_code}` | `text-[10px] text-muted-foreground` (solo si existe) |
| 3 | `email: EML-{correlativo}` | `text-[10px] text-muted-foreground font-mono` |

### Ícono del header
- Tamaño: 40×40px (`h-10 w-10`)
- Border-radius: 12px (`rounded-xl`)
- Background: `linear-gradient(135deg, #6366f1, #a855f7)` (índigo → violeta)
- Ícono: `Mail` de lucide-react (16px)

## Botones de acción

Tres botones en la esquina superior derecha del header:

| Botón | Ícono | Función | Title |
|-------|-------|---------|-------|
| Descargar | `Download` (14px) | `handleDownload()` | "Descargar .eml" |
| Imprimir | `Printer` (14px) | `handlePrint()` | "Imprimir" |
| Cerrar | `X` (14px) | `onOpenChange(false)` | "Cerrar" |

### Estilo de los botones
- Tamaño: 32×32px (`h-8 w-8`)
- Border-radius: 8px (`rounded-lg`)
- Border: `1px solid var(--border)`
- Background: `var(--background)`
- Color: `var(--muted-foreground)` → hover: `var(--foreground)`
- Hover background: `var(--muted)`
- Transición: `transition-colors`

## Funcionalidad: Descargar (.eml)

Genera un archivo `.eml` estándar (RFC 822) descargable.

### Nombre del archivo
```
{parent_action_code}_{EML-XXX}.eml    → si hay gestión vinculada
{EML-XXX}.eml                         → si no hay gestión
```

Ejemplo: `L-000000141-HCIN-004_EML-001.eml`

### Headers del .eml
```
From: {sent_by_user.email || noreply@hub-inspection.cl}
To: {to_address.join(", ")}
Cc: {cc_address.join(", ")}          (solo si hay)
Bcc: {bcc_address.join(", ")}         (solo si hay)
Subject: {subject}
Date: {sent_at.toUTCString()}
X-Correlativo: EML-{correlativo}
X-Gestion: {parent_action_code}       (solo si hay)
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8   (o text/plain)

{body}
```

### Implementación
```typescript
const handleDownload = () => {
  const eml = [...headers, "", log.body].filter(Boolean).join("\r\n");
  const blob = new Blob([eml], { type: "message/rfc822" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.eml`;
  a.click();
  URL.revokeObjectURL(url);
};
```

## Funcionalidad: Imprimir

Abre una ventana nueva con el correo formateado para impresión.

### Estructura del documento impreso
```
┌─────────────────────────────────────────┐
│  {subject} (14px bold)                   │
│ ─────────────────────────────────────── │
│  Gestión    {parent_action_code}         │  (solo si existe)
│  email      EML-{correlativo}            │
│  Para       {to_address}                 │
│  CC         {cc_address}                 │
│  CCO        {bcc_address}                │
│  Fecha      {sent_at}                    │
│ ─────────────────────────────────────── │
│                                          │
│  {body del correo}                       │
│                                          │
└─────────────────────────────────────────┘
```

### Estilos de impresión
- `@page { margin: 16mm }`
- Font family: system sans-serif
- Metadata: tabla 2 columnas (label 60px + valor)
- Body: respeta HTML del correo (callouts, magic-link-box, headings, listas)
- Colors: impresión en color (no forzado a B/N)

### Implementación
```typescript
const handlePrint = () => {
  const printWin = window.open("", "_blank", "width=800,height=600");
  printWin.document.write(`<!DOCTYPE html>...`);
  printWin.document.close();
  setTimeout(() => printWin.print(), 300);
};
```

## Metadatos

Sección entre el header y el body con los datos del correo.

### Layout
- Grid de 2 columnas (`grid-cols-2`)
- Gap: 24px horizontal, 6px vertical
- Font-size: 11px
- Padding: 12px 16px (`px-4 py-3`)
- Border-bottom: 1px solid var(--border)
- Background: `color-mix(var(--muted) 20%, transparent)`

### Campos

| Campo | Posición | Label | Valor vacío |
|-------|----------|-------|-------------|
| Para | Izquierda arriba | `Para` (40px min) | `—` |
| CC | Derecha arriba | `CC` (40px min) | `""` (blanco) |
| CCO | Izquierda abajo | `CCO` (40px min) | `""` (blanco) |
| Fecha | Derecha abajo | `Fecha` (40px min) | — |

### Formato de fecha
```typescript
new Date(sent_at).toLocaleString("es-CL", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false,
});
// Ejemplo: "26-07-2026, 09:18"
```

## Body del correo

### HTML (body_format === "html")
- Se renderiza dentro de un `<iframe>` con `sandbox="allow-same-origin"`
- El HTML se envuelve con `wrapHtmlEmail()` de `src/services/email-render.ts`
- `wrapHtmlEmail` agrega: banner de empresa, estilos CSS, footer de copyright
- Padding-bottom de 64px dentro del iframe para que el scroll no choque abajo
- min-height: 60vh

### Texto plano (body_format === "plain")
- Se renderiza con `<pre className="whitespace-pre-wrap font-sans">`
- Padding: `p-8 pb-16` (32px + 64px abajo)
- Font: sans-serif, text-sm, leading-relaxed

### Espaciador inferior
Después del contenido, un div vacío de 20px para aire inferior del scroll:
```tsx
<div style={{ height: "20px", minHeight: "20px", flexShrink: 0 }} />
```

## Clases CSS

### modals.css — `modal-xl`
```css
.modal-xl {
  width: min(98vw, 1100px);
  max-height: 92vh;
  border-radius: 18px;
  background: color-mix(in srgb, var(--card) 85%, transparent);
  backdrop-filter: blur(20px) saturate(140%);
  box-shadow: 0 26px 55px rgba(2, 12, 27, 0.25);
  border: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
}
```

### components.css — clases del email

| Clase | Función |
|-------|---------|
| `.app-email-meta` | Grid de metadatos (label + valor) |
| `.app-email-meta-label` | Label de metadata (muted, font-medium) |
| `.app-email-meta-value` | Valor de metadata (foreground, break-all) |
| `.app-email-meta-bar` | Barra de metadata (fondo + borde liquid glass) |
| `.app-email-header` | Header del modal (banner con ícono) |
| `.app-email-header-icon` | Ícono del header (gradiente índigo→violeta) |
| `.app-email-action-btn` | Botones de acción rápida (liquid glass) |
| `.app-email-status` | Badge de estado del correo |

### components.css — clases del submenu de correos

| Clase | Función |
|-------|---------|
| `.app-email-submenu-header` | Header del submenu (2 filas compactas) |
| `.app-email-submenu-title` | "Correos Enviados" (11px semibold) |
| `.app-email-submenu-meta` | Row 2 — flex justify-between |
| `.app-email-submenu-meta-code` | Código gestión (9px mono) |
| `.app-email-submenu-meta-count` | Contador enviados (9px) |
| `.app-email-submenu-list` | Lista de correos (max-h 288px) |

## Dependencias

### Componentes
- `Dialog`, `DialogContent`, `DialogTitle` — `@/components/ui/dialog`
- `wrapHtmlEmail` — `@/services/email-render`

### Íconos (lucide-react)
- `Mail` — ícono del header
- `Download` — botón descargar
- `Printer` — botón imprimir
- `X` — botón cerrar

## Integración con el botón de mail

El modal se integra con el botón de mail de las gestiones mediante el estado `emailPreviewLog`:

```tsx
// En page.tsx del claim
const [emailPreviewLog, setEmailPreviewLog] = useState<EmailLogLite | null>(null);

// En la lista de correos del submenu
<DropdownMenuItem onClick={(e) => {
  e.stopPropagation();
  setEmailPreviewLog(log);
}}>
  {/* contenido del item */}
</DropdownMenuItem>

// Al final del componente
<EmailPreviewModal
  open={!!emailPreviewLog}
  onOpenChange={(v) => { if (!v) setEmailPreviewLog(null); }}
  log={emailPreviewLog}
/>
```

## Puntos de extensión

### Agregar nuevos botones de acción
Agregar en el div de botones del header:
```tsx
<button
  type="button"
  onClick={handleNuevaAccion}
  title="Nueva acción"
  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
>
  <NuevoIcon className="h-3.5 w-3.5" />
</button>
```

### Cambiar el tamaño del modal
Reemplazar `modal-xl` por otra clase:
- `modal-sm` (520px) — muy chico, no recomendado
- `modal-md` (560px) — chico
- `modal-lg` (910px) — mediano
- `modal-xl` (1100px) — **actual, recomendado**

### Reutilizar en otros módulos
El componente es genérico. Solo necesita un objeto `EmailLogLite`. Se puede usar desde:
- Gestiones del siniestro (actual)
- Módulo de auditoría
- Bandeja de salida
- Historial de notificaciones
- Cualquier lugar que tenga un `EmailLogLite`

```tsx
import { EmailPreviewModal } from "@/components/claims/email-preview-modal";

<EmailPreviewModal
  open={open}
  onOpenChange={setOpen}
  log={log}
/>
```

## Archivos relacionados

| Archivo | Función |
|---------|---------|
| `src/components/claims/email-preview-modal.tsx` | Componente principal |
| `src/services/email-render.ts` | `wrapHtmlEmail()` — envuelve HTML del body |
| `src/services/email-logs.ts` | Servicio de consulta de email_logs |
| `src/app/styles/modals.css` | Clase `modal-xl` |
| `src/app/styles/components.css` | Clases `.app-email-*` |
| `src/app/dashboard/claims/[id]/page.tsx` | Integración con gestiones |
