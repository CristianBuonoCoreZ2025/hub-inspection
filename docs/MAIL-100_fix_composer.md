# Plan MAIL-100 — Fix Composer de Correo Electrónico

> **Código:** MAIL-100
> **Fecha:** 2026-07-28
> **Estado:** Pendiente de implementación
> **Prioridad:** Alta (producción activa)

---

## Problemas detectados

### Problema 1: El composer se cae al cargar una gestión con plantilla asociada

**Síntoma:** Al abrir el composer de email desde una gestión que tiene una plantilla
vinculada, el componente no renderiza o se cae ("no la renderiza, de entrada se cae").

**Causa raíz (hipótesis):**

El composer (`email-compose-modal.tsx`) carga el preview vía `/api/email/preview` y
lo muestra en un `HtmlEditor` (Tiptap). Tiptap es un editor rich-text que **parsea**
el HTML a su estructura interna de nodos — no es un renderer HTML nativo.

Si el HTML de la plantilla contiene elementos que Tiptap no soporta (ej: `<table>` con
atributos complejos, estilos inline extensos, `doctype`, `<html>`, `<body>`), Tiptap
falla al parsear y el componente se cae.

Además, el preview endpoint devuelve el body **crudo** de la plantilla (sin
`wrapHtmlEmail`), lo que significa que el HTML puede tener estructura incompleta
o inconsistente.

**Archivos involucrados:**
- `src/components/claims/email-compose-modal.tsx` — líneas 634-642 (HtmlEditor)
- `src/components/ui/html-editor.tsx` — editor Tiptap
- `src/app/api/email/preview/route.ts` — endpoint preview (NO se toca)

### Problema 2: El render no se ve como se configuró — sin logo, sin branding

**Síntoma:** Cuando el composer logra renderizar, el correo se ve "paupérrimo" —
sin logo, sin colores de header, sin footer de empresa. No se ve como se configuró
en la plantilla.

**Causa raíz:**

El endpoint `/api/email/preview` devuelve el body **crudo** renderizado (placeholders
reemplazados) pero **SIN** `wrapHtmlEmail`. El wrapper es el que agrega:
- Header con logo de la empresa + color corporativo
- Estructura HTML completa (tabla 600px centrada, sombra, bordes redondeados)
- Footer con copyright y aviso de envío automático
- Estilos tipográficos premium (h1, h2, callouts, magic-link-box)

El composer muestra ese body crudo en el `HtmlEditor` → se ve sin branding.

En cambio, el endpoint `/api/email/send` **SÍ** envuelve con `wrapHtmlEmail` antes
de enviar. Entonces:
- **Lo que se ve en el composer** = body crudo (sin logo, sin header, sin footer)
- **Lo que se envía** = body envuelto (con logo, header color, footer)

El usuario no ve lo que realmente se va a enviar → falta de confianza + se ve pobre.

**Archivos involucrados:**
- `src/components/claims/email-compose-modal.tsx` — muestra body crudo
- `src/services/email-render.ts` — `wrapHtmlEmail()` (líneas 186-260)
- `src/app/api/email/send/route.ts` — líneas 270-280 (SÍ envuelve)
- `src/app/api/email/preview/route.ts` — NO envuelve (NO se toca)

---

## Solución propuesta

### Principio
> El composer debe mostrar **exactamente** lo que se va a enviar — con logo,
> header color, footer y branding completo. El usuario debe ver el correo final
> antes de enviarlo.

### Arquitectura

El composer actual usa `HtmlEditor` (Tiptap) para mostrar el body. Tiptap es un
editor, no un renderer. Hay que separar:

1. **Vista de edición** — `HtmlEditor` (Tiptap) para editar el body crudo
2. **Vista de preview** — `iframe` con `srcDoc` que muestra el body envuelto con
   `wrapHtmlEmail` (como se va a enviar)

### Cambios

#### 1. Composer: agregar vista de preview con iframe

**Archivo:** `src/components/claims/email-compose-modal.tsx`

- Agregar estado `viewMode: "edit" | "preview"`
- En modo `edit`: mostrar `HtmlEditor` con el body crudo (como hoy)
- En modo `preview`: mostrar un `<iframe srcDoc={wrappedBody} />` con el body
  envuelto con `wrapHtmlEmail`
- Toggle entre edit/preview con botones en la action bar
- El preview debe usar los datos de la empresa (logo, color, nombre) que se
  obtienen del `claim.company_id`

#### 2. Composer: obtener datos de empresa para el wrapper

**Archivo:** `src/components/claims/email-compose-modal.tsx`

- Query a `companies` por `action.company_id` para obtener:
  - `logo_url`
  - `primary_color` (header color)
  - `name`
- Pasar estos datos a `wrapHtmlEmail` en el cliente

#### 3. Composer: importar `wrapHtmlEmail` en el cliente

**Archivo:** `src/services/email-render.ts`

- `wrapHtmlEmail` es una función pura (no usa APIs del servidor)
- Verificar que se puede importar desde un componente `"use client"`
- Si hay dependencias server-only, extraer `wrapHtmlEmail` a un archivo
  compartido `src/lib/email-wrapper.ts`

#### 4. Composer: manejo robusto de errores del preview

**Archivo:** `src/components/claims/email-compose-modal.tsx`

- Si `/api/email/preview` falla, mostrar mensaje de error claro (no crash)
- Si el body está vacío, mostrar placeholder
- Si Tiptap no puede parsear el HTML, fallback a textarea
- Loading state visible mientras carga el preview

#### 5. Composer: default a vista preview

- Al abrir el composer con una plantilla seleccionada, mostrar primero la vista
  de `preview` (iframe) para que el usuario vea el correo final
- Botón "Editar" cambia a vista `edit` (HtmlEditor)
- Botón "Preview" vuelve a vista `preview`

---

## Detalles técnicos

### iframe vs HtmlEditor

| Aspecto | HtmlEditor (Tiptap) | iframe |
|---------|---------------------|--------|
| Render HTML | Parsea a nodos internos | Render nativo del navegador |
| Soporta `<table>`, estilos | Parcial | Completo |
| Editable | Sí | No (es solo vista) |
| Branding (logo, header) | No | Sí (con wrapHtmlEmail) |
| Se cae con HTML complejo | Sí | No |

### Flujo del composer

```
Abrir composer
  → Cargar plantillas vinculadas (getEmailTemplatesForAction)
  → Seleccionar plantilla default
  → Llamar /api/email/preview → { subject, body, body_format }
  → Vista PREVIEW:
      body envuelto con wrapHtmlEmail(logo, color, name)
      → iframe srcDoc={wrappedBody}
  → Vista EDITAR:
      body crudo → HtmlEditor (Tiptap)
  → Al enviar:
      /api/email/send (envuelve con wrapHtmlEmail en backend)
```

### Datos de empresa en el composer

```typescript
// Query en el composer
const { data: company } = useQuery({
  queryKey: ["company-for-email", action.company_id],
  queryFn: async () => {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("companies")
      .select("id, name, logo_url, primary_color")
      .eq("id", action.company_id)
      .maybeSingle();
    return data;
  },
  enabled: open && !!action.company_id,
});

// Envolver body para preview
const wrappedBody = useMemo(() => {
  if (effectiveFormat !== "html") return effectiveBody;
  return wrapHtmlEmail({
    body: effectiveBody,
    logoUrl: company?.logo_url,
    headerColor: company?.primary_color,
    companyName: company?.name,
  });
}, [effectiveBody, effectiveFormat, company]);
```

---

## Archivos a modificar

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/components/claims/email-compose-modal.tsx` | Agregar vista preview con iframe, toggle edit/preview, query de empresa, manejo de errores robusto |
| 2 | `src/services/email-render.ts` | Verificar que `wrapHtmlEmail` se puede importar en cliente. Si no, extraer a `src/lib/email-wrapper.ts` |
| 3 | `src/app/styles/modals.css` | Estilos para el iframe de preview (altura, bordes, scrollbar) |

## Archivos que NO se tocan

| Archivo | Motivo |
|---------|--------|
| `src/app/api/email/preview/route.ts` | El endpoint preview no se toca (indicación del usuario) |
| `src/app/api/email/send/route.ts` | Ya envuelve correctamente con `wrapHtmlEmail` |
| `src/services/email-sender.ts` | Funciona correctamente con Resend |

---

## Criterios de aceptación

1. ✅ Al abrir el composer con una plantilla vinculada, **no se cae**
2. ✅ El composer muestra el correo **con logo, header color y footer** (igual que se enviará)
3. ✅ Se puede alternar entre vista "Preview" (iframe) y "Editar" (HtmlEditor)
4. ✅ Al editar, los cambios se reflejan en el preview
5. ✅ Si el preview falla, muestra mensaje de error (no crash)
6. ✅ Si no hay empresa configurada, usa valores default (color #0095DA, sin logo)
7. ✅ El correo enviado se ve igual que el preview del composer
8. ✅ `tsc --noEmit` 0 errores
9. ✅ `eslint` 0 errores, 0 warnings
10. ✅ `pnpm build` exitoso

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Tiptap sigue cayéndose en modo edición | Mantener fallback a textarea si Tiptap falla |
| iframe no renderiza en algunos navegadores | Usar `srcDoc` (soportado en todos los navegadores modernos) |
| `wrapHtmlEmail` tiene dependencias server-only | Extraer a archivo compartido sin dependencias server |
| Performance: query adicional de empresa | Usar `staleTime` alto (5 min) — los datos de empresa casi no cambian |

---

## Estimación

- Composer: vista preview + iframe + toggle ~ 2h
- Query de empresa + wrapHtmlEmail en cliente ~ 30min
- Manejo de errores robusto ~ 30min
- CSS del iframe ~ 15min
- Testing + build ~ 15min

**Total estimado:** ~3.5h
