# Piel Única del Body de Email — `email-body-render`

> **Regla del proyecto:** [`AGENTS.md` § 0j](../AGENTS.md)
>
> Lo que se diseña en el editor de plantillas **debe verse igual** a lo que
> recibe el destinatario en su buzón. WYSIWYG real, no aproximado.

---

## El problema que originó esta regla

Se perdieron **3 días** diseñando un editor de email desde cero porque el
`EmailTemplateEditor` (donde se diseña la plantilla) y el `EmailComposeModal`
(donde se redacta y envía el correo) usaban el **mismo `HtmlEditor` (Tiptap)**
y el **mismo HTML**, pero **CSS distinto** para vestir el body.

### Síntoma que veía el usuario

> "Cuando rendeo mi plantilla, lo que había escrito en el email template no es
> igual a lo que veo en el body del email compose modal."

### Causa real

El HTML del body era **idéntico** en ambos componentes. El render solo
reemplazaba placeholders (`<liquidation_number>` → `L-000000141`). La
estructura, fuentes, márgenes y negrillas definidas en la plantilla **se
preservaban**.

Lo que cambiaba era **la piel CSS**:

| Elemento | `EmailTemplateEditor` (globals.css) | `EmailComposeModal` (modals.css) |
|----------|-------------------------------------|----------------------------------|
| h1 | 28px, weight 700 | **22px**, weight **600** |
| h2 | 22.4px, weight 700 | **18px**, weight **600** |
| h3 | 18.4px, weight 600 | **15px**, weight 600 |
| p (margen) | `0.3em 0` | `0 0 12px 0` |
| line-height | 1.5 | **1.7** |
| fuente | hereda la del app | **forzada**: Segoe UI / Roboto |
| strong | weight 700 | **weight 600** |
| links | `var(--primary)`, subrayado | `#2563eb`, **sin subrayado** |
| color texto | `var(--foreground)` (dark/light) | `#1e293b` (siempre oscuro) |
| padding wrap | ninguno | **32px** |

Mismo HTML, dos pieles distintas → dos resultados visuales distintos.

### La analogía

Es como escribir un documento en Word con ciertos estilos y abrirlo en Google
Docs. El contenido es idéntico, pero cada programa tiene sus propios estilos
por defecto para h1, h2, párrafos. Se ve distinto aunque el documento sea el
mismo.

---

## La solución: una sola piel

Se unificó todo bajo **una clase CSS**: `email-body-render`.

Toda superficie que muestre o edite el body de un email usa esta clase. No
existe "piel del editor" y "piel del composer". Existe **la piel del email**.

### Dónde vive

```
src/app/styles/modals.css
  └── sección "Piel única del body de email — REGLA"
      └── .email-body-render { ... }
          ├── .html-editor-wrap { padding: 32px }
          └── .html-editor-content { ... estilos canónicos ... }
```

Es el **único lugar** donde se definen los estilos del body de email. No se
duplican en `globals.css` ni en ningún otro archivo.

### Dónde se aplica

| Componente | Archivo | Uso |
|------------|---------|-----|
| `EmailTemplateEditor` | `src/app/dashboard/catalogos/gestiones/email-templates/components/EmailTemplateEditor.tsx` | `className="email-body-render min-h-40"` en el `HtmlEditor` del body |
| `EmailComposeModal` | `src/components/claims/email-compose-modal.tsx` | `className="email-body-render"` en el `HtmlEditor` del body |
| `EmailPreviewModal` | `src/components/claims/email-preview-modal.tsx` | (futuro) misma clase al mostrar el body |

---

## Estilos canónicos (referencia única)

Estos son los valores que usa el `wrapHtmlEmail` al enviar el correo, y los
que debe usar cualquier editor/visor de body de email:

| Elemento | Valor |
|----------|-------|
| Fuente | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` |
| Tamaño base | `14px` |
| Line-height | `1.7` |
| Color de texto | `#1e293b` (siempre oscuro — los emails tienen fondo blanco) |
| Padding del wrap | `32px` |
| h1 | `22px`, weight `600`, color `#0f172a`, margin `0 0 12px 0` |
| h2 | `18px`, weight `600`, color `#1e293b`, margin `0 0 12px 0` |
| h3 | `15px`, weight `600`, color `#334155`, margin `0 0 12px 0` |
| p | margin `0 0 12px 0` |
| strong | weight `600` |
| a | color `#2563eb`, sin subrayado, subrayado en hover |
| ul, ol | margin `0 0 12px 0`, padding-left `20px` |
| li | margin-bottom `6px` |
| table | border-collapse `collapse`, width `100%` |
| th, td | border `1px solid #e5e7eb`, padding `8px` |

> **Nota:** estos valores **no se adaptan a dark mode**. Los emails siempre
> tienen fondo blanco. El composer y el editor de plantillas muestran el body
> sobre fondo blanco fijo para reflejar esto.

---

## El pipeline completo (para entender, no para dudar)

```
1. Usuario diseña plantilla en EmailTemplateEditor
   └── HtmlEditor con clase email-body-render
       └── ve el body con la piel del email (la misma que llegará al buzón)

2. Usuario guarda plantilla
   └── body HTML crudo (con <placeholders>) → Supabase (email_templates.body)

3. Usuario abre EmailComposeModal desde una gestión
   └── POST /api/email/preview
       ├── buildDocumentDataForClaim(claim_id) → datos reales del siniestro
       ├── renderEmailTemplate(plantilla, datos) → reemplaza placeholders
       └── devuelve { subject, body, body_format }
   └── HtmlEditor con clase email-body-render
       └── recibe el body ya renderizado (placeholders reemplazados)
       └── lo muestra con la misma piel del email

4. Usuario envía
   └── POST /api/email/send
       ├── renderEmailTemplate (mismo render)
       ├── wrapHtmlEmail (envuelve con header/footer/doctype)
       └── Resend envía el HTML completo al buzón
```

**Punto clave:** el render (`renderEmailTemplate`) solo hace **replace de
valores**. No toca la estructura, fuentes, márgenes ni negrillas. La estructura
se preserva del paso 1 al paso 4. Lo que cambia entre el editor y el composer
**no es el HTML**, es (era) el CSS que lo vestía. Con `email-body-render`
unificada, ya no cambia.

---

## Reglas de uso

### Al editar el body de email en un componente

```tsx
// ✅ Correcto
<HtmlEditor
  value={body}
  onChange={setBody}
  className="email-body-render min-h-40"
/>

// ❌ Incorrecto — hereda estilos del app, no del email
<HtmlEditor
  value={body}
  onChange={setBody}
  className="min-h-40"
/>

// ❌ Incorrecto — crea una piel paralela
<HtmlEditor
  value={body}
  onChange={setBody}
  className="mi-editor-email min-h-40"
/>
```

### Al modificar los estilos del body de email

- Editar **solo** el bloque `.email-body-render` en `modals.css`.
- **No** agregar estilos del body de email en `globals.css` ni en otros CSS.
- **No** usar inline styles para estilos visuales del body (regla #2 del
  proyecto).

### Al crear un nuevo componente de email

- Usar `className="email-body-render"` en el `HtmlEditor` o contenedor del body.
- No inventar una clase nueva.

---

## Lección aprendida

> **El `HtmlEditor` (Tiptap) es un visor de HTML, no un definidor de estilos.**
> El mismo visor muestra cosas distintas según qué CSS envuelva al contenido.
> Si dos componentes usan el mismo visor pero distinto CSS, el mismo HTML se
> verá distinto en cada uno. La solución no es "mejorar el render" — es usar
> **la misma piel** en todos los lugares donde se muestra el body de email.

Esta regla existe para que **no se vuelva a perder tiempo** debugueando un
"render roto" que en realidad era un problema de CSS divergente entre dos
componentes que comparten el mismo HTML.
