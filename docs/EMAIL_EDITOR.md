# Email Editor — Editor de correo estilo Outlook 365

> Editor de correo electrónico profesional construido desde cero en React + TypeScript.
> No usa TinyMCE, CKEditor, Tiptap, Slate, Lexical ni ningún editor existente como núcleo.
> Arquitectura propia basada en modelo de documento JSON y componentes React.

---

## Dónde probar

```
http://localhost:3000/dashboard/email-editor-demo
```

También hay una ruta dedicada:

```
http://localhost:3000/dashboard/email-editor
```

---

## Arquitectura

```
src/components/email-editor/
├── core/
│   ├── types.ts              → Modelo JSON (14 tipos de bloque + inline marks)
│   ├── document-model.ts     → Funciones puras (crear, insertar, eliminar, mover)
│   ├── commands.ts           → Patrón Command (InsertBlock, RemoveBlock, UpdateBlock, etc.)
│   └── history.ts            → Undo/Redo basado en comandos
├── store/
│   └── editor-store.ts       → Zustand con slices (document, selection, history, clipboard, ui)
├── renderer/
│   └── html-renderer.ts      → JSON → HTML email-compatible (tablas, inline styles, mso comments)
├── canvas/
│   ├── canvas.tsx            → Área de edición central
│   ├── block-renderer.tsx    → Renderiza cada tipo de bloque
│   ├── inline-text.tsx       → Texto editable con contentEditable + sync JSON
│   └── preview-panel.tsx     → Vista previa HTML en iframe
├── ribbon/
│   ├── ribbon.tsx            → Toolbar estilo Outlook 365
│   └── table-toolbar.tsx     → Toolbar contextual de tablas
├── inspector/
│   ├── inspector-panel.tsx   → Panel derecho: propiedades del bloque seleccionado
│   └── variables-panel.tsx   → Panel izquierdo: variables dinámicas
├── hooks/
│   └── use-paste-handler.ts  → Pegar desde Word/Outlook (limpia HTML)
├── utils/
│   ├── id.ts                 → Generador de IDs únicos
│   └── format-utils.ts       → Aplicar formato a selección (execCommand)
├── email-editor.css          → Todos los estilos (cero inline styles)
└── index.tsx                 → <EmailEditor mode="compose|template|reply|forward" />
```

### Flujo de datos

```
Click en toolbar
    → crea un Command
    → command.execute(doc) → nuevo doc JSON
    → history.push(command)
    → Zustand actualiza estado
    → React re-renderiza
    → HTML preview se regenera
```

El documento JSON es la **única fuente de verdad**. El HTML nunca se edita directamente. Solo se genera al exportar.

---

## Modelo de documento (JSON)

```typescript
interface EmailDocument {
  version: number;
  blocks: Block[];
  metadata?: {
    subject?: string;
    previewText?: string;
    backgroundColor?: string;
    maxWidth?: string;
    fontFamily?: string;
    fontSize?: string;
    textColor?: string;
    linkColor?: string;
  };
}
```

### Tipos de bloque

| Bloque       | Tipo JSON     | Descripción                         |
|--------------|---------------|-------------------------------------|
| Párrafo      | `paragraph`   | Texto con formato inline            |
| Título       | `heading`     | H1-H6 con alineación                |
| Lista        | `list`        | Viñetas o numerada, con sub-items   |
| Tabla        | `table`       | Filas, celdas, colspan/rowspan      |
| Imagen       | `image`       | URL, alt, ancho, alineación, link   |
| Botón        | `button`      | CTA con VML para Outlook            |
| Cita         | `quote`       | Blockquote con borde y fondo        |
| Divisor      | `divider`     | Línea horizontal                    |
| Espaciador   | `spacer`      | Espacio vertical en px              |
| Columnas     | `columns`     | 2+ columnas con gap                 |
| Contenedor   | `container`   | Wrapper con padding y fondo         |
| Callout      | `callout`     | Caja destacada con borde            |
| HTML crudo   | `html`        | Para casos especiales               |
| Firma        | `signature`   | Bloques de firma separados          |

### Marks inline

| Marca        | Tipo           | Descripción              |
|--------------|----------------|--------------------------|
| Negrita      | `bold`         | `<strong>`               |
| Cursiva      | `italic`       | `<em>`                   |
| Subrayado    | `underline`    | `<u>`                    |
| Tachado      | `strike`       | `<s>`                    |
| Enlace       | `link`         | `<a href>`               |
| Color        | `color`        | `<span style="color">`   |
| Resaltado    | `highlight`    | `<span style="bg">`      |
| Tamaño       | `fontSize`     | `<span style="font-size">`|
| Fuente       | `fontFamily`   | `<span style="font-family">`|
| Superíndice  | `sup`          | `<sup>`                  |
| Subíndice    | `sub`          | `<sub>`                  |

### Variables dinámicas

```typescript
interface VariableNode {
  type: "variable";
  variable: string;    // "cliente", "numeroCaso"
  fallback?: string;   // texto alternativo
}
```

Se muestran como chips de color en el editor: `{{cliente}}`

---

## Componente principal

```tsx
import { EmailEditor } from "@/components/email-editor";

<EmailEditor
  mode="compose"           // compose | template | reply | forward
  variables={[
    { key: "cliente", label: "Cliente", value: "Juan Pérez", group: "Siniestro" },
    { key: "numeroCaso", label: "Número", value: "L-000000141", group: "Siniestro" },
  ]}
  template={jsonString}    // documento inicial (opcional)
  onSave={(json, html, text) => {
    // json: string JSON del documento
    // html: HTML email-compatible para SMTP
    // text: texto plano
  }}
  onCancel={() => {}}
/>
```

### Props

| Prop         | Tipo                          | Default     | Descripción                     |
|--------------|-------------------------------|-------------|---------------------------------|
| `mode`       | `EditorMode`                  | `"compose"` | Modo del editor                 |
| `template`   | `EmailDocument \| string`     | —           | Documento inicial               |
| `variables`  | `VariableDefinition[]`        | `[]`        | Variables disponibles           |
| `onSave`     | `(json, html, text) => void`  | —           | Callback al guardar             |
| `onCancel`   | `() => void`                  | —           | Callback al cancelar            |

---

## Store (Zustand)

```typescript
const useEditorStore = create<EditorStore>();

// Slices:
//   document   → documento JSON (fuente de verdad)
//   selection  → bloque/celda seleccionada
//   history    → undo/redo via Command + HistoryManager
//   clipboard  → copiar/pegar bloques
//   ui         → modo, zoom, preview, panels, variables
```

### Uso del store

```typescript
import { useEditorStore } from "@/components/email-editor/store/editor-store";

// Leer estado
const document = useEditorStore((s) => s.document);
const selectedBlock = useEditorStore((s) => s.selection.blockId);

// Ejecutar comando (con undo/redo automático)
const { executeCommand } = useEditorStore();
executeCommand(new InsertBlockCommand(block, index));

// Undo/Redo
const { undo, redo } = useEditorStore();

// Exportar
const json = useEditorStore((s) => s.getJson)();
```

---

## Patrón Command

Cada operación del editor es un comando con `execute()` y `undo()`:

```typescript
interface Command {
  execute(doc: EmailDocument): EmailDocument;
  undo(doc: EmailDocument): EmailDocument;
  description: string;
}
```

### Comandos disponibles

| Comando              | Descripción                    |
|----------------------|--------------------------------|
| `InsertBlockCommand` | Inserta un bloque en posición  |
| `RemoveBlockCommand` | Elimina un bloque por ID       |
| `UpdateBlockCommand` | Actualiza propiedades de bloque|
| `MoveBlockCommand`   | Mueve bloque de posición       |
| `GenericCommand`     | Comando custom con funciones   |

### Ejemplo

```typescript
import { InsertBlockCommand } from "@/components/email-editor/core/commands";
import { createParagraph } from "@/components/email-editor/core/document-model";

const para = createParagraph("Hola mundo");
executeCommand(new InsertBlockCommand(para, 0));
// Undo restaura el documento anterior
```

---

## Renderizador HTML

Convierte el JSON a HTML compatible con clientes de correo:

```typescript
import { renderDocumentToHtml, renderDocumentToPlainText } from "@/components/email-editor/renderer/html-renderer";

const html = renderDocumentToHtml(document, { cliente: "Juan Pérez" });
const text = renderDocumentToPlainText(document, { cliente: "Juan Pérez" });
```

### Reglas de compatibilidad

- Usa **tablas** para layout (no divs/flex/grid)
- **Estilos inline** (no clases CSS)
- **Comentarios condicionales** `<!--[if mso]>` para Outlook
- **VML** para botones redondeados en Outlook
- Sin JavaScript
- Imágenes con `width`/`height` explícitos
- Tablas con `cellpadding`/`cellspacing`/`border` explícitos

### Clientes soportados

- Outlook Desktop (Windows)
- Outlook 365 (Web)
- Outlook Web
- Gmail Web
- Gmail Android / iPhone
- Apple Mail
- Thunderbird
- Yahoo Mail

---

## Ribbon (Toolbar)

Grupos de botones estilo Outlook 365:

| Grupo        | Botones                                                    |
|--------------|------------------------------------------------------------|
| Deshacer     | Deshacer, Rehacer                                          |
| Fuente       | Familia, Tamaño, Color de texto, Color de fondo            |
| Formato      | Negrita, Cursiva, Subrayado, Tachado, Super/Sub, Quitar    |
| Párrafo      | Alinear izq/centro/der/justificar, Sangría in/out          |
| Listas       | Viñetas, Numerada                                          |
| Estilos      | Párrafo, H1, H2, H3, Cita                                  |
| Insertar     | Tabla, Imagen, Enlace, Variable, Columnas, Divisor, Espacio|
| Vista        | Preview, Zoom -/+                                          |

### Atajos de teclado

| Atajo         | Acción     |
|---------------|------------|
| `Ctrl+B`      | Negrita    |
| `Ctrl+I`      | Cursiva    |
| `Ctrl+U`      | Subrayado  |
| `Ctrl+Z`      | Deshacer   |
| `Ctrl+Y`      | Rehacer    |
| `Ctrl+Shift+Z`| Rehacer    |

---

## Inspector panel

Panel derecho que muestra propiedades del bloque seleccionado:

- **Párrafo**: alineación, sangría, interlineado
- **Título**: nivel (H1-H6), alineación
- **Imagen**: URL, alt, ancho, alineación, enlace
- **Botón**: texto, URL, colores, padding, radio, alineación
- **Tabla**: ancho, borde, color de borde, padding de celda
- **Divisor**: color, grosor, ancho
- **Espaciador**: altura
- **Cita/Callout**: colores de borde y fondo

---

## Variables

Panel izquierdo con variables agrupadas:

```typescript
const variables: VariableDefinition[] = [
  { key: "cliente", label: "Cliente", value: "Juan Pérez", group: "Siniestro" },
  { key: "numeroCaso", label: "Número de caso", value: "L-000000141", group: "Siniestro" },
  { key: "empresa", label: "Empresa", value: "Claims Hub", group: "Empresa" },
];
```

- Se muestran agrupadas por categoría
- Clic para insertar chip `{{cliente}}` en el texto
- Al exportar, las variables se reemplazan por su valor

---

## Pegar desde Word/Outlook

El hook `usePasteHandler` intercepta el pegado:

1. Detecta si el HTML viene de Word/Outlook (estilos `mso-*`)
2. Limpia comentarios condicionales, namespaces de Office, estilos basura
3. Convierte el HTML limpio a bloques del documento
4. Preserva: negrita, cursiva, subrayado, enlaces, colores, tablas, listas, títulos

---

## Estado del proyecto

### Sprint 1 ✅ — Motor + Editor visual

- [x] Modelo de documento JSON (14 tipos de bloque)
- [x] Patrón Command + HistoryManager (undo/redo)
- [x] Store Zustand con slices
- [x] Canvas con selección de bloques
- [x] Texto inline editable (contentEditable + sync JSON)
- [x] Ribbon estilo Outlook 365
- [x] Renderizador HTML email-compatible
- [x] Vista previa en iframe
- [x] Guardar/cargar JSON

### Sprint 2 ✅ — Formato avanzado

- [x] Formato a selección precisa (execCommand)
- [x] Dropdowns de fuente y tamaño
- [x] Paleta de color de texto y fondo
- [x] Inspector panel (propiedades del bloque)
- [x] Panel de variables (sidebar izquierdo)
- [x] Tablas: agregar/eliminar filas y columnas
- [x] Pegar desde Word/Outlook (limpiar HTML)
- [x] Quitar formato

### Sprint 3 — Pendiente

- [ ] Fusionar/dividir celdas de tabla
- [ ] Redimensionar columnas de tabla
- [ ] Color de borde y fondo por celda
- [ ] Arrastrar y soltar imágenes
- [ ] Pegar imágenes desde portapapeles
- [ ] Compresión automática de imágenes
- [ ] Conversión a Base64

### Sprint 4 — Pendiente

- [ ] Comentarios condicionales avanzados para Outlook
- [ ] Renderizador con tablas anidadas para layout complejo
- [ ] Media queries para responsive
- [ ] Dark mode en el HTML generado

### Sprint 5 — Pendiente

- [ ] Plantillas con header/footer/firma bloqueados
- [ ] Modo "Correo Libre" (sin restricciones)
- [ ] Bloques bloqueados (propiedad `locked`)

### Sprint 6 — Pendiente

- [ ] Adjuntos de archivo
- [ ] Firma automática
- [ ] Drag & drop de archivos

### Sprint 7 — Pendiente

- [ ] IA para redactar correos
- [ ] Traducción
- [ ] Revisión ortográfica
- [ ] Colaboración en tiempo real

---

## Tecnologías

- **React 19** — UI
- **TypeScript** — tipado estricto
- **Zustand** — estado global con slices
- **Patrón Command** — undo/redo robusto
- **contentEditable** — edición de texto nativa
- **execCommand** — formato de selección
- **DOMParser** — parseo de HTML pegado
- **Tailwind CSS** — estilos del proyecto
- **CSS classes** — estilos del editor (cero inline styles)
- **Lucide Icons** — iconos del ribbon
