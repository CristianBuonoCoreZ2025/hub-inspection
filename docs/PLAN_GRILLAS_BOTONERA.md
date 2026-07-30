# PLAN — Estándar de Grillas y Botonera Global

> **Estado:** BORRADOR — pendiente de aprobación
> **Fecha:** 2026-07-28
> **Objetivo:** Unificar todas las grillas del sistema a un solo estándar (grilla de siniestros) + crear una botonera inferior global reutilizable.

---

## 1. ANÁLISIS DEL ESTADO ACTUAL

### 1.1 Grilla de Siniestros (EL ESTÁNDAR)

```
┌─────────────────────────────────────────────────────────────────┐
│ [icono] Siniestros                          [Exportar] [Nuevo]  │ ← app-grid-header
├─────────────────────────────────────────────────────────────────┤
│ [🔍 Buscar...] [Estado▼] [Desde📅] [Hasta📅] [Limpiar]  ⏮◀1▶⏭ │ ← app-grid-toolbar
│                                                        100 reg │   (controls)
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Liquidación │ Estado │ Asegurado │ Cía │ Fecha │ ...        │ │ ← app-data-table
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ L-000000141 │ Creado  │ María...  │ MAP │ 28-07 │ ...        │ │
│ │ L-000000142 │ Liquid. │ Juan...   │ BCI │ 27-07 │ ...        │ │
│ │ ...                                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ Mostrando 1-100 de 247    [100▼]  ⏮ ◀ [1] 2 3 ▶ ⏭            │ ← Pagination full
└─────────────────────────────────────────────────────────────────┘
```

**Características:**
- Botones arriba (Exportar, Nuevo)
- Filtros arriba-izquierda, paginado arriba-derecha
- Tabla en el medio
- Paginado completo abajo (con selector de registros por página)
- Default: 100 registros (hardcodeado en `src/lib/config.ts`)

### 1.2 Grilla de Gestiones (DEBE ALINEARSE)

```
┌─────────────────────────────────────────────────────────────────┐
│ [icono] Gestiones                                              │ ← header SIN botones
├─────────────────────────────────────────────────────────────────┤
│ [Todas][En curso][Revisiones][Aprobación][Alarma][Atrasadas]   │ ← tabs (6)
├─────────────────────────────────────────────────────────────────┤
│ [KPI: En curso]  [KPI: Revisiones]  [KPI: Atrasadas]           │ ← 3 KPI cards
├─────────────────────────────────────────────────────────────────┤
│ [🔍 Buscar...]                              ⏮◀1▶⏭            │ ← toolbar
│                                              12 reg             │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │ ← grid de CARDS
│ │ Gestión  │ │ Gestión  │ │ Gestión  │ │ Gestión  │           │   (no tabla)
│ │ HINS-001 │ │ HINS-002 │ │ HINS-003 │ │ HINS-004 │           │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────┤
│ Mostrando 1-12 de 45    [12▼]  ⏮ ◀ [1] 2 3 4 ▶ ⏭             │
└─────────────────────────────────────────────────────────────────┘
```

**Problemas:**
- NO tiene botones de acción (Nuevo, Editar)
- 12 registros por página (inconsistente con siniestros)
- Es grid de cards, no tabla (distinto tipo de grilla)

### 1.3 Grilla de Gestiones dentro del Siniestro (con tabs)

```
┌─────────────────────────────────────────────────────────────────┐
│ [icono] Siniestro L-000000141           [Editar] [Cerrar]      │ ← header
├─────────────────────────────────────────────────────────────────┤
│ [Datos] [Gestiones] [Documentos] [Imágenes] [Log]              │ ← tabs
├─────────────────────────────────────────────────────────────────┤
│ [Lista▼] [Workflow▼] [☑ Deshabilitada] [☑ Rechazada]          │ ← filtros
│                                          [NUEVO] ← botón grande│
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Código │ Gestión │ Estado │ Fecha │ ...                      │ │ ← tabla
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ (sin paginado visible o inconsistente)                          │
└─────────────────────────────────────────────────────────────────┘
```

**Problemas:**
- Botón "NUEVO" enorme en el toolbar (debería estar arriba como en siniestros)
- Filtros "Rechazada" y "Deshabilitada" son texto largo (deberían ser iconos)
- Paginado inconsistente

### 1.4 Grilla de Documentos

```
┌─────────────────────────────────────────────────────────────────┐
│ [Documentos]                              [Subir]              │ ← toolbar con botón
├─────────────────────────────────────────────────────────────────┤
│ Origen │ Código │ Tipo │ Extensión │ Tamaño │ Acciones         │ ← tabla
├─────────────────────────────────────────────────────────────────┤
│ Mostrando 1-10 de 25    [10▼]  ⏮ ◀ [1] 2 3 ▶ ⏭              │
└─────────────────────────────────────────────────────────────────┘
```

**Problemas:**
- 10 registros por página (inconsistente)
- Botón "Subir" en toolbar (debería estar arriba)

### 1.5 Grilla de Imágenes

```
┌─────────────────────────────────────────────────────────────────┐
│ [Imágenes]                                [Subir]              │ ← toolbar con botón
├─────────────────────────────────────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                     │ ← grid de imágenes
│ │img │ │img │ │img │ │img │ │img │ │img │                     │
│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                     │
├─────────────────────────────────────────────────────────────────┤
│ Mostrando 1-12 de 30    [12▼]  ⏮ ◀ [1] 2 3 ▶ ⏭              │
└─────────────────────────────────────────────────────────────────┘
```

**Problemas:**
- 12 registros por página (inconsistente)
- Botón "Subir" en toolbar (debería estar arriba)

### 1.6 Grilla de Log/Audit

```
┌─────────────────────────────────────────────────────────────────┐
│ [Log]                                                          │ ← sin botones
├─────────────────────────────────────────────────────────────────┤
│ Acción │ Detalle │ Usuario │ Fecha                             │ ← tabla
│ (sin paginado — muestra TODO)                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Problemas:**
- NO tiene paginado (muestra todos los registros)
- Sin límite puede ser problema de performance

### 1.7 Agenda (barra inferior — LA INSPIRACIÓN)

```
┌─────────────────────────────────────────────────────────────────┐
│ Agenda                                                         │
├─────────────────────────────────────────────────────────────────┤
│ [◀ Semana anterior] [Hoy] [Semana siguiente ▶]  [Inspector▼]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Lunes    Martes    Miércoles    Jueves    Viernes              │
│  ┌─────┐  ┌─────┐   ┌─────┐      ┌─────┐   ┌─────┐             │
│  │ ev  │  │ ev  │   │ ev  │      │     │   │ ev  │             │
│  └─────┘  └─────┘   └─────┘      └─────┘   └─────┘             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ● Presencial  ● Remota  ● Con casos  ○ Sin casos             │ ← agenda-legend
└─────────────────────────────────────────────────────────────────┘
```

**Lo que nos gusta:** La barra inferior (`agenda-legend`) con información + estilo pill glass.

---

## 2. ESTÁNDARES PROPUESTOS

### 2.1 Estándar de Grilla de Tabla (tipo Siniestros)

Para grillas que muestran datos tabulares (siniestros, documentos, logs, gestiones dentro de un siniestro):

```
┌─────────────────────────────────────────────────────────────────┐
│ [icono] TÍTULO                           [Acción1] [Acción2]   │ ← app-grid-header
├─────────────────────────────────────────────────────────────────┤
│ [🔍 Buscar...] [Filtro▼] [Filtro▼] [Limpiar]    ⏮◀1▶⏭        │ ← app-grid-toolbar
│                                                 50 reg          │   (controls)
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Col1 │ Col2 │ Col3 │ Col4 │ Acciones                        │ │ ← app-data-table
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ...  │ ...  │ ...  │ ...  │ ...                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ Mostrando 1-50 de N      [50▼]  ⏮ ◀ [1] 2 3 ▶ ⏭             │ ← Pagination full
└─────────────────────────────────────────────────────────────────┘
```

**Reglas:**
- Botones de acción arriba (Exportar, Nuevo, Subir) — NUNCA en toolbar
- Filtros arriba-izquierda
- Paginado compacto arriba-derecha (solo navegación)
- Tabla en el medio
- Paginado completo abajo (con selector de registros por página)
- Default: 50 registros (configurable desde system_settings)

### 2.2 Estándar de Grilla de Cards (tipo Gestiones/Mis Casos)

Para grillas que muestran tarjetas (gestiones, mis casos):

```
┌─────────────────────────────────────────────────────────────────┐
│ [icono] TÍTULO                           [Acción1] [Acción2]   │ ← app-grid-header
├─────────────────────────────────────────────────────────────────┤
│ [Tab1] [Tab2] [Tab3] [Tab4]                                    │ ← tabs (opcional)
├─────────────────────────────────────────────────────────────────┤
│ [KPI1]  [KPI2]  [KPI3]                                        │ ← KPIs (opcional)
├─────────────────────────────────────────────────────────────────┤
│ [🔍 Buscar...]                                  ⏮◀1▶⏭        │ ← app-grid-toolbar
│                                                 50 reg          │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │ ← grid de cards
│ │  Card 1  │ │  Card 2  │ │  Card 3  │ │  Card 4  │           │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │  Card 5  │ │  Card 6  │ │  Card 7  │ │  Card 8  │           │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────┤
│ Mostrando 1-50 de N      [50▼]  ⏮ ◀ [1] 2 3 ▶ ⏭             │ ← Pagination full
└─────────────────────────────────────────────────────────────────┘
```

**Reglas:**
- Mismo header que grilla de tabla
- Tabs y KPIs opcionales, entre header y toolbar
- Mismo toolbar, mismo paginado
- Cards en grid responsive (auto-fill, minmax)
- Mismo paginado completo abajo

### 2.3 Estándar de Grilla con Tabs (tipo Siniestro > Gestiones)

Para grillas que están dentro de una página con tabs (gestiones, documentos, imágenes, log dentro del siniestro):

```
┌─────────────────────────────────────────────────────────────────┐
│ [icono] Siniestro L-000000141           [Editar] [Cerrar]      │ ← header de página
├─────────────────────────────────────────────────────────────────┤
│ [Datos] [Gestiones] [Documentos] [Imágenes] [Log]              │ ← tabs de página
├─────────────────────────────────────────────────────────────────┤
│ │← sub-header del tab activo:                                  │
│ │ [icono] GESTIONES                       [Nuevo]              │ ← sub-header con botón
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ [🔍 Buscar...] [Lista▼] [Workflow▼] [iconos]   ⏮◀1▶⏭     │ │ ← toolbar
│ │                                                50 reg        │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Código │ Gestión │ Estado │ Fecha │ ...                 │ │ │ ← tabla
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Mostrando 1-50 de N    [50▼]  ⏮ ◀ [1] 2 3 ▶ ⏭           │ │ ← paginado
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  💡 Info contextual / resumen          [Acción] [Acción]       │ ← BOTTOM BAR (nueva)
└─────────────────────────────────────────────────────────────────┘
```

**Reglas:**
- Cada tab tiene su propio sub-header con icono + título + botones de acción
- El toolbar, tabla y paginado siguen el mismo estándar
- La botonera inferior (bottom bar) es global, ver sección 2.4

### 2.4 Bottom Action Bar (NUEVA — inspirada en agenda-legend)

Bara inferior global reutilizable para TODAS las páginas. División 70/30:

```
┌─────────────────────────────────────────────────────────────────┐
│  💡 Información contextual / resumen     [Botón] [Botón]      │
│  (70% del ancho)                         (30% del ancho)       │
└─────────────────────────────────────────────────────────────────┘
```

**Estructura:**
- **Lado izquierdo (70%):** Información contextual, leyenda, resumen, contadores
- **Lado derecho (30%):** Botones de acción (Nuevo, Editar, Guardar, etc.)
- **Estilo:** Pill glass (como `agenda-legend`), sticky en el fondo
- **Clase CSS:** `app-bottom-bar` (nueva, en `components.css`)
- **Componente React:** `<BottomBar info={...} actions={...} />` (nuevo)

**Ejemplos de uso:**

| Página | Lado izquierdo (70%) | Lado derecho (30%) |
|--------|---------------------|-------------------|
| Siniestros | "247 siniestros · 12 en creación" | [Exportar] [Nuevo] |
| Gestiones | "45 gestiones · 8 en revisión" | [Nuevo] |
| Ficha siniestro | "L-000000141 · 5 gestiones · 12 docs" | [Editar] [Cerrar] |
| Ficha inspección | "Sesión activa · 3 evidencias" | [Iniciar] [Reagendar] |
| Agenda | ● Presencial ● Remota ● Con casos | (sin botones) |
| Documentos | "25 documentos · 2.4 MB total" | [Subir] |
| Log | "147 eventos · Último: hace 2 min" | (sin botones) |

---

## 3. CONFIGURACIÓN GLOBAL DE REGISTROS POR PÁGINA

### 3.1 Setting en system_settings

```sql
INSERT INTO system_settings (key, value, description)
VALUES ('default_page_size', '50', 'Registros por página por defecto en grillas');
```

### 3.2 UI en Configuración

En `src/app/dashboard/configuracion/page.tsx`, tab "General", agregar:

```
┌─────────────────────────────────────────────────────────────────┐
│ General                                                         │
├─────────────────────────────────────────────────────────────────┤
│ ...                                                             │
│ Registros por página en grillas                                │
│ ┌─────────┐                                                     │
│ │ 50      │  Número de registros que se muestran por defecto   │
│ └─────────┘  en todas las grillas del sistema.                 │
│ ...                                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Cambios en código

- `src/lib/config.ts`: `defaultPageSize` lee de `getSystemSetting("default_page_size")` en vez de estar hardcodeado
- `src/hooks/use-pagination.ts`: Usa el valor del setting como default
- `src/components/ui/pagination.tsx`: Las opciones del selector vienen del setting

---

## 4. CLASES CSS GLOBALES (nuevas)

### 4.1 Bottom Action Bar

```css
/* src/app/styles/components.css */

.app-bottom-bar {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 16px !important;
  padding: 10px 20px !important;
  border-radius: 999px !important;
  border: 1px solid transparent !important;
  background: linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.03) 100%) border-box !important;
  backdrop-filter: blur(20px) saturate(150%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(150%) !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.05), 0 1px 0 0.5px rgba(255,255,255,0.3) inset !important;
  position: sticky !important;
  bottom: 0 !important;
  z-index: 10 !important;
}

.app-bottom-bar-info {
  flex: 1 1 70% !important;
  display: flex !important;
  align-items: center !important;
  gap: 16px !important;
  font-size: 11px !important;
  color: var(--muted-foreground) !important;
}

.app-bottom-bar-actions {
  flex: 0 0 30% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 8px !important;
}
```

### 4.2 Sub-header de tab (para grillas dentro de tabs)

```css
.app-tab-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  padding: 12px 20px !important;
  border-bottom: 1px solid var(--border) !important;
}

.app-tab-header-left {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
}

.app-tab-header-title {
  font-size: 16px !important;
  font-weight: 600 !important;
  color: var(--foreground) !important;
}
```

---

## 5. COMPONENTE REUTILIZABLE BottomBar

```tsx
// src/components/ui/bottom-bar.tsx

interface BottomBarProps {
  info?: React.ReactNode;      // Lado izquierdo (70%)
  actions?: React.ReactNode;   // Lado derecho (30%)
}

export function BottomBar({ info, actions }: BottomBarProps) {
  if (!info && !actions) return null;
  return (
    <div className="app-bottom-bar">
      <div className="app-bottom-bar-info">{info}</div>
      {actions && <div className="app-bottom-bar-actions">{actions}</div>}
    </div>
  );
}
```

---

## 6. PLAN DE EJECUCIÓN

### Fase 1: Infraestructura (sin tocar páginas)
1. Crear migración `default_page_size` en `system_settings`
2. Modificar `src/lib/config.ts` para leer del setting
3. Agregar UI en configuración (tab General)
4. Crear componente `BottomBar` + CSS `app-bottom-bar`
5. Crear CSS `app-tab-header` para sub-headers de tabs

### Fase 2: Grilla de Siniestros (referencia — mínimos cambios)
1. Mover botones Exportar/Nuevo del header a la `BottomBar`
2. Cambiar default de 100 a 50 registros
3. Verificar que todo se ve igual o mejor

### Fase 3: Grilla de Gestiones (dentro del siniestro)
1. Mover botón "NUEVO" del toolbar al sub-header del tab
2. Cambiar "Rechazada" y "Deshabilitada" a iconos pequeños
3. Agregar paginado consistente (50 registros)
4. Agregar `BottomBar` con info + acciones

### Fase 4: Grillas de Documentos, Imágenes, Log
1. **Documentos:** Mover "Subir" al sub-header, paginado a 50
2. **Imágenes:** Mover "Subir" al sub-header, paginado a 50
3. **Log:** Agregar paginado (50 registros), agregar `BottomBar` con info

### Fase 5: Pantallas de edición (ficha siniestro, ficha inspección)
1. **Ficha siniestro:** Mover Editar/Cerrar a `BottomBar`
2. **Ficha inspección:** Mover botones de acción a `BottomBar`
3. **Ficha gestión:** Mover Guardar/Workflow a `BottomBar`

### Fase 6: Grilla de Gestiones (página principal) y Mis Casos
1. Mover tabs/KPIs a posición estándar
2. Agregar `BottomBar` con info + acciones
3. Paginado a 50

### Fase 7: Agenda
1. Reemplazar `agenda-legend` inline con componente `BottomBar`
2. Mover info de leyenda al lado izquierdo (70%)

---

## 7. TIPOS DE GRILLA IDENTIFICADOS

| Tipo | Páginas | Descripción |
|------|---------|-------------|
| **Tabla** | Siniestros, Documentos, Log, Gestiones (tab) | Tabla con filas y columnas |
| **Cards** | Gestiones (principal), Mis Casos | Grid de tarjetas |
| **Imágenes** | Imágenes | Grid de imágenes con thumbnails |
| **Calendario** | Agenda | Vista semanal de calendario |
| **Detalle** | Ficha siniestro, Ficha inspección, Ficha gestión | Página de detalle con botones |

**Cada tipo usa el mismo header, toolbar y paginado. Solo cambia el contenido del medio.**

---

## 8. INVENTARIO DE PÁGINAS A MODIFICAR

### Grillas (aplicar estándar de grilla)
1. `src/app/dashboard/claims/page.tsx` — Siniestros (referencia)
2. `src/app/dashboard/gestiones/page.tsx` — Gestiones (cards)
3. `src/app/dashboard/mis-casos/page.tsx` — Mis Casos (cards)
4. `src/app/dashboard/claims/[id]/claim-gestiones-tab.tsx` — Gestiones del siniestro (tabla)
5. `src/app/dashboard/claims/[id]/claim-documents-tab.tsx` — Documentos (tabla)
6. `src/app/dashboard/claims/[id]/claim-images-tab.tsx` — Imágenes (grid)
7. `src/app/dashboard/claims/[id]/audit-log-section.tsx` — Log (tabla, sin paginado)

### Pantallas de detalle (aplicar BottomBar)
8. `src/app/dashboard/claims/[id]/page.tsx` — Ficha siniestro
9. `src/app/dashboard/inspecciones/[id]/page.tsx` — Ficha inspección
10. `src/app/dashboard/claims/[id]/gestiones/[actionId]/page.tsx` — Ficha gestión

### Agenda (reemplazar legend)
11. `src/app/dashboard/agenda/page.tsx` — Agenda

### Configuración
12. `src/app/dashboard/configuracion/page.tsx` — Agregar setting page_size

### Catálogos (bonus — si hay tiempo)
13. Todas las grillas de catálogos (`src/app/dashboard/catalogos/*/page.tsx`)

---

## 9. CRITERIOS DE ACEPTACIÓN

- [ ] Todas las grillas tienen el mismo layout (header → toolbar → contenido → paginado)
- [ ] Todas las grillas usan 50 registros por defecto (configurable)
- [ ] Los botones de acción están SIEMPRE arriba (header) o en la BottomBar (abajo)
- [ ] Ningún botón está en el toolbar de filtros
- [ ] La BottomBar aparece en todas las páginas con botones o info contextual
- [ ] Los filtros "Rechazada" y "Deshabilitada" son iconos, no texto
- [ ] El paginado es consistente (mismo componente, mismo estilo)
- [ ] No hay estilos inline en las grillas (todo en CSS global)
- [ ] El setting de page_size se puede cambiar desde configuración
- [ ] tsc + eslint + build pasan sin errores ni warnings

---

## 10. ORDEN DE EJECUCIÓN SUGERIDO

1. **Hoy:** Subir mejoras de responsive + email composer a main (ya listo)
2. **Mañana:** Fase 1 (infraestructura) — sin tocar páginas
3. **Mañana:** Fase 2 (siniestros) — referencia
4. **Día siguiente:** Fase 3 + 4 (gestiones, documentos, imágenes, log)
5. **Día siguiente:** Fase 5 (pantallas de detalle)
6. **Día siguiente:** Fase 6 + 7 (gestiones principal, mis casos, agenda)
7. **Último:** Fase 8 (catálogos) — si hay tiempo

---

## PENDIENTE DE APROBACIÓN

Este plan está pendiente de aprobación del usuario. No se inicia ninguna implementación hasta que el usuario diga "OK, empieza".
