# Plan de Migración: DrawingCanvas → Editor de Croquis Vectorial

> **Estado:** FASE 1 — Análisis y Planificación (pendiente de aprobación)
> **Fecha:** 2026-07-30
> **Regla aplicable:** No se modificará ningún archivo `.tsx`/`.css` hasta la
> aprobación explícita de este documento.

---

## 1. Situación Actual

### Componente existente
- **Archivo:** `src/components/ui/drawing-canvas.tsx` (353 líneas)
- **Tecnología:** HTML5 Canvas puro + API 2D (`getContext("2d")`)
- **Modelo:** Raster bitmap. Cada trazo se "pinta" directamente sobre el canvas.
  No hay objetos persistentes: el estado es la imagen misma (`ImageData`).
- **Herramientas:** `pencil`, `line`, `rectangle`, `circle`, `triangle`, `eraser`
- **Exportación:** `canvas.toDataURL("image/png")` → PNG en base64
- **Historial:** stack de `ImageData` (undo limitado, no redo)
- **Responsividad:** calcula `width` desde `containerRef.getBoundingClientRect()`
  y aplica `devicePixelRatio` (DPR) para nitidez. Altura fija (prop `height`).
- **Compatibilidad hacia atrás:** prop `initialImage` (URL de croquis existente)
  cargada como fondo con `ctx.drawImage(img, 0, 0, w, h)`.

### Contrato de props (a respetar)
```ts
interface DrawingCanvasProps {
  onSave: (dataUrl: string) => void;   // PNG base64
  saving?: boolean;
  initialImage?: string;               // URL de croquis previo (edición)
  width?: number;                      // fallback si no hay container
  height?: number;                     // alto fijo del canvas
  className?: string;
}
```

### Consumidores (2 puntos)
1. **`src/app/dashboard/inspecciones/[id]/sketches-tab.tsx`** (líneas 173–178)
   - Tema claro de la app (`app-panel`, `app-stack`, `app-section-title`).
   - `height={500}`.
2. **`src/app/inspection/[token]/page.tsx`** (líneas 1075–1080)
   - Página pública del asegurado (magic link), tema oscuro slate
     (`border-slate-700`, `bg-slate-950`, `text-slate-200`).
   - Envuelto en componente `Panel`. `height={450}`.

### Backend (sin cambios)
- **Endpoint:** `POST /api/inspection/sketch`
- **Payload:** `{ sessionId, sketchDataUrl: string (base64 PNG), label, sketchId? }`
- **Flujo:** base64 → `Buffer` → `uploadInspectionFile(..., "CRO", ".png")` → R2
  → registro en `damage_sketches`.
- **Conclusión:** el backend **no se toca**. Solo exige `sketchDataUrl` sea un
  data URL PNG válido. Mantener ese contrato es la restricción crítica.

---

## 2. Librería Seleccionada: **Fabric.js v6**

### Por qué Fabric.js v6 y no Konva.js

| Criterio | Fabric.js v6 | Konva.js |
|---|---|---|
| Modelo de objetos vectorial nativo | ✅ `Rect`, `Circle`, `Path`, `Group`, `Textbox` con propiedades vivas | ✅ pero más verboso |
| Selección / resize / rotación **out-of-the-box** | ✅ controles `cornerStyle`, `cornerColor`, `rotatingPoint` listos | ⚠️ hay que construir los transformers manualmente |
| Drag & drop de figuras predefinidas | ✅ `canvas.add(obj)` + eventos `object:moving` | ✅ |
| Export a PNG base64 | ✅ `canvas.toDataURL()` idéntico a Canvas API | ✅ `stage.toCanvas().toDataURL()` |
| Soporte React 19 / Next 16 | ✅ ESM puro, sin peer deps problemáticos | ✅ vía `react-konva` (capa extra) |
| TypeScript nativo | ✅ v6 reescrito en TS, tipos incluidos | ✅ |
| Tamaño del bundle | ~140 kB gzip | ~120 kB + react-konva |
| Madurez para "editor de planos" | ✅ casos de uso reales (floorplanner-like) | ✅ |

**Decisión:** **Fabric.js v6**. El requerimiento central es "construcción
modular de planos con drag & drop, resize desde esquinas y rotación" — exactamente
el caso de uso donde Fabric brilla porque los controles de manipulación vienen
incluidos. Konva requeriría reimplementar la lógica de handles/transformers, lo
que añade riesgo y tiempo sin beneficio claro.

### Versión a instalar
- `fabric@^6.x` (publicación estable, >7 días en npm). Se verificará la versión
  exacta publicada antes del `pnpm add` para respetar la regla de
  `minimumReleaseAge` del proyecto.

### Riesgos conocidos y mitigaciones
- **SSR:** Fabric accede al `window`. Es estrictamente client-side → el componente
  se marca `"use client"` y se inicializa dentro de `useEffect` (nunca en módulo
  top-level). Next 16 no ejecuta `useEffect` en el servidor.
- **React 19 Strict Mode:** doble montaje en dev. Se protege la inicialización
  con un ref guard (`canvasRef.current` + `dispose()` en cleanup).
- **Bundle size:** se importa solo lo necesario (`fabric` es tree-shakeable en v6).

---

## 3. Arquitectura de Componentes

### Estructura de archivos propuesta

```
src/components/ui/
  drawing-canvas.tsx              ← EXISTE. Se reescribe como wrapper delgado.
                                    Mantiene el MISMO contrato de props para
                                    que los 2 consumidores no cambien.

src/features/inspection-sketch/
  sketch-editor.tsx               ← NUEVO. Componente principal client-side.
                                    Orquesta Fabric, toolbar, paleta de bloques,
                                    exportación y carga de croquis previo.
  sketch-toolbar.tsx               ← NUEVO. Barra de herramientas (botones
                                    pg-btn-platinum, app-input, etc.).
  sketch-blocks-palette.tsx        ← NUEVO. Panel lateral con figuras
                                    predefinidas arrastrables (Living, Comedor,
                                    Baño, Cocina, Muros, Puerta, Ventana).
  sketch-canvas-stage.tsx          ← NUEVO. Contenedor DOM del <canvas> Fabric.
                                    Maneja ResizeObserver para responsividad.
  sketch-export.ts                 ← NUEVO. Utilidad pura: serializa el canvas
                                    Fabric a PNG base64 (multiplier por DPR).
  sketch-blocks.ts                ← NUEVO. Catálogo de bloques predefinidos
                                    (tipo, dimensiones default, estilo, label).
  sketch-types.ts                  ← NUEVO. Tipos compartidos del feature.

src/app/styles/
  sketch-editor.css                ← NUEVO. Clases CSS del editor (toolbar,
    palette, stage, handles). CERO inline styles. Cumple REGLA #2.
```

### Por qué un wrapper delgado en `drawing-canvas.tsx`
Los 2 consumidores (`sketches-tab.tsx` y `inspection/[token]/page.tsx`) importan
`<DrawingCanvas onSave saving initialImage height />`. Mantener ese nombre y
ese contrato significa **cero cambios en los consumidores**. Internamente
`DrawingCanvas` renderiza `<SketchEditor .../>`. Si en el futuro se quiere
migrar los consumidores al nuevo componente directamente, se hace sin urgencia.

### Responsabilidades por archivo

**`sketch-editor.tsx`** (orquestador)
- Crea la instancia `fabric.Canvas` en `useEffect` (con cleanup `dispose()`).
- Sincroniza el modo activo (select / draw / pan) con la toolbar.
- Recibe `initialImage` y, si existe, lo carga como **capa de fondo bloqueada**
  (imagen raster de referencia) para respetar croquis antiguos.
- Expone `onSave` que llama a `sketch-export.ts` y devuelve el PNG base64.
- Mantiene historial de objetos (undo/redo) a nivel de objetos Fabric, no de
  bitmap — más liviano y preciso que el `ImageData` actual.

**`sketch-canvas-stage.tsx`** (contenedor responsivo)
- `<div ref>` que envuelve el `<canvas>`.
- `ResizeObserver` que llama a `canvas.setDimensions({ width, height })` y
  re-aplica `viewportTransform` / zoom para que el contenido escale
  proporcionalmente al cambiar el tamaño de ventana.
- Calcula alto responsivo por breakpoint (CSS, no inline):
  - móvil: 320px, tablet portrait: 400px, desktop: 500px (configurable vía prop).

**`sketch-toolbar.tsx`** (UI)
- Botones `pg-btn-platinum` (1 palabra cada uno): `Seleccionar`, `Mano`, `Deshacer`,
  `Rehacer`, `Limpiar`, `Guardar`.
- Selector de color (`app-input` type color) y grosor (`app-input` type range).
- Respeta dark mode (variables CSS del tema) — funciona en ambos consumidores.

**`sketch-blocks-palette.tsx`** (panel de bloques)
- Lista de bloques predefinidos con iconos `lucide-react` (no emojis).
- Drag & drop: usa HTML5 drag API nativa (sin @dnd-kit para no añadir
  complejidad) → al soltar sobre el stage, se crea el objeto Fabric en la
  posición del drop.
- En móvil (<640px) el panel se colapsa a un `<Select>` o un sheet inferior
  (CSS responsive) ya que no hay drag con mouse.

**`sketch-blocks.ts`** (catálogo)
- Define bloques: `{ id, label, type: "rect"|"path"|"group", defaultSize,
  fill, stroke, icon }`.
- Habitaciones: Living, Comedor, Baño, Cocina, Dormitorio, Garage, Oficina.
- Estructurales: Muro (línea gruesa), Puerta (arco), Ventana (rect con líneas),
  Escalera (líneas paralelas).
- Cada bloque se instancia como objeto Fabric con `cornerStyle: "circle"`,
  `hasRotatingPoint: true`, `transparentCorners: false`.

**`sketch-export.ts`** (exportación)
- `exportToPng(canvas: fabric.Canvas, dpr: number): string`
- Llama `canvas.toDataURL({ format: "png", multiplier: dpr, enableRetinaScaling: true })`.
- Antes de exportar, **deselecciona todo** (`canvas.discardActiveObject()`) para
  que los handles de selección no aparezcan en el PNG final.
- Asegura fondo blanco (configurado en `backgroundColor` del canvas) para
  coincidir con el output actual (canvas actual pinta blanco).

---

## 4. Estrategia de Responsividad

### Dimensiones del canvas
- El stage usa `ResizeObserver` sobre su contenedor.
- Ancho: 100% del contenedor (como hoy).
- Alto: por breakpoint vía CSS en `sketch-editor.css`:
  ```css
  .sketch-stage { height: 320px; }                /* móvil */
  @media (min-width: 640px)  { .sketch-stage { height: 400px; } }
  @media (min-width: 768px)  { .sketch-stage { height: 450px; } }
  @media (min-width: 1280px) { .sketch-stage { height: 500px; } }
  ```
- La prop `height` actual se respeta como **override** cuando se pasa
  explícitamente (consumidores la pasan). Se aplica vía clase CSS modificadora
  `.sketch-stage--h-{value}` generada, no inline style.

### Escalado del contenido al resize
- Al cambiar el tamaño del stage, se guarda el `viewportTransform` actual,
  se reajusta el ancho/alto del canvas Fabric y se recompone el viewport para
  mantener el centro y el zoom. Así un plano armado en desktop se ve igual
  (proporcionalmente) en tablet.
- `devicePixelRatio` se aplica vía `enableRetinaScaling: true` de Fabric
  (equivalente al `ctx.scale(dpr, dpr)` actual).

### Touch / stylus
- Fabric v6 soporta pointer events nativamente (mouse + touch + pen).
- Se configura `canvas.selection = true` y `preserveObjectStacking = true`.
- En móvil se desactivan efectos hover (CSS `@media (hover: none)`).

---

## 5. Estrategia de Exportación (cero impacto en backend)

### Contrato a mantener
```
onSave(dataUrl: string)
donde dataUrl === "data:image/png;base64,...."
```

### Pasos del export (`sketch-export.ts`)
1. `canvas.discardActiveObject()` — quitar handles de selección.
2. `canvas.renderAll()`.
3. `const dataUrl = canvas.toDataURL({ format: "png", multiplier: dpr,
   enableRetinaScaling: true })`.
4. Devolver `dataUrl` (string base64 PNG).
5. El consumidor lo envía a `/api/inspection/sketch` sin cambios.

### Verificación de paridad
- Se comparará el output de un croquis simple (un rectángulo) generado con el
  canvas viejo vs el nuevo: ambos deben producir un `data:image/png;base64,`
  válido y decodificable a un PNG de dimensiones equivalentes.
- El backend solo valida `sketchDataUrl` truthy y lo convierte con
  `fetch(sketchDataUrl).blob()`. Cualquier PNG base64 válido funciona.

---

## 6. Compatibilidad Hacia Atrás (croquis antiguos)

### Escenario
Un `damage_sketch` existente tiene `sketch_url` apuntando a un PNG raster
(generado por el canvas viejo). Al editar, se pasa `initialImage={sketch_url}`.

### Estrategia
- `sketch-editor.tsx` recibe `initialImage`.
- Si existe, crea un `fabric.Image` desde la URL y lo agrega como **capa de
  fondo bloqueada**:
  ```ts
  fabric.Image.fromURL(initialImage, (img) => {
    img.set({ selectable: false, evented: false, hoverCursor: "default" });
    canvas.backgroundImage = img;
    canvas.renderAll();
  });
  ```
- El usuario puede colocar bloques vectoriales **encima** del fondo raster.
- Al exportar, el fondo se incluye en el PNG (Fabric renderiza
  `backgroundImage` en `toDataURL`).
- `crossOrigin = "anonymous"` para evitar tainted canvas (R2 envía CORS
  headers correctos — verificar en implementación).

### Nota
No se "vectoriza" el croquis antiguo. Se respeta como referencia de fondo.
El nuevo guardado genera un PNG nuevo que reemplaza al anterior en R2 (el
endpoint ya soporta `sketchId` para update).

---

## 7. Diseño UI/UX (cumplimiento DESIGN_SYSTEM.md)

### Reglas aplicadas
- **Botones:** todos `pg-btn-platinum` (clase de `buttons.css`), texto 1 palabra.
- **Inputs (color, grosor):** `app-input`. Labels `app-field-label`.
- **Sin checkboxes:** se usan toggles/eye icons si se necesita (no aplica aquí).
- **Iconos:** `lucide-react` únicamente (PenTool, Square, Circle, DoorOpen,
  etc.). Cero emojis.
- **Sin inline styles:** toda estilización en `sketch-editor.css`. Excepción
  permitida: valores dinámicos (ej. posición de tooltip calculada) — no se
  prevén necesarios.
- **Idioma:** español neutro ("Seleccionar", "Mano", "Deshacer", "Rehacer",
  "Limpiar", "Guardar", "Living", "Comedor", "Baño", "Cocina", "Muro",
  "Puerta", "Ventana"). Sin argentinismos.
- **Dark/Light mode:** variables CSS del tema (`--background`, `--border`,
  `--primary`, etc.). La toolbar y el stage heredan el tema del consumidor.
  La página magic link (slate oscuro) y el dashboard (claro) renderizan el
  mismo componente sin variantes — Fabric usa colores del CSS vars para
  los handles.

### Layout responsivo del editor
```
┌─────────────────────────────────────────────────┐
│  Toolbar (pg-btn-platinum + app-input)          │
├──────────┬──────────────────────────────────────┤
│ Paleta   │  Stage (canvas Fabric)               │
│ bloques  │                                      │
│ (scroll) │                                      │
│          │                                      │
└──────────┴──────────────────────────────────────┘
```
- Móvil (<640px): paleta colapsa a un `<Select>` arriba del stage; stage a
  ancho completo.
- Tablet/desktop: paleta lateral izquierda (180px), stage flexible.

---

## 8. Plan de Implementación (FASE 2 — paso a paso)

Cada paso = 1 commit atómico. Tras cada commit: `npx tsc --noEmit` y
`npx eslint` deben dar 0 errores y 0 warnings (REGLA OBLIGATORIA).

### Commit 1 — Dependencia y scaffolding
- `pnpm add fabric@^6.x` (verificar `minimumReleaseAge`).
- Crear `src/features/inspection-sketch/` con archivos vacíos + tipos base
  (`sketch-types.ts`, `sketch-blocks.ts` con catálogo).
- `npx tsc --noEmit` pasa.

### Commit 2 — Stage responsivo con Fabric
- `sketch-canvas-stage.tsx`: contenedor + `ResizeObserver` + init/dispose
  de `fabric.Canvas`.
- `sketch-editor.css`: clases `.sketch-stage`, breakpoints de altura.
- Render mínimo: canvas blanco, sin toolbar aún.
- Verificar en ambos consumidores (temporalmente cableado en
  `drawing-canvas.tsx` tras el commit 6).

### Commit 3 — Exportación a PNG base64
- `sketch-export.ts`: `exportToPng()` con `discardActiveObject` + `toDataURL`.
- Test manual: un rect agregado programáticamente → export → validar
  `data:image/png;base64,`.

### Commit 4 — Toolbar (UI)
- `sketch-toolbar.tsx`: botones `pg-btn-platinum` (Seleccionar, Mano,
  Deshacer, Rehacer, Limpiar, Guardar), color y grosor con `app-input`.
- Cablear al canvas: modos `select`/`draw`, undo/redo sobre stack de objetos,
  `clear` (remueve todos los objetos), `save` (llama `exportToPng` → `onSave`).

### Commit 5 — Paleta de bloques + drag & drop
- `sketch-blocks-palette.tsx`: lista de bloques con iconos lucide.
- Drag & drop HTML5 → crear objeto Fabric en posición del drop.
- Cada bloque: `cornerStyle: "circle"`, `hasRotatingPoint: true`.
- Responsive: paleta lateral en desktop, `<Select>` en móvil.

### Commit 6 — Compatibilidad hacia atrás (initialImage)
- `sketch-editor.tsx`: cargar `initialImage` como `backgroundImage` bloqueado.
- `crossOrigin = "anonymous"`.
- Verificar edición de un croquis existente en ambos consumidores.

### Commit 7 — Wrapper y migración de consumidores
- Reescribir `src/components/ui/drawing-canvas.tsx` como wrapper delgado
  que renderiza `<SketchEditor .../>` con el MISMO contrato de props.
- Los 2 consumidores (`sketches-tab.tsx`, `inspection/[token]/page.tsx`)
  **no se modifican** (verificar que siguen compilando sin cambios).
- Borrar el código raster viejo (353 líneas) — no se conserva como fallback
  para no acumular código muerto (REGLA de Cero Redundancia).

### Commit 8 — Limpieza y verificación final
- `npx tsc --noEmit` → 0 errores.
- `npx eslint` → 0 errores, 0 warnings.
- `pnpm build` → success.
- Revisión manual en dev: crear plano con 4 habitaciones + 2 muros +
  1 puerta → guardar → validar PNG en R2 → reabrir para editar.
- Verificar magic link (asegurado) en tema oscuro.

---

## 9. Verificación de Reglas del Proyecto

| Regla | Cumplimiento |
|---|---|
| REGLA #1 (no borrar datos) | ✅ No toca BD. El endpoint update ya existe. |
| REGLA #2 (cero inline styles) | ✅ Todo en `sketch-editor.css`. Excepción solo para valores dinámicos (no previstos). |
| Cero errores/warnings tsc+eslint | ✅ Verificado en cada commit. |
| Cero redundancia | ✅ Se elimina el canvas raster viejo (commit 7). |
| Diseño (DESIGN_SYSTEM.md) | ✅ `pg-btn-platinum`, `app-input`, `app-field-label`, lucide, sin emojis, español neutro. |
| Responsividad (5 breakpoints) | ✅ CSS en `sketch-editor.css` + `ResizeObserver`. |
| Multi-tenant / seguridad | ✅ Sin cambios en backend ni RLS. |
| Sin mocks | ✅ Fabric real desde el commit 1. |

---

## 10. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Fabric v6 incompatible con React 19 Strict Mode (doble montaje) | Media | Ref guard + `dispose()` en cleanup del `useEffect`. |
| Tainted canvas al cargar `initialImage` (CORS) | Baja | R2 envía CORS headers; usar `crossOrigin="anonymous"`. Verificar en commit 6. |
| Bundle size (+140kB) | Baja | Fabric v6 tree-shakeable; solo se importa lo usado. |
| Touch en iPad no fluido | Media | Fabric v6 soporta pointer events; testear en dev con simulación touch. |
| Handles de selección visibles en el PNG exportado | Baja | `discardActiveObject()` antes de `toDataURL` (commit 3). |

---

## 11. Fuera de Alcance (no se incluye en esta migración)

- Vectorización automática de croquis raster antiguos (se cargan como fondo).
- Persistencia del modelo vectorial (JSON de Fabric) en BD — el backend
  sigue recibiendo solo PNG. (Podría añadirse después como columna opcional
  `sketch_vector_json` si se quiere re-edición sin pérdida, pero requiere
  migración y no está en este alcance.)
- Capas nombradas / agrupación avanzada de objetos.
- Export a SVG (el backend espera PNG).
- Plantillas de plano prearmadas.

---

## 12. Criterio de Aceptación de la FASE 2

- [ ] Un inspector puede arrastrar "Living", "Comedor", "Baño", "Cocina" al
      canvas y posicionarlos en <30s.
- [ ] Resize desde esquinas y rotación funcionan con mouse y touch.
- [ ] El botón "Guardar" produce un PNG base64 que sube a R2 sin cambios en
      `/api/inspection/sketch`.
- [ ] Editar un croquis existente muestra el PNG viejo de fondo y permite
      agregar bloques encima.
- [ ] Funciona en móvil (375px), tablet (768px) y desktop (1280px+).
- [ ] Funciona en tema claro (dashboard) y oscuro (magic link).
- [ ] `tsc` y `eslint` en 0/0.
- [ ] `pnpm build` exitoso.

---

> **🛑 PUNTO DE DETENCIÓN.**
> Este documento queda en revisión. No se iniciará la FASE 2 ni se modificará
> ningún archivo de código fuente hasta la aprobación explícita del usuario.
