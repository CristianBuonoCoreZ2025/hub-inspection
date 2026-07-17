# ⚠️ SISTEMA DE DISEÑO OBLIGATORIO — LEER ANTES DE TOCAR CUALQUIER PÁGINA

> **ESTE ARCHIVO ES LA LEY.** Cualquier cambio en cualquier página `.tsx` DEBE
> cumplir estas reglas. Si una página no cumple, se arregla ANTES de hacer
> cualquier otra cosa. No se agregan nuevas páginas que no cumplan.

---

## 1. Botones

### Clase obligatoria
```tsx
className="pg-btn-platinum"
```

### Reglas
- **TODOS** los botones usan `pg-btn-platinum`. Sin excepciones.
- **NO** usar: `btn-danger`, `btn-neutral`, `btn-cancel`, `btn-close`,
  `btn-skip`, `btn-save`, `btn-create`, `liquid-button`, `liquid-button-outline`.
- Botones de icono en grilla: `className="btn-neutral btn-icon"` (ghost + icon).
- Botones de eliminar en grilla: `className="btn-danger btn-icon"` (ghost + icon rojo).
- **NUNCA** un `<Button>` sin `className`.
- **NUNCA** dos atributos `className` en el mismo elemento JSX.

### Texto de botones
- **Una palabra**: "Guardar", "Cerrar", "Cancelar", "Crear", "Nuevo", "Editar".
- **NUNCA** frases de 2+ palabras como "Guardar Configuración" o "Crear Nuevo Registro".
- Si la acción necesita claridad, usar tooltip o icono, no texto largo.

---

## 2. Selects / Dropdowns (combobox)

### Componente
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
```

## 2. Selects / Dropdowns / Combobox / Popovers

### Componentes
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
```

### Reglas OBLIGATORIAS para TODOS los popups (Select, DropdownMenu, Popover)
- **SIEMPRE** se despliegan hacia abajo (`side="bottom"`).
- `sideOffset={0}` — pegado al trigger, sin gap.
- `positionMethod="fixed"` — escapa de contenedores con overflow.
- `Portal` — renderiza en `<body>`, no dentro del modal.
- `z-9999` — sobre todo, incluido modals.
- `collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "none" }}`.
- **NO** usar `isolate` en el Positioner ni en el Popup (crea stacking context que atrapa el z-index).
- `max-h-(--available-height)` — altura dinámica según espacio disponible.
- Mínimo 20 items visibles sin scroll.

### Select Trigger
```tsx
<SelectTrigger className="app-input h-7">
  <SelectValue placeholder="Seleccionar..." />
</SelectTrigger>
```

### DropdownMenu Trigger
```tsx
<DropdownMenuTrigger asChild>
  <Button className="pg-btn-platinum">Acciones</Button>
</DropdownMenuTrigger>
```

### Popover Trigger
```tsx
<PopoverTrigger asChild>
  <Button className="pg-btn-platinum">Abrir</Button>
</PopoverTrigger>
```

### Regla
> **TODOS** los popups (Select, DropdownMenu, Popover) siguen las mismas reglas:
> Portal + fixed + z-9999 + sideOffset=0 + sin isolate. NINGÚN popup se renderiza
> dentro del modal sin Portal.

---

## 3. Inputs y Formularios

### Clases obligatorias
```tsx
className="app-input"        // inputs de texto, número, fecha
className="app-field-label"  // labels de campos
```

### Reglas
- **TODOS** los inputs usan `app-input`.
- **TODOS** los labels usan `app-field-label`.
- **NO** usar `liquid-search` (deprecado).
- Altura estándar: `h-7` (28px) en inputs dentro de modals y toolbars.
- Placeholders en español, cortos y descriptivos.

---

## 4. Modals / Diálogos

### Estructura obligatoria
```tsx
<Dialog open={open} onOpenChange={setOpen} dismissible={false}>
  <DialogContent className="modal-md" showCloseButton={false}>
    <div className="modal-header">
      <DialogTitle className="modal-title">Título</DialogTitle>
    </div>
    <div className="modal-body space-y-2">
      {/* campos */}
    </div>
    <div className="modal-footer">
      <Button className="pg-btn-platinum" onClick={...}>Cerrar</Button>
      <Button className="pg-btn-platinum" onClick={...}>Guardar</Button>
    </div>
  </DialogContent>
</Dialog>
```

### Reglas
- `dismissible={false}` — no se cierra al hacer clic fuera.
- `showCloseButton={false}` — el cierre es manual via botón.
- Tamaños: `modal-sm`, `modal-md`, `modal-lg`, `modal-xl`.
- Header con icono + título + subtítulo opcional.
- Footer con botones `pg-btn-platinum`.
- **NO** usar `isolate` en el overlay del Dialog.

---

## 5. Grillas / Tablas

### Estructura
```tsx
<div className="app-panel">
  <Pagination ... />
  <div className="app-data-table-wrap">
    <table className="app-data-table">
      <thead>...</thead>
      <tbody>...</tbody>
    </table>
  </div>
  <Pagination ... />
</div>
```

### Reglas
- Tabla dentro de `app-panel` con `app-data-table-wrap`.
- `Pagination` arriba y abajo de la tabla.
- `SortableTh` para columnas ordenables.
- `StatusBadge` para estados (activo/inactivo).
- Acciones de fila: iconos `btn-neutral btn-icon` (editar) y `btn-danger btn-icon` (eliminar).
- `app-row-actions` como contenedor de acciones de fila.

---

## 5b. Tiles de Selección (estilo daños)

### Cuándo usar
Cuando el usuario debe elegir entre 2+ categorías visuales antes de un formulario.

### Estructura
```tsx
<div className="grid grid-cols-2 gap-3">
  <button className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left
    transition-all hover:border-blue-400/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
      bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400
      transition-colors group-hover:bg-blue-500 group-hover:text-white">
      <Icon className="h-5 w-5" />
    </div>
    <div className="min-w-0">
      <div className="text-[13px] font-semibold text-foreground">Título</div>
      <div className="text-[11px] text-muted-foreground truncate">Descripción</div>
    </div>
  </button>
</div>
```

### Reglas
- Grid de 2 columnas en desktop, 1 en móvil.
- Cada tile: icono en círculo de color + título + descripción.
- Hover: borde se ilumina + fondo tintado + icono se invierte (fondo color, texto blanco).
- Colores por categoría: azul (constructivo), violeta (contenido), etc.
- NO usar `pg-btn-platinum` para estos botones.

---

## 5c. Badges de Severidad (estilo daños)

### Colores obligatorios
```tsx
// Total — rojo
"bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
// Grave — naranja
"bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
// Moderado — ámbar
"bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
// Leve — esmeralda
"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
```

### Reglas
- SIEMPRE con dark mode (`dark:bg-*-900/50 dark:text-*-300`).
- Texto `text-[11px] font-medium px-2 py-0.5 rounded-full`.

---

## 5d. VoiceTextarea (editor enriquecido)

### Cuándo usar
En campos de texto largo que requieren formato o transcripción por voz
(Relato de los Hechos, Observaciones del Inspector).

### Toolbar
- Negrilla (Ctrl+B), Cursiva (Ctrl+I), Listas, Corrección ortográfica, Micrófono
- Solo mostrar micrófono si el navegador soporta SpeechRecognition

### Reglas
- Mínimo 5 filas (`rows={5}`)
- `contentEditable` con `spellCheck` nativo
- Placeholder cuando vacío (`empty:before:content-[attr(data-placeholder)]`)
- Guarda HTML (no texto plano)

---

## 5e. Magic Link Sender

### Botones de envío
- **WhatsApp (wa.me)**: link pre-llenado, sin backend
- **Enviar WA (Cloud API)**: via `/api/send-magic-link` (Meta API)
- **Email (Resend)**: via `/api/send-magic-link` (Resend API)
- **Copiar**: `navigator.clipboard.writeText`

### Variables de entorno
```
WHATSAPP_PHONE_NUMBER_ID=xxx
WHATSAPP_ACCESS_TOKEN=xxx
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@tudominio.com
```

### Reglas
- Si no hay teléfono → botón WhatsApp deshabilitado
- Si no hay email → botón Email deshabilitado
- Si API no configurada → mensaje de usar alternativa (wa.me)

---

## 6. Filtros de Grilla

### Formato unificado (estándar polizas/page.tsx)
```tsx
<div className="app-toolbar">
  <div className="flex items-center gap-2">
    <div className="relative w-[160px] shrink-0">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input placeholder="Buscar..." className="app-input pl-9" />
    </div>
    <SelectTrigger className="app-input h-7 w-[180px]">...</SelectTrigger>
  </div>
</div>
```

### Reglas
- Buscador con icono `Search` de lucide-react.
- `app-input` en todos los filtros (no `liquid-search`).
- Selects de filtro con `w-[180px]` o `w-[200px]`.
- Contenedor `app-toolbar`.

---

## 7. Iconos

### Librería
```tsx
import { ... } from "lucide-react";
```

### Reglas
- **SIEMPRE** lucide-react. Nunca emojis ni iconos de otras librerías.
- Tamaño estándar: `h-4 w-4` (16px) en botones y acciones.
- Tamaño encabezado: `h-5 w-5` (20px) en headers de página.
- Tamaño modal header: `h-4 w-4` (16px).

### Iconos por categoría
- Página: `Boxes`, `Warehouse`, `Home`, `Shield`, `Building`, etc.
- Acción editar: `Pencil`
- Acción eliminar: `Trash2`
- Acción configurar: `Settings2`
- Visible/oculto: `Eye` / `EyeOff`
- Bloqueado: `Lock`
- Buscar: `Search`

---

## 8. Checkboxes

### Regla CRÍTICA
- **NO USAR CHECKBOXES** en la interfaz. El usuario lo ha prohibido explícitamente.
- Para toggles de visibilidad: usar iconos `Eye` / `EyeOff`.
- Para toggles booleanos: usar `ToggleChip`.
- Para selección múltiple: usar chips o botones con estado visual.

---

## 9. Páginas de Catálogo (CRUD estándar)

### Estructura obligatoria
```tsx
export default function XxxPage() {
  // hooks: useQuery, useMutation, usePagination, useTableSort, usePermissions
  // estado: search, open, editingId, formData
  // mutaciones: create, update, delete
  // filtered + sorted + paginated

  return (
    <div className="app-page">
      <div className="app-page-header">
        {/* icono + título + descripción + botón "Nueva" */}
      </div>
      <div className="app-toolbar">
        {/* buscador + filtros */}
      </div>
      <div className="app-panel">
        <Pagination ... />
        <div className="app-data-table-wrap">
          <table className="app-data-table">...</table>
        </div>
        <Pagination ... />
      </div>
      <Dialog>...</Dialog>
    </div>
  );
}
```

### Reglas
- Header con icono de categoría (40x40px, gradiente, redondeado).
- Título + descripción + botón "Nueva" (si canCreate).
- Toolbar con buscador.
- Tabla con StatusBadge, acciones por fila.
- Modal de creación/edición con `modal-md`.
- Permisos: `canCreate`, `canEdit`, `canDelete` de `usePermissions`.

---

## 10. Configuración Dinámica de Campos (field_config)

### Concepto
Las páginas de **Clasificación del Bien** y **Destinos de Vivienda** tienen
configuración dinámica de campos del acta de inspección. Esto se guarda en
la columna `field_config` (JSONB) de la base de datos.

### Estructura del JSON
```json
{
  "show": ["floor_count", "built_surface", ...],
  "hide": ["apartment_number", ...],
  "labels": { "age_years": "Antigüedad del Producto" }
}
```

### Reglas
- **TODO** a nivel base de datos. NUNCA hardcoded en archivos.
- El `FieldConfigEditor` es una matriz con iconos `Eye`/`EyeOff` (sin checkboxes).
- Campos base siempre visibles: `age_years`, `owner_name`, `worker_resident_count`.
- Merge: base + classification.show + destination.show - hides.
- Labels: classification.labels > destination.labels > default.
- El `acta-form.tsx` lee `field_config` dinámicamente desde la BD.

---

## 11. Estilos CSS

### Archivos de estilo
```
src/app/globals.css              — variables globales, reset
src/app/styles/buttons.css       — pg-btn-platinum y variantes
src/app/styles/forms.css         — app-input, app-field-label
src/app/styles/modals.css        — modal-md, modal-header, modal-footer
src/app/styles/components.css    — app-panel, app-data-table, app-toolbar
src/app/styles/dashboard.css     — layout del dashboard
src/app/styles/animations.css    — animaciones de entrada/salida
src/app/ui-style-skins.css       — skins/temas visuales
```

### Reglas
- Usar clases semánticas (`app-*`, `modal-*`, `pg-btn-*`).
- **NO** usar Tailwind arbitrario para cosas que ya tienen clase semántica.
- Tailwind solo para layout (flex, grid, gap, w-, h-).

---

## 12. Stacking Context y z-index

### Jerarquía de z-index
```
z-9999  — Select dropdown (Positioner con Portal)
z-50    — Dialog overlay y popup
z-50    — Dropdown menu, Popover
```

### Reglas CRÍTICAS
- **NO** usar `isolate` en overlays, positioners o popups.
- `isolate` crea un stacking context que atrapa los z-index.
- El Select usa `Portal` para renderizar en `<body>` y escapar del modal.
- El Dialog overlay es `z-50` sin `isolate`.

---

## 13. Permisos

### Hook
```tsx
const { canCreate, canEdit, canDelete } = usePermissions();
```

### Reglas
- Todo botón de acción verifica permisos.
- `canCreate("catalogos")` para botón "Nueva".
- `canEdit("catalogos")` para botón editar.
- `canDelete("catalogos")` para botón eliminar.

---

## 14. Idioma

- **TODO** en español (Chile).
- Labels, placeholders, mensajes de toast, títulos.
- NUNCA mezclar inglés y español.

---

## 15. Toast / Notificaciones

```tsx
import { toast } from "sonner";

toast.success("X creado");
toast.error(err.message);
```

### Reglas
- Mensajes cortos: "X creado", "X actualizado", "X desactivado".
- `onSuccess` de mutaciones siempre muestra toast.
- `onError` muestra `err.message`.

---

## 16. Paginación

```tsx
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/use-pagination";

const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);
```

### Reglas
- `Pagination` arriba y abajo de la tabla.
- `usePagination` recibe los datos ya filtrados y ordenados.

---

## 17. Ordenamiento de Tablas

```tsx
import { SortableTh } from "@/components/ui/sortable-th";
import { useTableSort } from "@/hooks/use-table-sort";

const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
  name: (c) => c.name,
  description: (c) => c.description,
}, "name");
```

### Reglas
- `SortableTh` para columnas ordenables.
- `useTableSort` recibe `filtered` y un mapa de sorters.

---

## CHECKLIST ANTES DE MODIFICAR CUALQUIER PÁGINA

```
□ ¿Leí docs/DESIGN_SYSTEM.md? (ESTE ARCHIVO)
□ ¿Los botones usan pg-btn-platinum?
□ ¿Los inputs usan app-input?
□ ¿Los labels usan app-field-label?
□ ¿Los selects usan Portal + positionMethod="fixed" + z-9999?
□ ¿No hay checkboxes?
□ ¿Los textos de botones son de 1 palabra?
□ ¿Los iconos son de lucide-react?
□ ¿No hay isolate en overlays/positioners?
□ ¿Todo está en español?
□ ¿Los permisos están verificados?
□ ¿npx tsc --noEmit pasa sin errores?
□ ¿npx eslint pasa sin errores ni warnings?
```

**Si cualquier item del checklist falla, NO se considera terminado.**
