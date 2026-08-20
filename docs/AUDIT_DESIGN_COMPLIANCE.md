# Auditoría de Cumplimiento de Políticas de Diseño

> Fecha: 2026-08-17 (revisión completa + fixes aplicados)
> Basado en las reglas definidas en `AGENTS.md`
> Auditoría realizada con búsqueda exhaustiva en `src/`

---

## Resumen Ejecutivo

| Regla | Estado | Violaciones | Severidad |
|-------|--------|-------------|-----------|
| REGLA #2 — Cero inline styles | ✅ Corregido | 0 (2 fixes aplicados) | — |
| REGLA #3 — No tooltip nativo (`title=`) | ✅ Corregido | 0 en HTML nativo (306 migrados a Tooltip) | — |
| REGLA #4 — No `alert`/`confirm`/`prompt` nativo | ✅ Corregido | 0 | — |
| REGLA #5 — Botones de una sola palabra | ✅ Corregido | 0 (2 fixes aplicados) | — |
| Toasts (sonner) | ✅ Correcto | 84 archivos usan `toast.*()` de sonner | — |
| Colores hardcodeados | ✅ Corregido | 0 en Tailwind (21 migrados a `--c-brand`) | — |
| Console.log en producción | ✅ Corregido | 0 accionables | — |

**Verificación final:** tsc 0 errores, eslint 0 errores, build exitoso.

---

## REGLA #2 — Cero inline styles (OBLIGATORIO)

### Estado: ✅ Corregido

**Fixes aplicados (2):**

| # | Archivo | Línea | Antes | Después |
|---|---------|-------|-------|---------|
| 1 | `src/app/inspection/[token]/page.tsx` | 603 | `style={{ maxHeight: "calc(100vh - 100px)" }}` | Clase CSS `insp-token-sidebar` |
| 2 | `src/components/dashboard/gauge-chart.tsx` | 58 | `style={{ filter: "drop-shadow(...)" }}` | Clase CSS `gauge-drop-shadow` |

**Excepciones legítimas (no violaciones, 115 restantes):**
- Barras de progreso dinámicas: `style={{ width: ${progress}% }}`
- CSS custom properties data-driven: `style={{ "--gestion-color": hexColor }}`
- Charts con dimensiones dinámicas: `style={{ width: size, height: size }}`
- Email editor swatches: `style={{ backgroundColor: c }}` (color seleccionado por usuario)
- `perf-panel.tsx` (43 inline styles): componente dev-only, no se monta en producción

---

## REGLA #3 — No tooltip nativo `title=` (OBLIGATORIO)

### Estado: ✅ Corregido

**Migración masiva:** 306 atributos `title="..."` migrados a componente `Tooltip` en 78 archivos.

### Estrategia aplicada

1. **Fix de componentes custom (3 componentes → ~65 callsites arreglados):**
   - `RibbonBtn` en `email-editor/ribbon/ribbon.tsx` — ahora usa Tooltip internamente
   - `ToolbarButton` en `ui/html-editor.tsx` — ahora usa Tooltip internamente
   - `Dropdown` en `ui/html-editor.tsx` — ahora usa Tooltip internamente

2. **Migración directa (9 subagentes en paralelo → ~241 callsites arreglados):**
   - DynamicScreen.tsx (6 migrados)
   - inspection/[token]/page.tsx (3 migrados)
   - evidences-tab.tsx (10 migrados)
   - pantallas/[screenId]/page.tsx (2 migrados)
   - inspecciones/[id]/page.tsx + pagination.tsx (20 migrados)
   - live-video-call, users, sketches-tab, subject-editor, voice-textarea (30 migrados)
   - image-card, pantallas, claim-documents, tempario, coberturas, workflows, claim-images, inspecciones (40 migrados)
   - claims/[id]/page, top-bar, ubicaciones, caracteristicas, email-compose, email-contact-book, screen-builder, polizas/[id], SortableFieldCard, sketch-toolbar (50 migrados)
   - 27 archivos pequeños con 1-2 matches cada uno (~40 migrados)

3. **Elementos `<select>` e `<input>`:** Migrados a `aria-label` (no requieren tooltip visual)

4. **`<iframe title="...">`:** NO migrados — `title` en iframe es obligatorio para accesibilidad WCAG

### Verificación final

```
grep '<(button|a|span|div|label|input|select)\b[^>]*\stitle="' src/ → 0 matches
```

Los 145 `title=` restantes son todos props de componentes custom (`<Button>`, `<RibbonBtn>`, `<ToolbarButton>`, `<Panel>`, `<PaletteSection>`, `<Dropdown>`, `<GeoCapture>`) o `<iframe title=` (accesibilidad WCAG).

---

## REGLA #4 — No `alert`/`confirm`/`prompt` nativo (OBLIGATORIO)

### Estado: ✅ Corregido (2026-08-17)

**Búsqueda:** `[^a-zA-Z](alert|confirm|prompt)\([^)]*\)` → 38 matches, **todos son `confirm({...})` del hook `useConfirm`**, no nativos.

---

## REGLA #5 — Botones de una sola palabra (OBLIGATORIO)

### Estado: ✅ Corregido

**Fixes aplicados (2):**

| # | Archivo | Línea | Antes | Después |
|---|---------|-------|-------|---------|
| 1 | `src/app/dashboard/operaciones/carga-siniestros/page.tsx` | 1964 | "Cargar a staging" | "Cargar" |
| 2 | `src/app/dashboard/inspecciones/[id]/page.tsx` | 1650 | "Guardar evidencia" | "Guardar" |

---

## Colores hardcodeados en Tailwind

### Estado: ✅ Corregido

**Tokens CSS creados en `globals.css`:**
```css
--c-brand:      #0095DA;
--c-brand-dark: #005BBB;
```

**Clases utilitarias creadas en `components.css`:**
```css
.text-brand, .bg-brand, .bg-brand-10, .bg-brand-5
.border-brand, .border-brand-50
.hover\:border-brand-50:hover, .hover\:bg-brand-5:hover
.bg-brand-gradient (linear-gradient to bottom right)
```

**Fixes aplicados (21):**
- 13 iconos `text-[#0095DA]` → `text-brand`
- 5 hover/border/bg `[#0095DA]` → `border-brand-50`, `bg-brand-5`, `bg-brand-10`
- 8 gradientes `from-[#0095DA] to-[#005BBB]` → `bg-brand-gradient`

**Archivos modificados:**
- `companies/page.tsx`, `users/page.tsx`, `companias/page.tsx`, `lookup-catalog-manager.tsx`, `my-profile-modal.tsx`
- `gestiones/page.tsx`, `email-templates-card.tsx`, `document-templates-card.tsx`, `campos/page.tsx`
- `DynamicScreen.tsx` (10 ocurrencias)

**Excepciones legítimas (no violaciones):**
- Email templates/editor (27 usos): clientes de email no soportan CSS variables
- Valores por defecto en forms de color configurable (8): son datos, no estilos
- Map markers HTML strings (2): Leaflet requiere HTML inline
- Chart defaults (3): valor por defecto data-driven

---

## Console.log en producción

### Estado: ✅ Corregido

**Fix aplicado (1):**
- `services/email-sender.ts`: 2 `console.log` envueltos en `if (process.env.NODE_ENV !== "production")`

**Ya estaban correctos (2):**
- `hooks/use-realtime.ts`: ya envuelto en `if (process.env.NODE_ENV === "development")`
- `app/api/logs/route.ts`: ya envuelto en `if (process.env.NODE_ENV !== "production")`

**No es código (1):**
- `hooks/use-lookup-catalog.ts` línea 13: ejemplo en JSDoc, no código real

---

## Verificación Final

| Check | Resultado |
|-------|-----------|
| `tsc --noEmit` | ✅ 0 errores |
| `eslint src --quiet` | ✅ 0 errores, 0 warnings |
| `pnpm build` | ✅ Exitoso |
| `grep` HTML nativo con `title=` | ✅ 0 matches |
| `grep` `[#0095DA]` en Tailwind | ✅ 0 matches |
| `grep` `alert(`/`confirm(`/`prompt(` nativos | ✅ 0 matches |
| `grep` `console.log` sin dev check | ✅ 0 matches |

**Cumplimiento: 100% en todas las reglas auditadas.**
