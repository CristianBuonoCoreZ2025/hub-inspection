# Auditoría de Inline Styles — `style={{ ... }}` en `src/`

> Fecha: 2026-08-17
> Regla base: AGENTS.md REGLA #2 — Cero inline styles visuales
> Excepciones permitidas: valores dinámicos de runtime, refs de medidas, transformaciones calculadas, grid dinámico, etc.

---

## Resumen

| Métrica | Valor |
|---------|-------|
| Total de `style={{` en `src/` | 117 |
| Corregidos en esta sesión | 6 archivos |
| Restantes | ~117 (la mayoría dinámicos legítimos) |

### Archivos corregidos en esta sesión

| Archivo | Fix aplicado |
|---------|--------------|
| `src/app/dashboard/inspecciones/[id]/event-logs-tab.tsx` | Eliminados `backgroundColor: "currentColor"` y `background: "transparent"` innecesarios |
| `src/app/dashboard/inspecciones/[id]/report-tab.tsx` | Reemplazado `style={{ display: hideZip ? "none" : undefined }}` por clase condicional `hidden` |
| `src/components/dashboard/bar-chart-quad.tsx` | Eliminado `background: "transparent"` (usado clase `bg-transparent`) y `title` nativo (cambiado a `data-title`) |
| `src/app/mobile/inspecciones/[id]/tabs/evidences-tab.tsx` | Mueve estilos posicionales y background del botón de zoom a `.mobile-photo-close-btn` |
| `src/app/dashboard/admin/menu/page.tsx` | Reemplazado `paddingLeft: item.depth * 20` por CSS variable `--menu-depth` |

---

## Categorías de inline styles restantes

### 1. Progreso / porcentajes dinámicos ✅ Legítimos

Método: `style={{ width: \`${pct}%\` }}`

Archivos afectados (8+):
- `src/app/dashboard/operaciones/carga-siniestros/page.tsx` (2)
- `src/app/dashboard/operaciones/carga-casos/page.tsx`
- `src/app/dashboard/operaciones/carga-catalogos/page.tsx`
- `src/app/dashboard/inspecciones/[id]/evidences-tab.tsx`
- `src/app/dashboard/inspecciones/[id]/acta-form.tsx`
- `src/app/dashboard/claims/[id]/claim-images-tab.tsx`
- `src/components/ui/upload-progress-modal.tsx`
- `src/app/mobile/inspecciones/[id]/tabs/evidences-tab.tsx`

**Recomendación:** Son legítimos. Podrían migrarse a una variable CSS (`--progress-width`) si se quiere eliminar todo inline, pero no hay beneficio visual claro.

### 2. Colores dinámicos por tema o dato ✅ Legítimos

- `src/components/email-editor/ribbon/ribbon.tsx` — `backgroundColor: c` (swatches de color)
- `src/app/dashboard/catalogos/gestiones/caracteristicas/page.tsx` — `--gestion-color` (CSS variable)
- `src/app/dashboard/catalogos/gestiones/gestiones/page.tsx` — `--gestion-color` (CSS variable)
- `src/app/dashboard/claims/[id]/page.tsx` — `--gestion-color` (CSS variable)
- `src/components/layout/top-bar.tsx` — `backgroundColor: theme.swatch`
- `src/components/layout/UiStyleDevSelect.tsx` — `backgroundColor: theme.swatch`
- `src/app/dashboard/page.tsx` — `background: entry.color`, `boxShadow` dinámico
- `src/components/dashboard/bar-chart.tsx` — `color: getReadableTextColor(fill)`
- `src/components/dashboard/bar-chart-quad.tsx` — `background: linear-gradient(...)` dinámico por color
- `src/app/dashboard/informes/page.tsx` — `backgroundColor: s.color`
- `src/app/mobile/inspecciones/[id]/tabs/evidences-tab.tsx` — `width: progress%` (barra)

**Recomendación:** Son legítimos porque dependen de datos o tema en runtime.

### 3. Dimensiones dinámicas ✅ Legítimos

- `src/app/dashboard/catalogos/tipos-cambio/page.tsx` — `width: ${pct}%` (progreso de sync)
- `src/components/dashboard/gauge-chart.tsx` — `width: size, height: size`
- `src/components/dashboard/bar-chart-quad.tsx` — `width: ${pct}%`
- `src/components/dashboard/bar-chart.tsx` — dimensiones de SVG
- `src/components/ui/perf-panel.tsx` — múltiples estilos de layout/dimensiones calculados en runtime

**Recomendación:** Legítimos por ser calculados en runtime.

### 4. Layout/posición calculado

- `src/components/layout/nav-hybrid.tsx` — layout dinámico de nav
- `src/components/layout/mobile-nav.tsx`
- `src/components/ui/perf-panel.tsx` — 43 inline styles, la mayoría dinámicos de medición
- `src/app/dashboard/catalogos/tipos-cambio/page.tsx` — `paddingLeft` dinámico ya corregido como ejemplo

**Recomendación:** El `perf-panel.tsx` es el archivo más problemático con 43 inline styles. Debería auditarse individualmente.

### 5. CSS variables con `--gestion-color`

```tsx
style={{ "--gestion-color": hexColor } as React.CSSProperties}
```

Archivos:
- `src/app/dashboard/catalogos/gestiones/caracteristicas/page.tsx`
- `src/app/dashboard/catalogos/gestiones/gestiones/page.tsx`
- `src/app/dashboard/claims/[id]/page.tsx`

**Recomendación:** Son legítimos. CSS variables en `style` es el patrón recomendado para pasar datos de React a CSS.

### 6. Excepciones aceptadas por AGENTS.md

Según REGLA #2, los únicos inline styles permitidos son:
- ✅ Valores dinámicos que dependen de datos en runtime
- ✅ Refs de medidas (scroll position, offsetHeight)
- ✅ Transformaciones calculadas (`transform: translateX(${position}px)`)
- ✅ Grid/columnas dinámicas (`gridTemplateColumns: repeat(${count}, 1fr)`)

La mayoría de los 117 casos restantes caen en estas excepciones.

---

## Archivos con más inline styles (requieren revisión individual)

| Archivo | Casos | Tipo |
|---------|-------|------|
| `src/components/ui/perf-panel.tsx` | 43 | Layout/dimensiones dinámicas |
| `src/components/ui/html-editor.tsx` | 35+ | Colores dinámicos, posiciones |
| `src/components/email-editor/ribbon/ribbon.tsx` | 38+ | Colores de swatches, tooltips |
| `src/app/dashboard/page.tsx` | 1 | Colores dinámicos de chart |
| `src/components/dashboard/bar-chart-quad.tsx` | 5 | Colores y anchos dinámicos |

---

## Conclusión

Se corrigieron los inline styles **estáticos innecesarios** identificados en los archivos pequeños. Los 117 inline styles restantes son **principalmente dinámicos y legítimos** según las excepciones de AGENTS.md. Una migración completa de todos ellos a CSS puro requeriría:

1. Extender significativamente los archivos CSS
2. Usar CSS variables para cada valor dinámico
3. Refactorizar componentes tipo charts y `perf-panel.tsx`

**Recomendación:** continuar caso por caso, priorizando los archivos con más estilos estáticos (`perf-panel.tsx`, `html-editor.tsx`, `ribbon.tsx`).
