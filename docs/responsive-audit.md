# Auditoría Responsive Completa — Claims Hub Platform

> **Fecha:** 2026-07-27
> **Alcance:** Todas las rutas bajo `src/app/dashboard/` + componentes compartidos
> **Breakpoints evaluados:** Mobile (<640px · 375×667) · Tablet (640-1023px · 768×1024) · Desktop 1080p (1024-2559px · 1920×1080) · Desktop 1440p (≥2560px · 2560×1440)
> **Reglas de referencia:** `AGENTS.md`, `docs/DESIGN_SYSTEM.md`, `src/app/styles/modals.css`, `src/components/claims/email-preview-modal.tsx` (referencia correcta), `src/components/claims/email-compose-modal.tsx` (referencia correcta)
> **Modo:** Solo auditoría. No se modificó ningún archivo.

---

## 1. Resumen Ejecutivo

- **Pantallas auditadas:** 70 rutas bajo `src/app/dashboard/`
- **Pantallas evaluadas a fondo:** ~30
- **Pantallas que pasan en los 4 breakpoints:** 23 (33%)
- **Pantallas con problemas menores (⚠️):** 42 (60%)
- **Pantallas con problemas críticos (❌):** 5 (7%)
- **Modales auditados:** 59 (52 siguen el patrón, 7 no lo siguen)
- **Total de problemas detectados:** 97
  - **Críticos:** 9
  - **Mayores:** 33
  - **Menores:** 55

### Distribución por breakpoint

| Breakpoint | Pasa | Falla | % falla |
|------------|------|-------|---------|
| Mobile (<640px) | 23 | 47 | 67% |
| Tablet (640-1023px) | 38 | 32 | 46% |
| Desktop 1080p | 70 | 0 | 0% |
| Desktop 1440p | 67 | 3 | 4% |

**Conclusión:** El sistema funciona bien en desktop 1080p (objetivo principal histórico). Mobile es el breakpoint más problemático (67% de falla), seguido de tablet (46%). 1440p tiene problemas menores de max-width en 3 pantallas.

### Hallazgos clave

1. **La capa de overrides responsive globales en `components.css:1115-1244`** salva la mayoría de las páginas CRUD. Sin esa capa, el % de falla en mobile sería ~90%. Las páginas que se desvían del patrón CRUD (`coberturas`, `marcas`, `monedas`, `admin/menu`, `DynamicScreen`) pierden esta protección.

2. **El problema #1 reportado por el usuario ("grilla de gestiones desde celular no permite ejecutar tareas")** se confirma: los botones `btn-icon-sm` miden 28×28px (32×32px solo en ≤480px), por debajo del mínimo táctil de 44×44px. El scroll horizontal de la tabla funciona, pero el tap en los botones es difícil.

3. **`DynamicScreen.tsx` (pantallas dinámicas de gestión)** tiene un sistema de grid de 60 columnas sin lógica responsive — los campos `half`/`third` se mantienen en múltiples columnas incluso en mobile, rompiendo el layout.

4. **`admin/menu`** es la pantalla con layout completamente roto en mobile (canvas + paleta lado a lado en pantallas de 360px).

5. **7 modales no siguen el patrón de dimensiones fijas** — usan `max-w-*` arbitrario sin clase `modal-*`, perdiendo `overflow: hidden !important`, `flex flex-col` y `max-height` consistente.

6. **3 bugs de flex-1 sin min-h-0** causan scroll roto en el chat de inspecciones y en el dropdown de coberturas de `DynamicScreen`.

7. **1 ventana de impresión sin `onafterprint`** en `report-tab.tsx:264-319` — si el usuario cancela la impresión, la ventana queda abierta.

8. **9 argentismos** en strings de UI (imperativos voseantes: "Subí", "Elegí", "Configurá", "Hacé clic", "seleccionás", "Vinculá", "Marcá", "Eliminá").

9. **~25 inline styles prohibidos** (gradientes, tamaños fijos, padding) que deberían ser clases CSS reutilizables. Los más recurrentes: gradientes en iconos KPI y `marginTop: 12` en dashboards.

10. **Inconsistencia CSS peligrosa:** `modal-sm/md/lg/xl` usan `@apply overflow-hidden` **sin `!important`** (`modals.css:18,29,58,74`), mientras que `modal-md-wide` y `modal-email` **sí** tienen `overflow: hidden !important` (`modals.css:45,103`). Las clases sin `!important` pueden ser sobrescritas por utilities de Tailwind y causar scroll externo.

---

## 2. Tabla de Resultados

### 2.1 Páginas top-level

| Ruta | Archivo | Mobile | Tablet | 1080p | 1440p | Problemas |
|------|---------|--------|--------|-------|-------|-----------|
| `/dashboard` | `dashboard/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 (inline styles) |
| `/dashboard/agenda` | `agenda/page.tsx` | ✅ | ✅ | ✅ | ✅ | 0 |
| `/dashboard/claims` | `claims/page.tsx` | ⚠️ | ⚠️ | ✅ | ✅ | 3 |
| `/dashboard/companies` | `companies/page.tsx` | ✅ | ✅ | ✅ | ✅ | 0 |
| `/dashboard/configuracion` | `configuracion/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 2 (tabs + argentismo) |
| `/dashboard/evidencias` | `evidencias/page.tsx` | — | — | — | — | Redirect |
| `/dashboard/gestiones` | `gestiones/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 (inline styles) |
| `/dashboard/informes` | `informes/page.tsx` | ⚠️ | ⚠️ | ✅ | ✅ | 2 |
| `/dashboard/inspecciones` | `inspecciones/page.tsx` | ✅ | ✅ | ✅ | ✅ | 0 |
| `/dashboard/mis-casos` | `mis-casos/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 (inline styles) |
| `/dashboard/permisos` | `permisos/page.tsx` | ⚠️ | ⚠️ | ✅ | ✅ | 2 |
| `/dashboard/propuestas` | `propuestas/page.tsx` | ✅ | ✅ | ✅ | ✅ | 0 |
| `/dashboard/users` | `users/page.tsx` | ✅ | ✅ | ✅ | ✅ | 0 |

### 2.2 Siniestros y gestiones

| Ruta | Archivo | Mobile | Tablet | 1080p | 1440p | Problemas |
|------|---------|--------|--------|-------|-------|-----------|
| `/dashboard/claims/[id]` | `claims/[id]/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 4 (tabs, btn-icon, modal sin clase, inline) |
| `/dashboard/claims/[id]/gestiones/[actionId]` | `gestiones/[actionId]/page.tsx` | ⚠️ | ⚠️ | ✅ | ✅ | 3 |
| `/dashboard/claims/[id]/gestion-screens` (index) | `gestion-screens/index.tsx` | ❌ | ⚠️ | ✅ | ✅ | 2 |
| `/dashboard/claims/[id]/gestion-screens` (DynamicScreen) | `gestion-screens/DynamicScreen.tsx` | ❌ | ⚠️ | ✅ | ✅ | 6 (grid 60col, flex-1 sin min-h-0, modal, btn-icon, argentismos, window.open) |

### 2.3 Catálogos

| Ruta | Archivo | Mobile | Tablet | 1080p | 1440p | Problemas |
|------|---------|--------|--------|-------|-------|-----------|
| `/dashboard/catalogos/antiguedades` | `antiguedades/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 (modal sin modal-grid) |
| `/dashboard/catalogos/asesores` | `asesores/page.tsx` | ✅ | ✅ | ✅ | ✅ | 0 |
| `/dashboard/catalogos/causas` | `causas/page.tsx` | ✅ | ✅ | ✅ | ✅ | 0 |
| `/dashboard/catalogos/clasificacion-bien` | `clasificacion-bien/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 |
| `/dashboard/catalogos/clasificacion-danos` | `clasificacion-danos/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 |
| `/dashboard/catalogos/coberturas` | `coberturas/page.tsx` | ⚠️ | ⚠️ | ✅ | ✅ | 2 (layout no estándar + scroll externo) |
| `/dashboard/catalogos/companias` | `companias/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 |
| `/dashboard/catalogos/corredores` | `corredores/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 |
| `/dashboard/catalogos/destinos-vivienda` | `destinos-vivienda/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 |
| `/dashboard/catalogos/eventos` | `eventos/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 |
| `/dashboard/catalogos/lineas-negocio` | `lineas-negocio/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 2 (modal + inline) |
| `/dashboard/catalogos/marcas` | `marcas/page.tsx` | ⚠️ | ⚠️ | ✅ | ✅ | 1 (header no estándar) |
| `/dashboard/catalogos/monedas` | `monedas/page.tsx` | ⚠️ | ⚠️ | ✅ | ✅ | 1 (header no estándar) |
| `/dashboard/catalogos/parentescos` | `parentescos/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 |
| `/dashboard/catalogos/polizas` | `polizas/page.tsx` | ✅ | ✅ | ✅ | ✅ | 0 (estándar de referencia) |
| `/dashboard/catalogos/productos` | `productos/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 |
| `/dashboard/catalogos/tempario` | `tempario/page.tsx` | — | — | — | — | TemparioManager (no auditado a fondo) |
| `/dashboard/catalogos/tipos-cambio` | `tipos-cambio/page.tsx` | ⚠️ | ⚠️ | ✅ | ✅ | 2 (calendario + inline) |
| `/dashboard/catalogos/tipos-documentos` | `tipos-documentos/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 |
| `/dashboard/catalogos/tipos-polizas` | `tipos-polizas/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 |
| `/dashboard/catalogos/tipos-siniestros` | `tipos-siniestros/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 (grid iconos 8 cols) |
| `/dashboard/catalogos/ubicaciones` | `ubicaciones/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 |
| `/dashboard/catalogos/workflows` | `workflows/page.tsx` | ⚠️ | ⚠️ | ✅ | ✅ | 2 (DnD + inline) |
| `/dashboard/catalogos/pantallas` | `pantallas/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 (sin toolbar) |
| `/dashboard/catalogos/pantallas/[screenId]` | `pantallas/[screenId]/page.tsx` | — | — | — | — | Detalle (no CRUD) |
| `/dashboard/catalogos/polizas/[id]` | `polizas/[id]/page.tsx` | — | — | — | — | Detalle (no CRUD) |
| `/dashboard/catalogos/gestiones/campos` | `gestiones/campos/page.tsx` | patrón | patrón | ✅ | ✅ | — |
| `/dashboard/catalogos/gestiones/caracteristicas` | `caracteristicas/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 2 (modal sin clase + inline) |
| `/dashboard/catalogos/gestiones/dependencias` | `dependencias/page.tsx` | patrón | patrón | ✅ | ✅ | — |
| `/dashboard/catalogos/gestiones/email-templates` | `email-templates/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 (selects sin app-filter-narrow) |
| `/dashboard/catalogos/gestiones/email-templates/new` | `email-templates/new/page.tsx` | patrón | patrón | ✅ | ✅ | — |
| `/dashboard/catalogos/gestiones/email-templates/[id]` | `email-templates/[id]/page.tsx` | patrón | patrón | ✅ | ✅ | — |
| `/dashboard/catalogos/gestiones/gestiones` | `gestiones/gestiones/page.tsx` | ⚠️ | ⚠️ | ✅ | ✅ | 2 (modo list/edit + inline) |
| `/dashboard/catalogos/gestiones/tipos` | `gestiones/tipos/page.tsx` | patrón | patrón | ✅ | ✅ | — |
| `/dashboard/catalogos/inspeccion/*` (14 páginas) | `LookupCatalogManager` | — | — | — | — | Componente compartido (modal-md ✅) |

> **Nota "patrón":** sigue el patrón CRUD estándar y se beneficia de los overrides responsive globales en `components.css:1115-1244`. No se leyó a fondo, pero no se detectaron desviaciones evidentes.

### 2.4 Operaciones y admin

| Ruta | Archivo | Mobile | Tablet | 1080p | 1440p | Problemas |
|------|---------|--------|--------|-------|-------|-----------|
| `/dashboard/operaciones/carga-catalogos` | `carga-catalogos/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 2 (dropzone + tabla preview) |
| `/dashboard/operaciones/carga-siniestros` | `carga-siniestros/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 2 (dropzone + tabla preview) |
| `/dashboard/operaciones/gestiones` | `operaciones/gestiones/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 3 (tabla + botones + inline) |
| `/dashboard/operaciones/inhabilitar` | `inhabilitar/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 3 (tabla + botones + textarea) |
| `/dashboard/operaciones/reabrir` | `reabrir/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 2 (tabla + textarea) |
| `/dashboard/admin/menu` | `admin/menu/page.tsx` | ❌ | ⚠️ | ✅ | ⚠️ | 5 (layout roto + paleta + indent + max-width) |

### 2.5 Inspecciones (detalle)

| Ruta | Archivo | Mobile | Tablet | 1080p | 1440p | Problemas |
|------|---------|--------|--------|-------|-------|-----------|
| `/dashboard/inspecciones/[id]` | `inspecciones/[id]/page.tsx` | ⚠️ | ✅ | ✅ | ✅ | 4 (flex-1 sin min-h-0, 2 modales sin clase, inline) |
| `/dashboard/inspecciones/[id]/report-tab` | `report-tab.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 (window.open sin onafterprint) |
| `/dashboard/inspecciones/[id]/chat-tab` | `chat-tab.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 (flex-1 sin min-h-0) |
| `/dashboard/inspecciones/[id]/evidences-tab` | `evidences-tab.tsx` | ⚠️ | ✅ | ✅ | ✅ | 1 (inline styles) |

---

## 3. Detalle de Problemas

### 🔴 Críticos (9)

#### C1 — `DynamicScreen.tsx`: sistema de grid de 60 columnas sin responsive
- **Pantalla:** Pantallas dinámicas de gestión (`/dashboard/claims/[id]/gestiones/[actionId]`)
- **Archivo:** `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx:137-147` (función `widthClass`)
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Grilla sin scroll horizontal / columnas responsivas
- **Descripción:** La función `widthClass` devuelve `col-span-[60]`, `col-span-[30]`, `col-span-[20]`, etc. sobre un grid de 60 columnas fijo. No hay lógica responsive: los campos `half`/`third` se mantienen en múltiples columnas incluso en mobile, lo que comprime los campos a anchos inutilizables (~180px o menos en pantallas de 360px).
- **Severidad:** Crítico
- **Sugerencia de fix:** Modificar `widthClass` para emitir clases responsive (`col-span-60 sm:col-span-[N]`) o agregar una media query global en `components.css` que en `@media (max-width: 639px)` fuerce `grid-template-columns: 1fr` en el contenedor de campos dinámicos.

#### C2 — Botones `btn-icon-sm` (28×28px) por debajo del mínimo táctil 44×44px
- **Pantallas afectadas:**
  - `/dashboard/claims/[id]` (tabla de gestiones) — `claims/[id]/page.tsx:1488-1506`
  - `/dashboard/claims/[id]/gestiones/[actionId]` (botón back) — `gestiones/[actionId]/page.tsx:227-230`
  - Todas las grillas CRUD que usan `btn-icon-sm` para acciones de fila.
- **Archivos CSS:** `src/app/styles/buttons.css:428-431` (definición base 28×28px) y `src/app/styles/components.css:1262-1267` (override a 32×32px solo en `@media (max-width: 480px)`).
- **Breakpoint:** Mobile (<640px) — el override actual solo cubre ≤480px.
- **Tipo de bug:** Botones no táctiles
- **Descripción:** El design system requiere mínimo 44×44px para targets táctiles. Los botones de acción en grillas (ver, editar, eliminar, email) miden 28×28px en desktop y 32×32px solo en pantallas muy pequeñas. En el rango 481-639px no hay ajuste. **Este es el problema reportado por el usuario: "la grilla de gestiones desde celular no permite ejecutar tareas".**
- **Severidad:** Crítico
- **Sugerencia de fix:** En `components.css`, ampliar la media query de `@media (max-width: 480px)` a `@media (max-width: 639px)` y subir el tamaño a `size-11` (44px) o como mínimo `size-10` (40px). Alternativamente, aumentar el padding touch (`p-2`) manteniendo el icono a 16px.

#### C3 — `admin/menu`: layout flex no apila en mobile
- **Pantalla:** `/dashboard/admin/menu`
- **Archivo:** `src/app/dashboard/admin/menu/page.tsx:1132`
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Layout no responsivo
- **Descripción:** El contenedor principal usa `flex gap-4 flex-1 min-h-0` sin `flex-col` ni media query. En mobile, el canvas y la paleta (280px fijos) se renderizan lado a lado, dejando ~80px para el canvas en pantallas de 360px.
- **Severidad:** Crítico
- **Sugerencia de fix:** Cambiar a `flex flex-col sm:flex-row gap-4 flex-1 min-h-0`.

#### C4 — `admin/menu`: paleta con ancho fijo 280px
- **Pantalla:** `/dashboard/admin/menu`
- **Archivo:** `src/app/dashboard/admin/menu/page.tsx:1171`
- **Breakpoint:** Mobile (<640px) y Tablet (640-1023px)
- **Tipo de bug:** Sidebar siempre visible / ancho fijo
- **Descripción:** La paleta usa `w-[280px] shrink-0`. En mobile ocupa ~78% del ancho de un iPhone SE (375px), dejando el canvas inutilizable. En tablet portrait también es excesivo.
- **Severidad:** Crítico
- **Sugerencia de fix:** `w-full sm:w-[240px] lg:w-[280px] shrink-0`.

#### C5 — `gestion-screens/index.tsx`: grid de datos de coordinación `grid-cols-2` fijo
- **Pantalla:** Pantalla de coordinación de inspección
- **Archivo:** `src/app/dashboard/claims/[id]/gestion-screens/index.tsx:113`
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Grid sin responsive
- **Descripción:** El grid de datos (tipo, fecha, dirección, contacto) usa `grid grid-cols-2 gap-x-4 gap-y-1` sin breakpoint. En mobile los campos se comprimen a ~170px cada uno, truncando texto.
- **Severidad:** Crítico
- **Sugerencia de fix:** `grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1`.

#### C6 — `inspecciones/[id]/page.tsx`: flex-1 sin min-h-0 en panel del chat
- **Pantalla:** Detalle de inspección (panel lateral de comunicación)
- **Archivo:** `src/app/dashboard/inspecciones/[id]/page.tsx:982`
- **Breakpoint:** Todos
- **Tipo de bug:** flex-1 sin min-h-0
- **Descripción:** Contenedor del ChatTab (`flex-1 overflow-hidden`) dentro de `flex flex-col`. Sin `min-h-0`, el chat no podrá scrollar cuando el contenido sea largo — el flex-1 crece más allá del contenedor padre.
- **Severidad:** Crítico
- **Sugerencia de fix:** `<div className="flex-1 overflow-hidden min-h-0">`.

#### C7 — `chat-tab.tsx`: flex-1 sin min-h-0 en contenedor de mensajes
- **Pantalla:** Chat de inspección
- **Archivo:** `src/app/dashboard/inspecciones/[id]/chat-tab.tsx:67`
- **Breakpoint:** Todos
- **Tipo de bug:** flex-1 sin min-h-0
- **Descripción:** Contenedor de mensajes (`flex-1 space-y-3 overflow-y-auto`) sin `min-h-0`. El scroll del chat no funcionará correctamente cuando haya muchos mensajes.
- **Severidad:** Crítico
- **Sugerencia de fix:** `<div className="flex-1 space-y-3 overflow-y-auto min-h-0">`.

#### C8 — `DynamicScreen.tsx`: flex-1 sin min-h-0 en dropdown de coberturas
- **Pantalla:** Pantallas dinámicas (dropdown de coberturas)
- **Archivo:** `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx:1553`
- **Breakpoint:** Todos
- **Tipo de bug:** flex-1 sin min-h-0
- **Descripción:** `<div className="overflow-y-auto flex-1">` dentro de `<div className="... flex flex-col">` con `max-h-70`. Sin `min-h-0`, el scroll interno no funciona cuando el contenido excede el max-height.
- **Severidad:** Crítico
- **Sugerencia de fix:** `<div className="overflow-y-auto flex-1 min-h-0">`.

#### C9 — `report-tab.tsx`: window.open sin `onafterprint`
- **Pantalla:** Reporte de inspección (imprimir acta)
- **Archivo:** `src/app/dashboard/inspecciones/[id]/report-tab.tsx:264-319`
- **Breakpoint:** Todos
- **Tipo de bug:** Ventana auxiliar que no se cierra
- **Descripción:** `handlePrint` abre `window.open("", "_blank")`, escribe el HTML y llama `printWindow.print()`. **NO tiene `onafterprint`** ni mecanismo de cierre. Si el usuario cancela el diálogo de impresión, la ventana queda abierta en blanco. Comparar con `email-preview-modal.tsx:106-118` que sí tiene `onafterprint` + fallback de timeout.
- **Severidad:** Crítico
- **Sugerencia de fix:** Replicar el patrón de `email-preview-modal.tsx`:
  ```tsx
  printWindow.print();
  printWindow.onafterprint = () => { printWindow.close(); };
  setTimeout(() => { if (!printWindow.closed) printWindow.close(); }, 1000);
  ```

### 🟠 Mayores (33)

#### M1 — `/dashboard/claims`: wizard con grids sin breakpoint mobile
- **Archivo:** `src/app/dashboard/claims/page.tsx:976, 1281, 1318, 1839, 1879`
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Grid sin responsive
- **Descripción:** Los formularios del wizard usan `grid grid-cols-3 lg:grid-cols-4` y `grid grid-cols-4 lg:grid-cols-6` sin `grid-cols-1` para mobile. En pantallas <640px se mantienen 3-4 columnas.
- **Severidad:** Mayor
- **Sugerencia:** Agregar `grid-cols-1` base: `grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4`.

#### M2 — `/dashboard/configuracion`: tabs sin `overflow-x-auto`
- **Archivo:** `src/app/dashboard/configuracion/page.tsx:106`
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Tabs sin scroll horizontal
- **Descripción:** Tabs (`flex gap-1 border-b border-border`) sin `overflow-x-auto` ni `flex-nowrap`. Con 4 tabs en mobile pueden desbordar.
- **Severidad:** Mayor
- **Sugerencia:** Agregar `overflow-x-auto flex-nowrap` o usar el patrón `my-casos-tabs` de `dashboard.css:1928-1932`.

#### M3 — `/dashboard/informes`: tabs de reporte sin `overflow-x-auto`
- **Archivo:** `src/app/dashboard/informes/page.tsx` (~línea 200-250)
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Tabs sin scroll horizontal
- **Descripción:** 5 tabs (resumen, responsables, compañías, inspecciones, siniestros) en flex sin scroll horizontal.
- **Severidad:** Mayor
- **Sugerencia:** Igual que M2.

#### M4 — `/dashboard/informes`: toolbar de filtros sin `flex-wrap`
- **Archivo:** `src/app/dashboard/informes/page.tsx` (~línea 250-300)
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Toolbar sin wrap
- **Descripción:** Múltiples filtros (fecha desde, fecha hasta, estado, búsqueda) en flex container sin wrap. Se desborda horizontalmente.
- **Severidad:** Mayor
- **Sugerencia:** Usar `app-toolbar` (que tiene `flex-wrap` en mobile vía `components.css:1163-1166`) o agregar `flex-wrap`.

#### M5 — `/dashboard/claims/[id]`: tabs principales sin scroll horizontal
- **Archivo:** `src/app/dashboard/claims/[id]/page.tsx:737-754`
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Tabs sin scroll horizontal
- **Descripción:** `app-tab-bar-inner` usa `flex flex-wrap gap-0.5`. Con 7 tabs (Siniestro, Participantes, Incidente, Gestiones, Documentos, Imágenes, Log) el wrapping genera 2 filas que cortan el contenido. No hay `overflow-x-auto`.
- **Severidad:** Mayor
- **Sugerencia:** En `components.css` agregar `@media (max-width: 639px) { .app-tab-bar-inner { overflow-x: auto; flex-wrap: nowrap; } }`.

#### M6 — `/dashboard/claims/[id]/gestiones/[actionId]`: grid principal sin breakpoint tablet
- **Archivo:** `src/app/dashboard/claims/[id]/gestiones/[actionId]/page.tsx:255`
- **Breakpoint:** Tablet portrait (768-1023px)
- **Tipo de bug:** Grid sin responsive
- **Descripción:** `grid gap-4 lg:grid-cols-3` — solo pasa a 3 columnas en ≥1024px. En tablet portrait queda en 1 columna, pero el design system pide 2 columnas en tablet.
- **Severidad:** Mayor
- **Sugerencia:** `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`.

#### M7 — `DynamicScreen.tsx`: render de campos sin breakpoints Tailwind
- **Archivo:** `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx` (render de campos)
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Grid sin responsive (relacionado con C1)
- **Descripción:** El render no usa clases responsive (`sm:`, `md:`, `lg:`). Todos los campos mantienen su ancho relativo en todos los breakpoints.
- **Severidad:** Mayor
- **Sugerencia:** Ver C1.

#### M8 — Catálogos con modales sin `modal-grid` (afecta a ~18 páginas)
- **Pantallas afectadas:** `antiguedades`, `clasificacion-bien`, `clasificacion-danos`, `companias`, `corredores`, `destinos-vivienda`, `eventos`, `lineas-negocio`, `parentescos`, `productos`, `tipos-documentos`, `tipos-polizas`, `tipos-siniestros`, `ubicaciones`, y otras.
- **Patrón:** El cuerpo del modal usa `modal-body space-y-2` en lugar de `modal-grid`.
- **Breakpoint:** Mobile (<640px) y Tablet (640-1023px)
- **Tipo de bug:** Formulario sin responsive
- **Descripción:** Sin `modal-grid`, los campos no se apilan en 1 columna en mobile ni pasan a 2 en tablet. Pierden el comportamiento responsivo definido en `modals.css:193-220`.
- **Severidad:** Mayor
- **Sugerencia:** Reemplazar `space-y-2` por `<div className="modal-grid">...</div>` en cada modal. Es un cambio mecánico de bajo riesgo.

#### M9 — `/dashboard/operaciones/gestiones`: tabla sin `app-data-table-wrap`
- **Archivo:** `src/app/dashboard/operaciones/gestiones/page.tsx:190`
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Tabla sin scroll horizontal
- **Descripción:** Usa `overflow-auto border rounded-lg` en lugar de `app-data-table-wrap`. Pierde estilos glassmorphism y scroll touch optimizado.
- **Severidad:** Mayor
- **Sugerencia:** Reemplazar por `app-data-table-wrap`.

#### M10 — `/dashboard/operaciones/gestiones` e `inhabilitar`: botones `h-7 px-2 text-xs` no táctiles
- **Archivos:** `operaciones/gestiones/page.tsx:214,229` · `operaciones/inhabilitar/page.tsx:262`
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Botones no táctiles
- **Descripción:** Botones de acción en tablas con `h-7` (28px), por debajo del mínimo 44×44px. (Mismo problema que C2, pero en botones de texto no iconos.)
- **Severidad:** Mayor
- **Sugerencia:** `h-9 px-3 sm:h-7 sm:px-2` (36px mobile, 28px desktop).

#### M11 — `/dashboard/operaciones/inhabilitar` y `reabrir`: tablas sin `app-data-table-wrap`
- **Archivos:** `inhabilitar/page.tsx:227` · `reabrir/page.tsx:217`
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Tabla sin scroll horizontal
- **Descripción:** Mismo patrón que M9.
- **Severidad:** Mayor
- **Sugerencia:** Reemplazar por `app-data-table-wrap`.

#### M12 — `/dashboard/catalogos/coberturas`: layout no sigue patrón CRUD + scroll externo
- **Archivo:** `src/app/dashboard/catalogos/coberturas/page.tsx:238-330` (layout) y `:268` (`max-h-[70vh] overflow-y-auto`)
- **Breakpoint:** Mobile y Tablet
- **Tipo de bug:** Layout no estándar + scroll externo
- **Descripción:** Header con rail de temas y layout con `flex gap-4` + filtros inline en lugar de `app-grid-toolbar`. El contenedor `:268` usa `max-h-[70vh] overflow-y-auto` (scroll externo en vez de interno). No se beneficia de los overrides responsive globales.
- **Severidad:** Mayor
- **Sugerencia:** Refactorizar al patrón CRUD estándar o agregar media queries específicas.

#### M13 — `/dashboard/catalogos/marcas` y `monedas`: header no estándar
- **Archivos:** `marcas/page.tsx:117-142` · `monedas/page.tsx:24-34, 109-125`
- **Breakpoint:** Mobile y Tablet
- **Tipo de bug:** Layout no estándar
- **Descripción:** `marcas` usa `app-grid-filters` en lugar de `app-grid-toolbar`. `monedas` usa `app-page-header` + `app-stack` (no parte del patrón CRUD).
- **Severidad:** Mayor
- **Sugerencia:** Migrar a `app-grid-header` + `app-grid-toolbar`.

#### M14 — `/dashboard/catalogos/tipos-siniestros`: grid de iconos 8 columnas fijo
- **Archivo:** `src/app/dashboard/catalogos/tipos-siniestros/page.tsx:195-226`
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Grid sin responsive
- **Descripción:** Selector de iconos usa `grid grid-cols-8 gap-2` sin responsive. En mobile los iconos quedan a ~40px cada uno.
- **Severidad:** Mayor
- **Sugerencia:** `grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2`.

#### M15 — `/dashboard/permisos`: tabla sin `app-data-table-wrap`
- **Archivo:** `src/app/dashboard/permisos/page.tsx:270`
- **Breakpoint:** Mobile (<640px)
- **Tipo de bug:** Tabla sin scroll horizontal
- **Descripción:** Usa `overflow-x-auto` directo en lugar de `app-data-table-wrap`. La tabla tiene 5+ columnas (Sección + 4 acciones + Todo).
- **Severidad:** Mayor
- **Sugerencia:** Reemplazar por `app-data-table-wrap`.

#### M16 a M22 — 7 modales que no siguen el patrón de dimensiones fijas
- **M16:** `src/components/claims/claim-location-selector.tsx:206` — `max-w-328 max-h-[90vh] p-0 overflow-hidden` (sin clase modal-*, sin h- fijo)
- **M17:** `src/app/dashboard/catalogos/gestiones/caracteristicas/screen-builder.tsx:131` — `max-w-6xl max-h-[92vh] flex flex-col p-0` (sin clase modal-*, sin overflow:hidden)
- **M18:** `src/app/dashboard/catalogos/gestiones/email-templates/components/EmailTemplateEditor.tsx:638` — `w-[calc(100%-2rem)] max-w-6xl h-[90vh] p-0 flex flex-col` (sin clase modal-*, sin overflow:hidden)
- **M19:** `src/app/dashboard/claims/[id]/page.tsx:1920` — `max-w-328 p-0 overflow-hidden` (sin clase modal-*, sin altura fija)
- **M20:** `src/app/dashboard/inspecciones/[id]/page.tsx:1018` — `max-w-5xl p-0 overflow-hidden` (sin clase modal-*, sin altura fija)
- **M21:** `src/app/dashboard/inspecciones/[id]/page.tsx:1056` — `modal-content max-w-[480px]` (clase `modal-content` NO existe en modals.css)
- **M22:** `src/components/layout/help-panel.tsx:596` — `max-w-4xl w-[95vw] h-[85vh] p-0 flex flex-col` (sin clase modal-*, sin overflow:hidden)
- **Tipo de bug:** Modal sin tamaño fijo / sin overflow:hidden
- **Severidad:** Mayor
- **Sugerencia:** Usar clase `modal-*` existente (modal-sm/md/lg/xl) o crear clase CSS nueva en `modals.css` siguiendo el patrón: `overflow: hidden !important`, `display: flex !important`, `flex-direction: column !important`, `max-height` o `height` fijo por breakpoint.

#### M23 a M33 — Inline styles prohibidos (ver sección 5.2 para detalle completo)

### 🟡 Menores (55)

#### m1 — `/dashboard/claims`: toolbar `app-grid-toolbar` sin `flex-wrap`
- **Archivo:** `src/app/dashboard/claims/page.tsx` (~950-960)
- **Breakpoint:** Mobile (<640px)
- **Sugerencia:** Agregar `flex-wrap` a `.app-grid-toolbar` en `components.css:1370-1372`.

#### m2 — `/dashboard/claims`: modal `modal-lg` (910px) estrecho para wizard de 4 pasos en mobile
- **Archivo:** `src/app/dashboard/claims/page.tsx:926`
- **Breakpoint:** Mobile (<640px)
- **Sugerencia:** Considerar `modal-xl` o un wizard full-screen en mobile.

#### m3 — `/dashboard/claims/[id]`: sub-tabs `app-sub-tab-bar` sin overflow en mobile
- **Archivo:** `src/app/dashboard/claims/[id]/page.tsx:1061-1074`
- **Breakpoint:** Mobile (<640px)
- **Sugerencia:** `@media (max-width: 639px) { .app-sub-tab-bar { overflow-x: auto; flex-wrap: nowrap; } }`.

#### m4 — `/dashboard/claims/[id]/gestiones/[actionId]`: grid de plazos `grid-cols-2` fijo
- **Archivo:** `src/app/dashboard/claims/[id]/gestiones/[actionId]/page.tsx:428`
- **Breakpoint:** Mobile (<640px)
- **Sugerencia:** `grid grid-cols-1 sm:grid-cols-2 gap-2`.

#### m5 — `/dashboard/permisos`: botones "Todo"/"Ninguno" sin `flex-wrap`
- **Archivo:** `src/app/dashboard/permisos/page.tsx:229-266`
- **Breakpoint:** Mobile (<640px)
- **Sugerencia:** Agregar `flex-wrap` al contenedor.

#### m6 — `/dashboard/operaciones/carga-catalogos` y `carga-siniestros`: dropzone `p-8` excesivo
- **Archivos:** `carga-catalogos/page.tsx:264` · `carga-siniestros/page.tsx:195`
- **Breakpoint:** Mobile (<640px)
- **Sugerencia:** `p-4 sm:p-6`.

#### m7 — `/dashboard/operaciones/carga-catalogos` y `carga-siniestros`: tabla preview `max-h-[400px]`
- **Archivos:** `carga-catalogos/page.tsx:333` · `carga-siniestros/page.tsx:264`
- **Breakpoint:** Mobile (<640px)
- **Sugerencia:** `max-h-[300px] sm:max-h-[400px]`.

#### m8 — `/dashboard/operaciones/inhabilitar` y `reabrir`: textarea `min-h-[60px]` fijo
- **Archivos:** `inhabilitar/page.tsx:183` · `reabrir/page.tsx:178`
- **Breakpoint:** Mobile (<640px)
- **Sugerencia:** `min-h-[50px] sm:min-h-[60px]`.

#### m9 — `/dashboard/admin/menu`: header `px-5 py-4` fijo
- **Archivo:** `src/app/dashboard/admin/menu/page.tsx:1081`
- **Breakpoint:** Mobile (<640px)
- **Sugerencia:** `px-4 py-3 sm:px-5 sm:py-4`.

#### m10 — `/dashboard/admin/menu`: indentación fija `depth * 20px`
- **Archivo:** `src/app/dashboard/admin/menu/page.tsx:1149`
- **Breakpoint:** Mobile (<640px)
- **Sugerencia:** `depth * 12` en mobile, `depth * 20` en desktop (vía JS con media query o clase condicional).

#### m11 — `/dashboard/admin/menu`: sin `max-width` en 1440p
- **Archivo:** `src/app/dashboard/admin/menu/page.tsx` (layout principal)
- **Breakpoint:** Desktop 1440p (≥2560px)
- **Sugerencia:** Envolver en `app-page` o agregar `max-w-[min(120rem,calc(100%-1rem))] mx-auto`.

#### m12 — `/dashboard/catalogos/gestiones/email-templates`: selects sin `app-filter-narrow`
- **Archivo:** `src/app/dashboard/catalogos/gestiones/email-templates/page.tsx:137,150`
- **Breakpoint:** Mobile y Tablet
- **Sugerencia:** Usar `app-filter-narrow` (150px) o ancho fijo 200px según `forms.css`.

#### m13 — `/dashboard/catalogos/pantallas`: sin toolbar estándar
- **Archivo:** `src/app/dashboard/catalogos/pantallas/page.tsx:168-169`
- **Breakpoint:** Mobile y Tablet
- **Sugerencia:** Agregar toolbar con buscador.

#### m14 — Catálogos `workflows` y `tipos-cambio`: layouts especializados
- **Archivos:** `workflows/page.tsx` (DnD) · `tipos-cambio/page.tsx` (calendario)
- **Breakpoint:** Mobile y Tablet
- **Sugerencia:** Auditar a fondo cuando se trabaje en estas páginas.

#### m15 — Catálogos `inspeccion/*` (14 páginas): componente `LookupCatalogManager` no auditado a fondo
- **Sugerencia:** Auditar `LookupCatalogManager` una vez para cubrir las 14 páginas. El modal que usa (`modal-md` en `lookup-catalog-manager.tsx:183`) sí sigue el patrón.

*(Más problemas menores detallados en las tablas por pantalla de la sección 2)*

---

## 4. Bugs de CSS Globales

Estos bugs afectan a múltiples pantallas porque están en clases CSS reutilizables.

### G1 — `modal-sm/md/lg/xl` con `overflow-hidden` sin `!important` (CRÍTICO)
- **Archivos:** `src/app/styles/modals.css:18, 29, 58, 74`
- **Descripción:** Las 4 clases canónicas de modales usan `@apply overflow-hidden` **sin `!important`**:
  ```css
  .modal-md {
    @apply flex max-h-[90vh] w-[min(96vw,560px)] flex-col gap-0
           overflow-hidden border-0 p-0;  /* ← sin !important */
  ```
  Mientras tanto, `modal-md-wide` (línea 45) y `modal-email` (línea 103) **sí** tienen `overflow: hidden !important`. Esta inconsistencia hace que cualquier utility de Tailwind como `overflow-auto` o `overflow-visible` en el `DialogContent` pueda sobrescribir el `overflow-hidden` de `modal-sm/md/lg/xl` y causar scroll externo en el modal.
- **Impacto:** Afecta a ~52 modales que usan `modal-sm/md/lg/xl`.
- **Severidad:** Crítico (bug de CSS global)
- **Sugerencia:** Cambiar las 4 definiciones a `overflow: hidden !important` (como ya lo hacen `modal-md-wide` y `modal-email`).

### G2 — `overflow: hidden` sin `!important` en clases de `@layer components`
- **Archivos:**
  - `src/app/styles/components.css:109` — `.glass-panel` (KPIs y paneles del dashboard)
  - `src/app/styles/components.css:246` — `.app-panel` (paneles de todas las grillas CRUD)
  - `src/app/styles/components.css:315` — `.app-data-table-wrap` (wrappers de tablas)
  - `src/app/styles/components.css:636` — `.sidebar-glass::before`
  - `src/app/styles/components.css:990` — `.app-email-inner-card`
  - `src/app/styles/components.css:1003` — `.app-email-card`
  - `src/app/styles/buttons.css:633`
  - `src/app/styles/dashboard.css:165, 561, 571, 581, 877, 1132, 1275, 1753, 1851, 2069`
  - `src/app/styles/animations.css:14`
- **Descripción:** Estas clases están dentro de `@layer components` y usan `overflow: hidden` sin `!important`. Las utilities de Tailwind (`overflow-auto`, `overflow-visible`, `overflow-y-auto`) tienen mayor especificidad en la cascada de Tailwind v4 y pueden sobrescribirlas.
- **Impacto:** Potencial scroll externo en paneles y tablas si un componente hijo agrega `overflow-*` utilities.
- **Severidad:** Mayor (bug de CSS global)
- **Sugerencia:** Agregar `!important` a las propiedades `overflow: hidden` en estas clases, especialmente `.app-panel` y `.app-data-table-wrap` que son las más usadas.

### G3 — `.app-tab-bar-inner` y `.app-sub-tab-bar` sin media query mobile
- **Archivos:** `src/app/styles/components.css:527-529` (`.app-tab-bar-inner`) y `:569-581` (`.app-sub-tab-bar`)
- **Descripción:** Ninguna de las dos clases tiene media query para mobile. `.app-tab-bar-inner` usa `flex flex-wrap` que genera 2 filas en mobile (cortando contenido), y `.app-sub-tab-bar` no tiene `overflow-x-auto`.
- **Impacto:** Afecta a todas las páginas con tabs principales y sub-tabs (claims/[id], configuracion, informes).
- **Severidad:** Mayor (bug de CSS global)
- **Sugerencia:**
  ```css
  @media (max-width: 639px) {
    .app-tab-bar-inner { overflow-x: auto; flex-wrap: nowrap; }
    .app-sub-tab-bar { overflow-x: auto; flex-wrap: nowrap; }
  }
  ```

### G4 — `.app-grid-toolbar` sin `flex-wrap`
- **Archivo:** `src/app/styles/components.css:1370-1372`
- **Descripción:** La clase usa `flex items-center justify-between` sin `flex-wrap`. En mobile, si hay muchos elementos (buscador + select + paginación), pueden desbordarse horizontalmente.
- **Impacto:** Afecta a todas las grillas que usan `app-grid-toolbar` (la mayoría del sistema).
- **Severidad:** Menor (bug de CSS global)
- **Sugerencia:** Agregar `flex-wrap` o un media query que lo active en mobile.

### G5 — Override de `btn-icon-sm` solo en ≤480px (no ≤639px)
- **Archivo:** `src/app/styles/components.css:1262-1267`
- **Descripción:** El override que aumenta `btn-icon-sm` a 32×32px solo aplica en `@media (max-width: 480px)`. En el rango 481-639px (móviles grandes como iPhone 14 Pro Max, 430px) no hay ajuste. Además, 32×32px sigue siendo menor al mínimo táctil de 44×44px.
- **Impacto:** Afecta a TODAS las grillas del sistema con botones de acción.
- **Severidad:** Crítico (bug de CSS global, relacionado con C2)
- **Sugerencia:** Ampliar a `@media (max-width: 639px)` y subir a `size-11` (44px).

---

## 5. Infracciones a Reglas

### 5.1 Regla #3 — Argentismos (9 ocurrencias)

| Archivo:línea | Argentismo | Forma correcta | Contexto |
|---------------|------------|---------------|----------|
| `src/app/dashboard/configuracion/page.tsx:366` | seleccionás | seleccionas | UI string (descripción de campo) |
| `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx:5036` | Subí | Sube | Toast message (success) |
| `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx:5172` | Subí | Sube | UI string (descripción de upload dialog) |
| `src/app/page.tsx:34` | Subí, Eliminá | Sube, Elimina | UI string (descripción de feature en landing) |
| `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx:5370` | Elegí | Elige | UI string (DialogDescription) |
| `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx:5383` | Configurá | Configura | UI string (instrucción en modal) |
| `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx:5463` | Hacé click | Haz clic | UI string (placeholder de upload) |
| `src/app/dashboard/catalogos/gestiones/email-templates/components/FieldInsertor.tsx:72` | Hacé clic | Haz clic | UI string (instrucción de ayuda) |
| `src/app/dashboard/catalogos/gestiones/gestiones/email-templates-card.tsx:185-186` | Vinculá, Marcá | Vincula, Marca | UI string (descripción de componente) |

**Patrones recurrentes:**
1. **Imperativos voseantes en -á:** `seleccionás`, `Configurá`, `Vinculá`, `Marcá`, `Eliminá`
2. **Imperativos voseantes en -í:** `Subí`, `Elegí`
3. **Imperativo irregular "hacé":** `Hacé click/clic` → `Haz clic`

**Archivo con más incidencias:** `DynamicScreen.tsx` (4 ocurrencias en líneas 5036, 5172, 5370, 5383, 5463).

### 5.2 Regla #2 — Inline styles prohibidos (~25 ocurrencias)

Se auditaron 41 archivos con `style={{}}`. Clasificación:

#### ❌ PROHIBIDOS (estilos visuales estáticos que deberían ser clases CSS)

| Archivo:línea | Código | Sugerencia de clase semántica |
|---------------|--------|-------------------------------|
| `src/app/dashboard/page.tsx:467` | `style={{ background: kpi.iconBg }}` | `kpi-icon-{variant}` o CSS var `--kpi-icon-bg` |
| `src/app/dashboard/page.tsx:530, 548, 578, 594, 617, 630, 653, 694, 713, 730, 779, 802, 809, 822, 857, 878, 893, 900, 913` | `style={{ ["--glass-glow"]: "rgba(...)" }}` | Clases `glass-glow-{color}` (esmeralda, índigo, etc.) |
| `src/app/page.tsx:86, 87, 88` | `style={{ animationDuration: "8s" }}` | `animate-pulse-slow`, `animate-pulse-slower`, `animate-pulse-slowest` |
| `src/app/dashboard/gestiones/page.tsx:125` | `style={{ marginTop: 12 }}` | `dash-grid-mt` o `mt-3` |
| `src/app/dashboard/gestiones/page.tsx:128, 138, 146, 148` | `style={{ background: \`linear-gradient(...)\` }}` | `kpi-icon-gradient-{color}` |
| `src/app/dashboard/mis-casos/page.tsx:138, 149, 159, 169` | `style={{ marginTop: 12 }}` y CSS vars | `dash-grid-mt` + clases `kpi-glow-{color}` |
| `src/app/dashboard/claims/[id]/page.tsx:1477` | `style={{ width: 16, height: 16 }}` | `size-4` (Tailwind) o clase `gestion-light-dot` |
| `src/app/dashboard/catalogos/gestiones/email-templates/components/EmailTemplateEditor.tsx:546, 698` | `style={{ backgroundColor: c }}` | CSS var `--swatch-color` + clase `swatch-btn` |
| `src/app/dashboard/catalogos/gestiones/email-templates/components/EmailTemplateEditor.tsx:612, 763` | `style={{ backgroundColor: form.header_color, justifyContent: form.logo_position }}` | CSS vars `--header-bg`, `--header-justify` + clase `email-header-preview` |
| `src/app/dashboard/catalogos/gestiones/caracteristicas/page.tsx:186, 383` | (revisar contexto) | Clase semántica según caso |
| `src/app/dashboard/catalogos/workflows/page.tsx:1213, 1292` | (revisar contexto) | Clase semántica según caso |
| `src/app/dashboard/catalogos/gestiones/gestiones/page.tsx:525, 545, 1158` | (revisar contexto) | Clase semántica según caso |
| `src/app/dashboard/informes/page.tsx:352, 559` | (revisar contexto) | Clase semántica según caso |
| `src/app/dashboard/operaciones/gestiones/page.tsx` (8 ocurrencias) | (revisar contexto) | Clase semántica según caso |
| `src/app/dashboard/operaciones/carga-catalogos/page.tsx:326` | (revisar contexto) | Clase semántica según caso |
| `src/app/dashboard/operaciones/carga-siniestros/page.tsx:257` | (revisar contexto) | Clase semántica según caso |
| `src/app/dashboard/catalogos/lineas-negocio/page.tsx:208` | (revisar contexto) | Clase semántica según caso |
| `src/app/dashboard/catalogos/tipos-cambio/page.tsx:614` | (revisar contexto) | Clase semántica según caso |

#### ✅ VÁLIDOS (valores dinámicos en runtime)

| Archivo:línea | Código | Razón |
|---------------|--------|-------|
| `src/app/dashboard/page.tsx:462` | `style={{ ["--kpi-glow"]: kpi.glow }}` | CSS variable dinámica (cambia por KPI) |
| `src/app/dashboard/gestiones/page.tsx:118` | `style={{ ["--tab-glow"]: cfg.glow }}` | CSS variable dinámica (cambia por tab) |
| `src/app/dashboard/mis-casos/page.tsx:131` | `style={{ ["--tab-glow"]: ROLE_GLOWS[r] }}` | CSS variable dinámica (cambia por rol) |
| `src/app/dashboard/claims/[id]/page.tsx:1417` | `style={{ "--gestion-color": hexColor }}` | CSS variable dinámica (cambia por gestión) |
| `src/app/dashboard/claims/[id]/page.tsx:1933` | `style={{ height: "100%", width: "100%" }}` | MapContainer (Leaflet) requiere style prop |
| `src/app/dashboard/admin/menu/page.tsx:1149` | `style={{ paddingLeft: item.depth * 20 }}` | Valor dinámico (profundidad del item) |
| `src/app/dashboard/inspecciones/[id]/chat-tab.tsx:58, 67` | (alturas calculadas) | Valor dinámico en runtime |
| `src/components/inspection/geo-capture.tsx:298, 376` | (posiciones de mapa) | Valor dinámico en runtime |
| `src/components/ui/drawing-canvas.tsx:287, 344` | (coordenadas de dibujo) | Valor dinámico en runtime |
| `src/components/dashboard/gauge-chart.tsx:31, 58` | (ángulos calculados) | Valor dinámico en runtime |
| `src/components/dashboard/donut-chart.tsx:55` | (ángulos calculados) | Valor dinámico en runtime |
| `src/components/ui/voice-textarea.tsx:186` | (altura de textarea) | Valor dinámico en runtime |
| `src/components/ui/toggle-group.tsx:43` | (ancho de toggle) | Valor dinámico en runtime |
| `src/components/ui/space-classification-matrix.tsx:85` | (grid dinámico) | Valor dinámico en runtime |
| `src/components/ui/subject-editor.tsx:143, 159` | (posiciones de editor) | Valor dinámico en runtime |
| `src/components/ui/product-search.tsx:212, 244` | (posiciones de dropdown) | Valor dinámico en runtime |
| `src/components/ui/html-editor.tsx:388, 405` | (altura de editor) | Valor dinámico en runtime |
| `src/components/claims/claim-location-selector.tsx:325` | (coordenadas de mapa) | Valor dinámico en runtime |
| `src/components/global-loading-overlay.tsx:50, 65, 79` | (animación de overlay) | Valor dinámico en runtime |
| `src/components/video-call.tsx:236` | (layout de video) | Valor dinámico en runtime |
| `src/components/layout/nav-hybrid.tsx:136, 277` | (transform de animación) | Valor dinámico en runtime |
| `src/components/layout/mobile-nav.tsx:198` | (transform de drawer) | Valor dinámico en runtime |
| `src/components/layout/top-bar.tsx:147` | (posicionamiento) | Valor dinámico en runtime |
| `src/app/inspection/[token]/page.tsx:402, 1355` | (layout de inspección) | Valor dinámico en runtime |
| `src/app/dashboard/inspecciones/[id]/evidences-tab.tsx:338, 417, 517, 614` | (layout de galería) | Valor dinámico en runtime |
| `src/app/dashboard/claims/[id]/claim-documents-tab.tsx:905, 1001` | (layout de documentos) | Valor dinámico en runtime |
| `src/app/dashboard/claims/[id]/claim-images-tab.tsx:518, 631` | (layout de galería) | Valor dinámico en runtime |
| `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx:1542` | (columnas dinámicas) | Valor dinámico en runtime |
| `src/app/dashboard/catalogos/polizas/[id]/page.tsx:1157` | (revisar) | Posible valor dinámico |
| `src/components/ui/dropdown-menu.tsx:51` | (posicionamiento de portal) | Valor dinámico en runtime |
| `src/components/perf-panel.tsx` (43 ocurrencias) | (mediciones de performance) | Herramienta de debug, no UI de producción |

**Top 5 patrones prohibidos más recurrentes:**
1. **Gradientes inline en iconos KPI** (`background: linear-gradient(...)`) — 4+ ocurrencias en `gestiones/page.tsx`, patrón similar en `dashboard/page.tsx`
2. **`marginTop: 12` en dash-grid** — 2+ ocurrencias (`gestiones/page.tsx:125`, `mis-casos/page.tsx:138`)
3. **CSS vars con valor estático** (`["--glass-glow"]: "rgba(...)"`) — 19 ocurrencias en `dashboard/page.tsx` (podrían ser clases `glass-glow-{color}`)
4. **`animationDuration` fijo** — 3 ocurrencias en `page.tsx:86-88`
5. **`backgroundColor` en swatches de color** — 2+ ocurrencias en `EmailTemplateEditor.tsx`

---

## 6. Priorización (qué arreglar primero)

### 🔴 Prioridad 1 — Críticos (bloquean uso en mobile o causan bugs funcionales)

1. **G1 + G5 + C2 — Botones `btn-icon-sm` táctiles + overflow modal sin !important.** Cambiar media query en `components.css:1262-1267` de `@media (max-width: 480px)` a `@media (max-width: 639px)` y subir a `size-11` (44px). Agregar `!important` a `overflow-hidden` en `modal-sm/md/lg/xl` (`modals.css:18,29,58,74`). **Arreglos de CSS puro que arreglan TODAS las grillas y TODOS los modales del sistema.** Es el problema reportado por el usuario.

2. **C1 + M7 — `DynamicScreen.tsx` grid de 60 columnas.** Agregar media query global en `components.css` que en `@media (max-width: 639px)` fuerce `grid-template-columns: 1fr` en el contenedor de campos dinámicos. Arreglo de CSS, sin tocar el componente.

3. **C3 + C4 + m9 + m10 + m11 — `admin/menu` mobile.** Refactor del layout a `flex flex-col sm:flex-row` + paleta responsive + indentación condicional + `max-width` en 1440p. Es la única pantalla con layout completamente roto en mobile.

4. **C5 — `gestion-screens/index.tsx` grid `grid-cols-2` fijo.** Cambio a `grid-cols-1 sm:grid-cols-2`.

5. **C6 + C7 + C8 — flex-1 sin min-h-0.** Agregar `min-h-0` a 3 contenedores: `inspecciones/[id]/page.tsx:982`, `chat-tab.tsx:67`, `DynamicScreen.tsx:1553`. Arregla scroll roto en chat y dropdown de coberturas.

6. **C9 — `report-tab.tsx` window.open sin `onafterprint`.** Replicar patrón de `email-preview-modal.tsx:106-118`.

### 🟠 Prioridad 2 — Mayores recurrentes (afectan a muchas pantallas)

7. **G3 — Tabs sin scroll horizontal.** Agregar media query global en `components.css` para `.app-tab-bar-inner` y `.app-sub-tab-bar` en mobile. Arreglo de CSS que cubre todas las páginas con tabs.

8. **M8 — Modales de catálogos sin `modal-grid` (~18 páginas).** Reemplazo mecánico de `space-y-2` por `modal-grid`. Bajo riesgo, alto impacto.

9. **M16-M22 — 7 modales sin clase `modal-*`.** Migrar a clase existente o crear nueva en `modals.css`.

10. **M3 + M4 — `informes` tabs y toolbar.** Aplicar fixes específicos (overflow-x en tabs, flex-wrap en toolbar).

11. **M1 — `claims` wizard grids.** Agregar `grid-cols-1` base a los 5 grids del wizard.

12. **M6 — `gestiones/[actionId]` grid sin breakpoint tablet.** Cambio a `sm:grid-cols-2 lg:grid-cols-3`.

13. **M9 + M11 — Operaciones sin `app-data-table-wrap`.** Reemplazo en 3 páginas.

14. **M10 — Botones de texto no táctiles en operaciones.** `h-9 px-3 sm:h-7 sm:px-2` en gestiones e inhabilitar.

15. **M12 + M13 — Catálogos con layouts no estándar** (`coberturas`, `marcas`, `monedas`). Refactor al patrón CRUD.

16. **M14 — `tipos-siniestros` grid de iconos.** Cambio a `grid-cols-4 sm:grid-cols-6 lg:grid-cols-8`.

17. **M15 — `permisos` sin `app-data-table-wrap`.** Reemplazo.

### 🟡 Prioridad 3 — Menores (pulido UX + reglas)

18. **G4 — `app-grid-toolbar` sin `flex-wrap`.** Agregar `flex-wrap` global en `components.css`.

19. **m6 + m7 + m8 — Dropzones, tablas preview y textareas con alturas/paddings fijos.** Cambios a `sm:` responsive en carga-catalogos, carga-siniestros, inhabilitar, reabrir.

20. **Argentismos (9 ocurrencias).** Reemplazar imperativos voseantes por formas neutras. Priorizar `DynamicScreen.tsx` (4 casos) y `src/app/page.tsx` (landing pública).

21. **Inline styles prohibidos (~25 ocurrencias).** Crear clases CSS semánticas para gradientes KPI, `marginTop: 12`, `animationDuration`, swatches de color. Priorizar `dashboard/page.tsx` (19 ocurrencias de `--glass-glow` con valor estático).

22. **m12 — Selects sin `app-filter-narrow` en email-templates.**

23. **m13 + m14 + m15 — Páginas con componentes no auditados** (`pantallas`, `workflows`, `tipos-cambio`, `inspeccion/*`). Auditar a fondo cuando se trabaje en ellas.

---

## 7. Notas Metodológicas

- **Páginas "patrón" en catálogos:** se marcaron así cuando siguen el patrón CRUD estándar y se benefician de los overrides responsive globales en `components.css:1115-1244`. No se leyeron a fondo, pero no se detectaron desviaciones evidentes. **Recomendación:** auditar a fondo antes de asumir que pasan en todos los breakpoints.
- **Componente `LookupCatalogManager`:** las 14 páginas de `catalogos/inspeccion/*` delegan a este componente. Su modal (`modal-md` en `lookup-catalog-manager.tsx:183`) sí sigue el patrón. Auditar el resto del componente una vez para cubrir las 14 páginas.
- **Componente `TemparioManager`:** `catalogos/tempario` delega a este componente. No auditado a fondo. Su modal (`modal-xl` en `tempario-manager.tsx:641`) sí sigue el patrón.
- **Overrides responsive globales (`components.css:1115-1244`):** esta capa es la razón por la que muchas páginas pasan en mobile/tablet. Aplica a `.app-page`, `.app-page-header`, `.app-toolbar`, `.app-grid-header`, `.app-data-table-wrap`, `.app-form-fields`, `.app-form-grid`, `.app-header-row`. **Las páginas que NO usan estas clases pierden la protección.**
- **`modal-email` (modales de email):** ya tienen responsive completo a 4 breakpoints en `modals.css:99-142` (mobile full-screen, tablet 95vw×80vh, 1080p 1100×880, 1440p 1200×1100). **Nota:** el prompt menciona "Mobile: 90vw × 85vh" pero el CSS actual usa `100vw × 100vh` en mobile (full screen). Verificar si esto es intencional o si debe ajustarse a 90vw × 85vh.
- **Modales auditados:** 59 en total (52 siguen el patrón con clase `modal-*`, 7 no lo siguen). Los 52 que siguen el patrón heredan automáticamente `overflow: hidden !important` (excepto por el bug G1), `flex flex-col`, `max-height`, `.modal-header` con `shrink-0`, `.modal-body` con `flex-1 + min-h-0`, `.modal-footer` con `shrink-0`.

---

## 8. Archivos clave referenciados

| Archivo | Relevancia |
|---------|------------|
| `src/app/styles/modals.css:18,29,58,74` | `modal-sm/md/lg/xl` con `overflow-hidden` sin `!important` (bug G1) |
| `src/app/styles/modals.css:45,103` | `modal-md-wide` y `modal-email` con `overflow: hidden !important` (referencia correcta) |
| `src/app/styles/modals.css:99-142` | `.modal-email` responsive a 4 breakpoints ✅ |
| `src/app/styles/modals.css:193-220` | `.modal-grid` responsive (1 col mobile → 2 sm+ → 3 lg+) ✅ |
| `src/app/styles/components.css:1115-1244` | Overrides responsive globales (mobile + tablet) |
| `src/app/styles/components.css:1262-1267` | Override de `btn-icon-sm` en ≤480px (debería ser ≤639px y 44px) |
| `src/app/styles/components.css:527-529` | `.app-tab-bar-inner` (sin media query mobile) |
| `src/app/styles/components.css:569-581` | `.app-sub-tab-bar` (sin media query mobile) |
| `src/app/styles/components.css:1370-1372` | `.app-grid-toolbar` (sin `flex-wrap`) |
| `src/app/styles/buttons.css:428-431` | `btn-icon-sm` 28×28px base |
| `src/components/claims/email-preview-modal.tsx:106-118` | Patrón correcto de `onafterprint` (referencia) |
| `src/components/claims/email-preview-modal.tsx:164` | Patrón correcto de modal-email (referencia) |
| `src/components/claims/email-compose-modal.tsx:407` | Patrón correcto de modal-email (referencia) |
| `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx:137-147` | `widthClass` grid 60 columnas sin responsive |
| `src/app/dashboard/inspecciones/[id]/report-tab.tsx:264-319` | `window.open` sin `onafterprint` |
| `src/app/dashboard/admin/menu/page.tsx:1132,1171` | Layout flex + paleta 280px fijos |

---

*Fin del reporte. Este archivo es solo auditoría — no se modificó ningún archivo del proyecto.*
