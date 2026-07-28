# Plan Urgente de Correcciones Responsive — Claims Hub

> **Basado en:** `docs/responsive-audit.md` (97 problemas: 9 críticos, 33 mayores, 55 menores)
> **Objetivo:** Dejar el sistema 100% funcional en los 4 breakpoints (Mobile <640, Tablet 640-1023, 1080p 1024-2559, 1440p ≥2560)
> **Estrategia:** CSS global primero (arregla el sistema entero con cambios mínimos), luego componentes críticos, luego limpieza.
> **Regla:** Cero errores y cero warnings de `tsc` y `eslint` al final de cada fase.

---

## Fase 0 — Preparación (antes de tocar nada)

- [ ] Crear branch `fix/responsive-audit`
- [ ] Verificar baseline: `npx tsc --noEmit` y `npx eslint` deben dar 0 errores (registrar el estado actual)
- [ ] Confirmar que `pnpm dev` arranca sin errores

---

## Fase 1 — Fixes de CSS global (ALTO IMPACTO, BAJO RIESGO)

> **Impacto:** Arregla ~60% de los problemas del sistema tocando solo 2 archivos CSS.
> **Riesgo:** Bajo — son cambios de CSS puro, no tocan lógica.
> **Archivos:** `src/app/styles/components.css`, `src/app/styles/modals.css`

### 1.1 Botones táctiles `btn-icon-sm` (arregla el problema #1 reportado por el usuario)
- **Archivo:** `src/app/styles/components.css:1262-1267`
- **Cambio:** Ampliar media query de `@media (max-width: 480px)` a `@media (max-width: 639px)` y subir tamaño de `size-8` (32px) a `size-11` (44px).
- **Verificación:** Abrir `/dashboard/claims/[id]` en mobile (375px) y verificar que los botones de acción de la grilla de gestiones se pueden tocar con el dedo.

### 1.2 `overflow: hidden !important` en `modal-sm/md/lg/xl`
- **Archivo:** `src/app/styles/modals.css:18, 29, 58, 74`
- **Cambio:** Reemplazar `overflow-hidden` (sin `!important`) por `overflow: hidden !important` en las 4 clases, alineándolas con `modal-md-wide` (línea 45) y `modal-email` (línea 103).
- **Verificación:** Abrir cualquier modal `modal-md` (ej: catálogos) y verificar que no aparece scroll externo.

### 1.3 Tabs con scroll horizontal en mobile
- **Archivo:** `src/app/styles/components.css` (agregar al final de la sección responsive, ~línea 1244)
- **Cambio:** Agregar:
  ```css
  @media (max-width: 639px) {
    .app-tab-bar-inner { overflow-x: auto; flex-wrap: nowrap; }
    .app-sub-tab-bar { overflow-x: auto; flex-wrap: nowrap; }
  }
  ```
- **Verificación:** Abrir `/dashboard/claims/[id]` en mobile y verificar que los 7 tabs hacen scroll horizontal en una sola fila.

### 1.4 `app-grid-toolbar` con `flex-wrap`
- **Archivo:** `src/app/styles/components.css:1370-1372`
- **Cambio:** Agregar `flex-wrap` a la definición de `.app-grid-toolbar`.
- **Verificación:** Abrir `/dashboard/claims` en mobile y verificar que el toolbar no se corta.

### 1.5 `overflow: hidden !important` en `.app-panel` y `.app-data-table-wrap`
- **Archivo:** `src/app/styles/components.css:246, 315`
- **Cambio:** Agregar `!important` a las propiedades `overflow: hidden` existentes.
- **Verificación:** Verificar que las tablas CRUD mantienen scroll horizontal interno.

**✅ Checkpoint Fase 1:** `tsc --noEmit` + `eslint` = 0 errores. Probar en mobile: claims, claims/[id], un catálogo. Commit: `fix: responsive CSS global (btn-icon, modals overflow, tabs, toolbar)`.

---

## Fase 2 — Componentes críticos (ALTO IMPACTO, RIESGO MEDIO)

> **Impacto:** Arregla las 3 pantallas marcadas como ❌ críticas.
> **Riesgo:** Medio — tocan componentes con lógica.

### 2.1 `DynamicScreen.tsx` — grid de 60 columnas sin responsive
- **Archivo:** `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx:137-147` (función `widthClass`)
- **Cambio (opción CSS, preferida):** Agregar en `components.css`:
  ```css
  @media (max-width: 639px) {
    .dynamic-screen-fields-grid { grid-template-columns: 1fr !important; }
    .dynamic-screen-fields-grid > * { grid-column: span 1 !important; }
  }
  ```
  Y agregar la clase `dynamic-screen-fields-grid` al contenedor del grid en `DynamicScreen.tsx`.
- **Verificación:** Abrir una gestión con pantalla dinámica en mobile y verificar que todos los campos se apilan en 1 columna.

### 2.2 `DynamicScreen.tsx` — flex-1 sin min-h-0 en dropdown de coberturas
- **Archivo:** `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx:1553`
- **Cambio:** `<div className="overflow-y-auto flex-1">` → `<div className="overflow-y-auto flex-1 min-h-0">`
- **Verificación:** Abrir el dropdown de coberturas con muchas opciones y verificar que el scroll interno funciona.

### 2.3 `admin/menu` — layout roto en mobile
- **Archivo:** `src/app/dashboard/admin/menu/page.tsx`
- **Cambios:**
  - Línea 1081: `px-5 py-4` → `px-4 py-3 sm:px-5 sm:py-4`
  - Línea 1132: `flex gap-4 flex-1 min-h-0` → `flex flex-col sm:flex-row gap-4 flex-1 min-h-0`
  - Línea 1171: `w-[280px] shrink-0` → `w-full sm:w-[240px] lg:w-[280px] shrink-0`
  - Línea 1149: `style={{ paddingLeft: item.depth * 20 }}` → usar clase condicional o `style={{ paddingLeft: item.depth * 12 }}` en mobile (vía hook `useMediaQuery` o CSS var)
  - Envolver layout principal en `app-page` o agregar `max-w-[min(120rem,calc(100%-1rem))] mx-auto` para 1440p
- **Verificación:** Abrir `/dashboard/admin/menu` en mobile (375px) y verificar que canvas y paleta se apilan verticalmente.

### 2.4 `gestion-screens/index.tsx` — grid fijo
- **Archivo:** `src/app/dashboard/claims/[id]/gestion-screens/index.tsx:113`
- **Cambio:** `grid grid-cols-2 gap-x-4 gap-y-1` → `grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1`
- **Verificación:** Abrir pantalla de coordinación de inspección en mobile.

### 2.5 Chat de inspecciones — flex-1 sin min-h-0 (2 bugs)
- **Archivos:**
  - `src/app/dashboard/inspecciones/[id]/page.tsx:982` → agregar `min-h-0`
  - `src/app/dashboard/inspecciones/[id]/chat-tab.tsx:67` → agregar `min-h-0`
- **Verificación:** Abrir chat de inspección con muchos mensajes y verificar scroll.

### 2.6 `report-tab.tsx` — window.open sin `onafterprint`
- **Archivo:** `src/app/dashboard/inspecciones/[id]/report-tab.tsx:264-319`
- **Cambio:** Replicar patrón de `email-preview-modal.tsx:106-118`:
  ```tsx
  printWindow.print();
  printWindow.onafterprint = () => { printWindow.close(); };
  setTimeout(() => { if (!printWindow.closed) printWindow.close(); }, 1000);
  ```
- **Verificación:** Imprimir acta, cancelar diálogo, verificar que la ventana se cierra sola.

**✅ Checkpoint Fase 2:** `tsc` + `eslint` = 0. Probar en mobile: DynamicScreen, admin/menu, chat, imprimir acta. Commit: `fix: critical components responsive (DynamicScreen, admin/menu, chat, print)`.

---

## Fase 3 — Modales sin clase `modal-*` (7 modales)

> **Impacto:** Unifica 7 modales que no siguen el patrón de dimensiones fijas.
> **Riesgo:** Bajo — cambio de className.

Para cada modal, decidir: usar clase existente (`modal-sm/md/lg/xl`) o crear clase nueva en `modals.css` si se necesita ancho específico.

- [ ] **M16:** `src/components/claims/claim-location-selector.tsx:206` — `max-w-328 max-h-[90vh] p-0 overflow-hidden` → evaluar `modal-lg` o crear `modal-map` (910px o 1000px)
- [ ] **M17:** `src/app/dashboard/catalogos/gestiones/caracteristicas/screen-builder.tsx:131` — `max-w-6xl max-h-[92vh] flex flex-col p-0` → crear `modal-2xl` (1400px) en `modals.css` o usar `modal-xl`
- [ ] **M18:** `src/app/dashboard/catalogos/gestiones/email-templates/components/EmailTemplateEditor.tsx:638` — `w-[calc(100%-2rem)] max-w-6xl h-[90vh]` → crear `modal-2xl` o usar `modal-xl`
- [ ] **M19:** `src/app/dashboard/claims/[id]/page.tsx:1920` — `max-w-328 p-0 overflow-hidden` → `modal-lg` o `modal-map`
- [ ] **M20:** `src/app/dashboard/inspecciones/[id]/page.tsx:1018` — `max-w-5xl p-0 overflow-hidden` → `modal-xl` o `modal-2xl`
- [ ] **M21:** `src/app/dashboard/inspecciones/[id]/page.tsx:1056` — `modal-content max-w-[480px]` → `modal-sm` (520px, closest)
- [ ] **M22:** `src/components/layout/help-panel.tsx:596` — `max-w-4xl w-[95vw] h-[85vh]` → `modal-xl` o crear `modal-help`

**Decisión previa:** Si se necesitan anchos nuevos (1400px para screen-builder y EmailTemplateEditor), crear `modal-2xl` en `modals.css` siguiendo el patrón (overflow:hidden !important, flex flex-col, max-height por breakpoint).

**✅ Checkpoint Fase 3:** `tsc` + `eslint` = 0. Abrir los 7 modales en mobile y verificar dimensiones. Commit: `fix: unify 7 modals to modal-* classes`.

---

## Fase 4 — Catálogos: modales con `modal-grid` (~18 páginas)

> **Impacto:** Arregla el apilado de campos en mobile/tablet para ~18 catálogos.
> **Riesgo:** Bajo — cambio mecánico de `space-y-2` → `modal-grid`.
> **Patrón:** `<div className="modal-body space-y-2">` → `<div className="modal-body"><div className="modal-grid">...</div></div>`

- [ ] `catalogos/antiguedades/page.tsx`
- [ ] `catalogos/clasificacion-bien/page.tsx`
- [ ] `catalogos/clasificacion-danos/page.tsx`
- [ ] `catalogos/companias/page.tsx`
- [ ] `catalogos/corredores/page.tsx`
- [ ] `catalogos/destinos-vivienda/page.tsx`
- [ ] `catalogos/eventos/page.tsx`
- [ ] `catalogos/lineas-negocio/page.tsx`
- [ ] `catalogos/parentescos/page.tsx`
- [ ] `catalogos/productos/page.tsx`
- [ ] `catalogos/tipos-documentos/page.tsx`
- [ ] `catalogos/tipos-polizas/page.tsx`
- [ ] `catalogos/tipos-siniestros/page.tsx` (incluye grid de iconos 8 cols → `grid-cols-4 sm:grid-cols-6 lg:grid-cols-8`)
- [ ] `catalogos/ubicaciones/page.tsx`
- [ ] + los que se detecten al revisar

**✅ Checkpoint Fase 4:** `tsc` + `eslint` = 0. Abrir 3-4 modales de catálogo en mobile y verificar campos apilados. Commit: `fix: catalog modals use modal-grid for responsive fields`.

---

## Fase 5 — Tabs, toolbars y grids específicos

- [ ] **M2:** `configuracion/page.tsx:106` — tabs sin overflow-x (si no se arregló con Fase 1.3, agregar `overflow-x-auto flex-nowrap` inline)
- [ ] **M3:** `informes/page.tsx` (~200-250) — tabs de reporte sin overflow-x
- [ ] **M4:** `informes/page.tsx` (~250-300) — toolbar de filtros sin flex-wrap → usar `app-toolbar`
- [ ] **M1:** `claims/page.tsx:976, 1281, 1318, 1839, 1879` — wizard grids → agregar `grid-cols-1` base: `grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4`
- [ ] **M6:** `gestiones/[actionId]/page.tsx:255` — `grid gap-4 lg:grid-cols-3` → `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`
- [ ] **m4:** `gestiones/[actionId]/page.tsx:428` — `grid grid-cols-2 gap-2` → `grid grid-cols-1 sm:grid-cols-2 gap-2`
- [ ] **M14:** `tipos-siniestros/page.tsx:195-226` — grid iconos → `grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2`
- [ ] **M15:** `permisos/page.tsx:270` — `overflow-x-auto` → `app-data-table-wrap`
- [ ] **m5:** `permisos/page.tsx:229-266` — botones Todo/Ninguno sin flex-wrap

**✅ Checkpoint Fase 5:** `tsc` + `eslint` = 0. Probar en mobile: configuracion, informes, claims wizard, gestion individual, permisos. Commit: `fix: tabs, toolbars and grids responsive`.

---

## Fase 6 — Operaciones (5 páginas)

- [ ] **M9:** `operaciones/gestiones/page.tsx:190` — `overflow-auto border rounded-lg` → `app-data-table-wrap`
- [ ] **M11:** `operaciones/inhabilitar/page.tsx:227` y `reabrir/page.tsx:217` — mismo cambio
- [ ] **M10:** `operaciones/gestiones/page.tsx:214,229` e `inhabilitar/page.tsx:262` — botones `h-7 px-2 text-xs` → `h-9 px-3 sm:h-7 sm:px-2`
- [ ] **m6:** `carga-catalogos/page.tsx:264` y `carga-siniestros/page.tsx:195` — dropzone `p-8` → `p-4 sm:p-6`
- [ ] **m7:** `carga-catalogos/page.tsx:333` y `carga-siniestros/page.tsx:264` — `max-h-[400px]` → `max-h-[300px] sm:max-h-[400px]`
- [ ] **m8:** `inhabilitar/page.tsx:183` y `reabrir/page.tsx:178` — textarea `min-h-[60px]` → `min-h-[50px] sm:min-h-[60px]`

**✅ Checkpoint Fase 6:** `tsc` + `eslint` = 0. Probar en mobile: las 5 páginas de operaciones. Commit: `fix: operaciones responsive (tables, buttons, dropzones)`.

---

## Fase 7 — Catálogos con layout no estándar

> **Riesgo:** Medio — refactor de estructura, no solo className.

- [ ] **M12:** `coberturas/page.tsx:238-330` — refactor al patrón CRUD (`app-grid-header` + `app-grid-toolbar`); quitar `max-h-[70vh] overflow-y-auto` (línea 268) y usar scroll interno
- [ ] **M13:** `marcas/page.tsx:117-142` — migrar `app-grid-filters` → `app-grid-toolbar`
- [ ] **M13:** `monedas/page.tsx:24-34, 109-125` — migrar `app-page-header` + `app-stack` → `app-grid-header` + `app-grid-toolbar`
- [ ] **m13:** `pantallas/page.tsx:168-169` — agregar toolbar con buscador
- [ ] **m12:** `email-templates/page.tsx:137,150` — selects `w-[180px]`/`w-[140px]` → `app-filter-narrow`

**✅ Checkpoint Fase 7:** `tsc` + `eslint` = 0. Probar en mobile y tablet: coberturas, marcas, monedas, pantallas. Commit: `fix: non-standard catalog layouts to CRUD pattern`.

---

## Fase 8 — Argentismos (9 ocurrencias)

> **Riesgo:** Bajo — cambios de strings de UI.

- [ ] `configuracion/page.tsx:366` — `seleccionás` → `seleccionas`
- [ ] `DynamicScreen.tsx:5036` — `Subí` → `Sube`
- [ ] `DynamicScreen.tsx:5172` — `Subí` → `Sube`
- [ ] `DynamicScreen.tsx:5370` — `Elegí` → `Elige`
- [ ] `DynamicScreen.tsx:5383` — `Configurá` → `Configura`
- [ ] `DynamicScreen.tsx:5463` — `Hacé click` → `Haz clic`
- [ ] `src/app/page.tsx:34` — `Subí, Eliminá` → `Sube, Elimina`
- [ ] `email-templates/components/FieldInsertor.tsx:72` — `Hacé clic` → `Haz clic`
- [ ] `gestiones/gestiones/email-templates-card.tsx:185-186` — `Vinculá, Marcá` → `Vincula, Marca`

**✅ Checkpoint Fase 8:** `tsc` + `eslint` = 0. Commit: `fix: neutralize argentinisms in UI strings`.

---

## Fase 9 — Inline styles prohibidos (~25 ocurrencias)

> **Riesgo:** Medio — requiere crear clases CSS nuevas en `modals.css` o `components.css`.
> **Prioridad:** Empezar por los patrones recurrentes.

### 9.1 Clases CSS nuevas a crear en `components.css` o `modals.css`
- [ ] `dash-grid-mt` (reemplaza `style={{ marginTop: 12 }}` en `gestiones/page.tsx:125`, `mis-casos/page.tsx:138`)
- [ ] `animate-pulse-slow` / `-slower` / `-slowest` (reemplaza `animationDuration: "8s/10s/12s"` en `page.tsx:86-88`)
- [ ] `kpi-icon-gradient-{color}` (esmeralda, ámbar, slate, etc.) — reemplaza `style={{ background: linear-gradient(...) }}` en `gestiones/page.tsx:128,138,146,148`
- [ ] `glass-glow-{color}` (esmeralda, índigo, etc.) — reemplaza 19 ocurrencias de `style={{ ["--glass-glow"]: "rgba(...)" }}` en `dashboard/page.tsx`
- [ ] `swatch-btn` con CSS var `--swatch-color` — reemplaza `style={{ backgroundColor: c }}` en `EmailTemplateEditor.tsx:546,698`
- [ ] `email-header-preview` con CSS vars `--header-bg`, `--header-justify` — reemplaza `EmailTemplateEditor.tsx:612,763`
- [ ] `gestion-light-dot` (size-4) — reemplaza `style={{ width: 16, height: 16 }}` en `claims/[id]/page.tsx:1477`

### 9.2 Reemplazar inline styles por las clases nuevas
- [ ] `dashboard/page.tsx` (19 ocurrencias de `--glass-glow`)
- [ ] `gestiones/page.tsx` (8 ocurrencias)
- [ ] `mis-casos/page.tsx` (6 ocurrencias)
- [ ] `page.tsx` (3 ocurrencias de animationDuration)
- [ ] `EmailTemplateEditor.tsx` (6 ocurrencias)
- [ ] `claims/[id]/page.tsx:1477`
- [ ] Revisar y clasificar el resto: `caracteristicas/page.tsx`, `workflows/page.tsx`, `gestiones/gestiones/page.tsx`, `informes/page.tsx`, `operaciones/gestiones/page.tsx`, `carga-catalogos/page.tsx`, `carga-siniestros/page.tsx`, `lineas-negocio/page.tsx`, `tipos-cambio/page.tsx`

**✅ Checkpoint Fase 9:** `tsc` + `eslint` = 0. `grep -r "style={{" src/ | grep -v perf-panel` debe mostrar solo los casos válidos (CSS vars dinámicas, valores runtime). Commit: `fix: replace inline styles with reusable CSS classes`.

---

## Fase 10 — Verificación final

- [ ] `npx tsc --noEmit` = 0 errores
- [ ] `npx eslint` = 0 errores Y 0 warnings
- [ ] `pnpm build` exitoso
- [ ] Probar manualmente en los 4 breakpoints (usar DevTools):
  - **Mobile 375×667:** dashboard, claims, claims/[id], una gestión dinámica, un catálogo, admin/menu, chat de inspección
  - **Tablet 768×1024:** claims/[id], gestiones/[actionId], informes
  - **Desktop 1080p:** cualquier página
  - **Desktop 1440p:** dashboard, admin/menu (verificar max-width)
- [ ] Verificar que los 7 modales de Fase 3 se abren correctamente en mobile
- [ ] Verificar impresión de acta (cancelar diálogo → ventana se cierra)
- [ ] Verificar que no quedan argentismos: `grep -rn "Subí\|Elegí\|Configurá\|Hacé clic\|seleccionás\|Vinculá\|Marcá\|Eliminá" src/`
- [ ] Actualizar `docs/responsive-audit.md` marcando los problemas resueltos

---

## Resumen de esfuerzo estimado

| Fase | Archivos tocados | Complejidad | Impacto |
|------|------------------|-------------|---------|
| 1 — CSS global | 2 | Baja | 🔴 Crítico (arregla ~60%) |
| 2 — Componentes críticos | 6 | Media | 🔴 Crítico (5 pantallas ❌) |
| 3 — Modales sin clase | 7 + modals.css | Baja | 🟠 Mayor (7 modales) |
| 4 — Catálogos modal-grid | ~18 | Baja (mecánico) | 🟠 Mayor (~18 catálogos) |
| 5 — Tabs/grids específicos | ~8 | Baja | 🟠 Mayor |
| 6 — Operaciones | 5 | Baja | 🟠 Mayor |
| 7 — Catálogos no estándar | 5 | Media | 🟠 Mayor |
| 8 — Argentismos | 6 | Baja | 🟡 Regla #3 |
| 9 — Inline styles | ~15 + CSS | Media | 🟡 Regla #2 |
| 10 — Verificación | 0 | Baja | ✅ Cierre |

**Total:** ~70 archivos tocados, 10 fases.

## Orden recomendado de ejecución

```
Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6 → Fase 7 → Fase 8 → Fase 9 → Fase 10
```

**No paralelizar** Fases 1-2 (tocan los mismos archivos CSS base). Fases 4, 6, 8 son mecánicas y se pueden hacer en paralelo una vez terminadas las Fases 1-3.

## Criterio de "terminado"

Una fase termina cuando:
1. `tsc --noEmit` = 0 errores
2. `npx eslint` = 0 errores Y 0 warnings
3. Se verificó manualmente en mobile (375px) que el problema se arregló
4. Se hizo commit con mensaje siguiendo el formato `fix: ...`

---

*Plan generado a partir de `docs/responsive-audit.md`. No se modificó código, solo se creó este plan.*
