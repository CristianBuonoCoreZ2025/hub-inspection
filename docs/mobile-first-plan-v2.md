# Plan Mobile-First v2 — Rediseño por módulo

> **Fecha:** 2026-07-28
> **Dispositivo target:** Samsung S23 Ultra (~360px), iPad, PC
> **Filosofía:** Mobile = ver información + responder inspecciones. Nada más.

---

## Principios definidos por el usuario

1. **Mobile muestra SOLO 4 módulos:** Siniestros, Inspecciones, Agenda, Informes
2. **NO hay pólizas, catálogos, gestiones, operaciones ni admin en mobile**
3. **Siniestros = ver, no editar** — vista de lectura con tabs simplificadas
4. **Inspecciones = responder desde mobile/tablet** — EL módulo crítico
5. **Agenda = 100px más de alto** en todos los dispositivos
6. **Informes = ver**
7. **El módulo de inspección es pantalla fija** (no dinámica como otras) → se puede optimizar
8. **Gestiones dentro de siniestro = preview nomás** (no editar)

---

## Módulo 1: Navegación Mobile

### Objetivo
Menú mobile con solo 4 íconos grandes, app-like.

### Items del menú mobile
```
┌─────────────────────────────────┐
│  📊  Siniestros                 │
│  🔍  Inspecciones               │
│  📅  Agenda                     │
│  📄  Informes                   │
│  ──────────────────────────     │
│  🚪  Cerrar sesión              │
└─────────────────────────────────┘
```

### Cambios técnicos
- **`nav-data.ts`**: Agregar `hideOnMobile?: boolean` a la interfaz `NavLink`
- Marcar como `hideOnMobile: true`:
  - Dashboard (quedar solo en desktop)
  - Pólizas
  - Todos los catálogos (generales + inspección)
  - Configuración de gestiones
  - Operaciones
  - Administración
- **`use-nav-links.ts`**: Filtrar items con `hideOnMobile` cuando es mobile
- **`mobile-nav.tsx`**: Rediseñar con íconos grandes (48px), lista simple, sin acordeones
- Detectar mobile: `useMediaQuery` o CSS `lg:` breakpoint

### Archivos
- `src/components/layout/nav-data.ts`
- `src/hooks/use-nav-links.ts`
- `src/components/layout/mobile-nav.tsx`

---

## Módulo 2: Siniestros Mobile

### 2.1 — Grilla mobile simplificada

**Columnas mobile (4 solo):**
| Columna | Campo | Ancho |
|---------|-------|-------|
| N° Liquidación | `liquidation_number` | fijo 110px |
| Ref Cliente | `client_reference` | fijo 100px |
| Asegurado | `getParticipant(insured)?.full_name` | flex (resto) |
| Estado | icono de color (amarillo/verde/rojo) | 32px |

**Columnas desktop (mantener las 10 actuales)**

### Cambios técnicos
- `claims/page.tsx`: Agregar `hidden sm:table-cell` a las columnas que se ocultan en mobile
- Estado en mobile: solo icono de color (sin texto), 32px, redondeado
- Click en fila → vista detalle (no edición)

### 2.2 — Vista detalle siniestro (view-only en mobile)

**Tabs en mobile (simplificadas):**
```
┌─────────────────────────────────────┐
│  Siniestro | Participantes | Incidente │
│  Gestiones | Documentos | Imágenes     │
└─────────────────────────────────────┘
```

- **Siniestro**: datos del siniestro (view-only, sin botones de editar)
- **Participantes**: lista de participantes (view-only)
- **Incidente**: datos del incidente (view-only)
- **Gestiones**: lista de gestiones con preview (NO editar, NO crear)
- **Documentos**: lista de documentos (ver/descargar, NO subir)
- **Imágenes**: galería de imágenes (ver, NO subir)

**En desktop:** mantener funcionalidad completa (editar, crear, etc.)

### Cambios técnicos
- `claims/[id]/page.tsx`: Detectar mobile → ocultar botones de editar/crear
- Tabs: mantener las mismas pero en modo view-only
- Gestiones: `disabled` en mobile, solo mostrar info
- Agregar clase `mobile-view-only` que oculte botones de acción en mobile

### Archivos
- `src/app/dashboard/claims/page.tsx` (grilla)
- `src/app/dashboard/claims/[id]/page.tsx` (detalle)

---

## Módulo 3: Inspecciones Mobile — EL MÓDULO CRÍTICO

### Objetivo
> "El inspector puede responder la inspección desde el celular."

### 3.1 — Lista de inspecciones mobile

**Columnas mobile (3):**
| Columna | Campo |
|---------|-------|
| Siniestro | `liquidation_number` |
| Dirección | dirección del asegurado |
| Estado | icono de color |

Click → entra a la inspección

### 3.2 — Pantalla de inspección mobile (responder)

El módulo de inspección usa **pantalla fija** (no dinámica), así que se puede optimizar:

**Tabs de inspección (mobile):**
```
┌──────────────────────────────────────┐
│  📋 Checklist | 📸 Evidencias         │
│  💥 Daños | ✍️ Firmas | 📝 Notas      │
│  📄 Acta/PDF                          │
└──────────────────────────────────────┘
```

**Funcionalidad mobile habilitada:**
- ✅ Checklist: marcar/desmarcar items
- ✅ Evidencias: tomar foto (cámara del celular), subir, ver
- ✅ Daños: marificar daños
- ✅ Firmas: firmar con touch
- ✅ Notas: escribir notas (teclado mobile)
- ✅ Acta/PDF: generar y descargar

**Restricciones mobile:**
- ❌ Croquis: solo ver (el drawing canvas es muy complejo en mobile pequeño)
- ❌ Configuración de inspección: no accesible

### Cambios técnicos
- `inspecciones/[id]/page.tsx`: Layout responsive para cada tab
- `evidences-tab.tsx`: Botón "Tomar foto" que usa `<input type="file" accept="image/*" capture="environment">`
- `damages-tab.tsx`: Lista de daños con edición touch-friendly
- `signatures-tab.tsx`: Canvas de firma touch-optimized (pointer events)
- `checklist-tab.tsx`: Toggle switches grandes (44px touch target)
- `report-tab.tsx`: Vista del acta renderizada + botón descargar

### Optimizaciones específicas mobile
- Botones de 48px height (no 36px como desktop)
- Inputs con `inputmode` apropiado (numeric, tel, etc.)
- `touch-action: manipulation` para evitar double-tap zoom
- `-webkit-tap-highlight-color: transparent`
- Scroll suave con `-webkit-overflow-scrolling: touch`

### Archivos
- `src/app/dashboard/inspecciones/page.tsx` (lista)
- `src/app/dashboard/inspecciones/[id]/page.tsx` (detalle)
- `src/app/dashboard/inspecciones/[id]/evidences-tab.tsx`
- `src/app/dashboard/inspecciones/[id]/damages-tab.tsx`
- `src/app/dashboard/inspecciones/[id]/signatures-tab.tsx`
- `src/app/dashboard/inspecciones/[id]/chat-tab.tsx`
- `src/app/dashboard/inspecciones/[id]/report-tab.tsx`

---

## Módulo 4: Agenda — 100px más de alto

### Objetivo
> "El alto de la grilla de la agenda tiene que ser 100 píxeles más abajo.
> Tiene que ser una cosa un poco más amplia."

### 4.1 — Altura de la agenda (+100px en todos los dispositivos)

**Actual:**
- `min-h-[280px]` en mobile
- `min-h-[400px]` en sm+

**Nuevo:**
- `min-h-[380px]` en mobile (+100px)
- `min-h-[500px]` en sm+ (+100px)

### 4.2 — Fix scroll mobile (P0-3)

- Quitar `overflow: hidden` de `.agenda-calendar`
- Select de inspectores: `width: 100%` en mobile, `260px` en desktop
- En mobile: mostrar 1 día con botones prev/next (swipe opcional fase posterior)

### 4.3 — Vista de día en mobile (futura)

En mobile (<640px): mostrar solo 1 día
- Header con día actual + botones ‹ ›
- Lista de inspecciones del día (cards, no grid)
- En desktop: mantener vista semanal

### Archivos
- `src/app/dashboard/agenda/page.tsx`
- `src/app/styles/dashboard.css`

---

## Módulo 5: Informes Mobile

### Objetivo
> "Me gusta mucho eso. Me gusta el detalle de los siniestros."

### Cambios
- Informes funciona bien en mobile (según feedback)
- Solo ajustar: grilla de "detalle de siniestros" con menos columnas en mobile
  - Mobile: N° Liquidación, Asegurado, Estado
  - Desktop: todas las columnas
- Botones mobile diferenciados (48px)

### Archivos
- `src/app/dashboard/informes/page.tsx`

---

## Módulo 6: Dashboard Mobile (limpieza)

### Objetivo
Dashboard se ve pero el chart de compañías necesita fix.

### 6.1 — Fix "VALUE 2" → "Siniestros"
- Agregar `label` prop a `BarChartGlass`
- Pasar `name={label}` al `<Bar>` de Recharts

### 6.2 — Compañías apretadas
- Mobile: top 3 en vez de top 5
- Desktop: top 5 (mantener)

### Archivos
- `src/components/dashboard/bar-chart.tsx`
- `src/app/dashboard/page.tsx`

---

## Módulo 7: Pólizas — solo listar en web

### Objetivo
> "Pólizas, que me salgan las pólizas, pero solamente un listar.
> Y siento que por web, solamente tiene que ser listar."

### Cambios
- **Mobile:** No aparece en el menú (oculto)
- **Web:** Solo listado, sin edición detallada (quitar botones de editar/crear)
- **Botón Guardar en póliza:** Si se mantiene edición, hacer sticky en mobile

### Archivos
- `src/app/dashboard/catalogos/polizas/[id]/page.tsx`

---

## Módulo 8: Bugs críticos (P0)

### 8.1 — Combo gestiones "línea" → nombre real
```tsx
// Actual (hardcodeado):
if (tpl.line_business_id) tags.push("Línea");

// Nuevo (resolver nombre real):
const lineName = businessLinesCatalog?.find(b => b.id === tpl.line_business_id)?.name;
tags.push(lineName || "Línea");
// Hacer lo mismo para Evento y Cía
```

### 8.2 — Coordinación inspección editar no funciona
- Investigar bug del modal de coordinación
- El email dentro de coordinación tiene espacio extraño arriba
- No funciona ni PC ni mobile

### Archivos
- `src/app/dashboard/claims/[id]/page.tsx`

---

## Orden de ejecución

### Sprint 1: Navegación + Bugs críticos (prioridad máxima)
```
Fase A: Nav mobile (4 íconos) + filtrado hideOnMobile
Fase B: Bug combo "línea" + bug coordinación
Fase C: Agenda +100px + fix scroll
```

### Sprint 2: Siniestros mobile
```
Fase D: Grilla siniestros (4 columnas mobile)
Fase E: Vista detalle siniestro view-only mobile
```

### Sprint 3: Inspecciones mobile (EL CRÍTICO)
```
Fase F: Lista inspecciones mobile
Fase G: Checklist mobile (toggle switches)
Fase H: Evidencias mobile (cámara del celular)
Fase I: Daños mobile (touch-friendly)
Fase J: Firmas mobile (canvas touch)
Fase K: Notas + Acta/PDF mobile
```

### Sprint 4: Pulido
```
Fase L: Dashboard chart fixes (VALUE 2, compañías)
Fase M: Informes grilla mobile
Fase N: Botones mobile diferenciados (48px)
Fase O: Pólizas solo listar
```

---

## Estimación por sprint

| Sprint | Fases | Esfuerzo | Impacto |
|--------|-------|----------|---------|
| 1 | A, B, C | 3-4 horas | Alto (nav + bugs) |
| 2 | D, E | 3-4 horas | Medio (siniestros) |
| 3 | F-K | 6-8 horas | **Crítico (inspecciones)** |
| 4 | L-O | 3-4 horas | Bajo (pulido) |
| **Total** | | **15-20 horas** | |

---

## Reglas de diseño mobile

1. **Touch target mínimo:** 44px (iOS) / 48px (Android) — usar 48px
2. **Botones mobile:** full width o min 120px, height 48px
3. **Inputs mobile:** height 48px, font-size 16px (evita zoom iOS)
4. **Tabs mobile:** scroll horizontal si exceden ancho
5. **Modales mobile:** full screen (`h-[100vh]`) o `modal-sm` con `h-[90vh]`
6. **Grillas mobile:** máximo 4 columnas visibles, resto ocultas
7. **Fuentes mobile:** mínimo 14px body, 12px captions
8. **Scroll:** `-webkit-overflow-scrolling: touch` en contenedores scrollables
9. **Touch:** `touch-action: manipulation` para evitar double-tap zoom
10. **Tap highlight:** `-webkit-tap-highlight-color: transparent`
