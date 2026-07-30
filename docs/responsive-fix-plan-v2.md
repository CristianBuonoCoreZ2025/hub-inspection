# Plan de Ejecución — Fases 11-13 (Re-auditoría)

> **Base:** `docs/responsive-reaudit.md` (38 ocurrencias pendientes)
> **Fecha creación:** 2026-07-28
> **Objetivo:** Cerrar los 38 pendientes propios en 3 fases mecánicas.
> **Regla:** tsc + eslint = 0 errores/warnings al final de cada fase.

---

## Fase 11 — P1 + P3 (mecánico, bajo riesgo)

> **Esfuerzo:** ~15 minutos · **Archivos:** ~12 · **Riesgo:** Bajo

### 11.1 — P1: `modal-body space-y-2` → `modal-body modal-grid` (7 ocurrencias)

Cambio mecánico idéntico a Fase 4 pero en archivos fuera de `catalogos/`.

- [ ] `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx:5373`
- [ ] `src/app/dashboard/inspecciones/[id]/page.tsx:1066`
- [ ] `src/app/dashboard/inspecciones/[id]/page.tsx:1124`
- [ ] `src/components/catalogos/lookup-catalog-manager.tsx:193`
- [ ] `src/app/dashboard/claims/[id]/claim-documents-tab.tsx:999`
- [ ] `src/app/dashboard/inspecciones/[id]/evidences-tab.tsx:514`
- [ ] `src/app/dashboard/claims/[id]/claim-images-tab.tsx:629`

**Comando PowerShell para hacerlo de una vez:**
```powershell
$files = @(
  "src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx",
  "src/app/dashboard/inspecciones/[id]/page.tsx",
  "src/components/catalogos/lookup-catalog-manager.tsx",
  "src/app/dashboard/claims/[id]/claim-documents-tab.tsx",
  "src/app/dashboard/inspecciones/[id]/evidences-tab.tsx",
  "src/app/dashboard/claims/[id]/claim-images-tab.tsx"
)
foreach ($f in $files) {
  $c = Get-Content $f -Raw
  $c = $c -replace 'modal-body space-y-2', 'modal-body modal-grid'
  Set-Content $f -Value $c -NoNewline
}
```

### 11.2 — P3: Agregar `min-h-0` a `flex-1 overflow-y-auto` (10 ocurrencias)

- [ ] `src/components/layout/help-panel.tsx:667` — `flex-1 overflow-y-auto p-4` → `flex-1 overflow-y-auto min-h-0 p-4`
- [ ] `src/app/dashboard/catalogos/gestiones/caracteristicas/screen-builder.tsx:276` — `flex-1 overflow-y-auto p-5 space-y-3`
- [ ] `src/app/dashboard/catalogos/gestiones/caracteristicas/screen-builder.tsx:306` — `flex-1 overflow-y-auto p-3`
- [ ] `src/components/claims/claim-location-selector.tsx:233` — `flex-1 overflow-y-auto p-4 space-y-2`
- [ ] `src/components/claims/email-preview-modal.tsx:244` — `flex-1 overflow-y-auto p-4`
- [ ] `src/components/claims/email-contact-book.tsx:114` — `flex-1 overflow-y-auto`
- [ ] `src/app/dashboard/catalogos/pantallas/[screenId]/page.tsx:412` — `flex-1 overflow-y-auto p-3 space-y-3`
- [ ] `src/app/dashboard/catalogos/pantallas/[screenId]/page.tsx:497` — `flex-1 overflow-y-auto p-6`
- [ ] `src/app/dashboard/catalogos/pantallas/[screenId]/page.tsx:539` — `flex-1 overflow-y-auto p-3`
- [ ] `src/app/dashboard/catalogos/pantallas/[screenId]/page.tsx:688` — `flex-1 overflow-y-auto bg-zinc-50/50...`

**Patrón de reemplazo:** `flex-1 overflow-y-auto` → `flex-1 overflow-y-auto min-h-0`

**Nota:** NO tocar `nav-wrapper.tsx:15` (es el `<main>` root, su padre no es flex).

### Checkpoint Fase 11
- [ ] `npx tsc --noEmit` = 0 errores
- [ ] `npx eslint` = 0 errores/warnings
- [ ] Commit: `fix: remaining modal-grid + flex-1 min-h-0 (P1+P3)`

---

## Fase 12 — P2: Inline styles prohibidos restantes (18+3 ocurrencias)

> **Esfuerzo:** ~30-45 minutos · **Archivos:** ~10 · **Riesgo:** Medio

### 12.1 — Crear clases CSS nuevas en `components.css`

Agregar al final de `@layer components` en `src/app/styles/components.css`:

```css
/* ── Scroll containers para contenido acotado ── */
.scroll-box-sm {
  max-height: 240px !important;
  overflow-y: auto !important;
}
.ai-summary-scroll {
  max-height: 60vh !important;
  overflow-y: auto !important;
}

/* ── Gradientes estáticos de dashboard ── */
.progress-bar-amber {
  background: linear-gradient(90deg, #f59e0b, #d97706) !important;
}
.activity-icon-gradient {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--primary) 15%, transparent),
    color-mix(in srgb, var(--primary) 5%, transparent)
  ) !important;
}

/* ── Glass variants para backdrop filter ── */
.glass-heavy {
  backdrop-filter: blur(20px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(160%) !important;
}
.glass-medium {
  backdrop-filter: blur(12px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(12px) saturate(140%) !important;
}

/* ── Input mini para alertas ── */
.alert-input-mini {
  border-radius: 6px !important;
  height: 28px !important;
  width: 56px !important;
  padding: 0 !important;
  font-size: 12px !important;
}

/* ── Email preview dimensions ── */
.email-preview-container {
  max-width: 600px !important;
}
.email-preview-iframe {
  min-height: 70vh !important;
  height: 100% !important;
}

/* ── Field fixed width ── */
.field-fixed-100 {
  flex: 0 0 100px !important;
}

/* ── Table column coverage ── */
.col-coverage {
  width: 45% !important;
}
```

### 12.2 — Reemplazos por archivo

#### P2a — Mapas Leaflet `h-full w-full` (3 archivos, 4 ocurrencias)
- [ ] `claims/[id]/page.tsx:1934` — `style={{ height: "100%", width: "100%" }}` → agregar `h-full w-full` al className, quitar style
- [ ] `inspecciones/[id]/page.tsx:1040` — mismo
- [ ] `claim-location-selector.tsx:325` — mismo

#### P2b — Scroll containers (3 archivos, 5 ocurrencias)
- [ ] `dashboard/page.tsx:797` — `style={{ maxHeight: 240, overflow: "auto" }}` → clase `scroll-box-sm`
- [ ] `dashboard/page.tsx:888` — mismo
- [ ] `claim-documents-tab.tsx:1001` — `style={{ maxHeight: "60vh", overflowY: "auto" }}` → clase `ai-summary-scroll`
- [ ] `evidences-tab.tsx:517` — mismo
- [ ] `claim-images-tab.tsx:631` — mismo

#### P2c — Gradientes dashboard (1 archivo, 3 ocurrencias)
- [ ] `dashboard/page.tsx:605` — separar width (legítimo, dejar) de background (→ `progress-bar-amber`)
- [ ] `dashboard/page.tsx:810` — `style={{ background: "linear-gradient(...)" }}` → clase `activity-icon-gradient`
- [ ] `dashboard/page.tsx:901` — mismo

#### P2d — Backdrop filter (1 archivo, 2 ocurrencias)
- [ ] `evidences-tab.tsx:338` — `style={{ backdropFilter: "blur(20px)...", WebkitBackdropFilter: "..." }}` → clase `glass-heavy`
- [ ] `evidences-tab.tsx:614` — `style={{ backdropFilter: "blur(12px)...", WebkitBackdropFilter: "..." }}` → clase `glass-medium`

#### P2e — Input mini (1 archivo, 2 ocurrencias)
- [ ] `gestiones/gestiones/page.tsx:525` — `style={{ borderRadius: "6px", height: "28px", width: "56px", padding: 0, fontSize: "12px" }}` → clase `alert-input-mini`
- [ ] `gestiones/gestiones/page.tsx:545` — mismo

#### P2f — Email preview (1 archivo, 2 ocurrencias)
- [ ] `EmailTemplateEditor.tsx:789` — `style={{ maxWidth: 600 }}` → clase `email-preview-container`
- [ ] `EmailTemplateEditor.tsx:794` — `style={{ minHeight: "70vh", height: "100%" }}` → clase `email-preview-iframe`

#### P2g — Otros (2 archivos, 2 ocurrencias)
- [ ] `lineas-negocio/page.tsx:208` — `style={{ flex: "0 0 100px" }}` → clase `field-fixed-100`
- [ ] `polizas/[id]/page.tsx:1157` — `style={{ width: "45%" }}` → clase `col-coverage`

#### P2h — MIXED: chat-tab (1 archivo, 2 ocurrencias)
- [ ] `chat-tab.tsx:58` — `style={{ minHeight: compact ? "100%" : "400px" }}` → dejar como excepción (condicional dinámico) O crear clase con CSS var
- [ ] `chat-tab.tsx:67` — `style={{ maxHeight: compact ? "calc(100vh - 220px)" : "400px" }}` — mismo

**Decisión:** P2h se deja como excepción justificada (el valor depende de `compact` que es runtime). Documentar en comentario.

### Checkpoint Fase 12
- [ ] `npx tsc --noEmit` = 0 errores
- [ ] `npx eslint` = 0 errores/warnings
- [ ] `grep -r "style={{" src/ | grep -v perf-panel | grep -v html-editor | grep -v dropdown-menu` — verificar que solo queden legítimos
- [ ] Commit: `fix: replace remaining inline styles with CSS classes (P2)`

---

## Fase 13 — P5: Limpieza de scripts temporales

> **Esfuerzo:** ~5 minutos · **Riesgo:** Bajo (verificar antes de borrar)

### 13.1 — Verificar scripts temporales
- [ ] Revisar `scripts/check-audit-fn.mjs` — ¿es de un solo uso?
- [ ] Revisar `scripts/check-claim-triggers.mjs` — ¿es de un solo uso?
- [ ] Revisar `scripts/check-policy-item.mjs` — ¿es de un solo uso?
- [ ] Revisar `scripts/check-staging.mjs` — ¿es de un solo uso?
- [ ] Revisar `scripts/repro-andrea.mjs` — ¿es de un solo uso?
- [ ] Revisar `scripts/check-idx.mjs` — ¿es de un solo uso?
- [ ] Revisar `scripts/reset-claims.mjs` — ¿es de un solo uso?
- [ ] Revisar `scripts/check-statuses.mjs` — ¿es de un solo uso?

### 13.2 — Borrar los que sean de un solo uso
```powershell
# Solo después de verificar cada uno
Remove-Item scripts/check-audit-fn.mjs
# etc.
```

### Checkpoint Fase 13
- [ ] `npx tsc --noEmit` = 0 errores
- [ ] `npx eslint` = 0 errores/warnings
- [ ] Commit: `chore: remove temporary scripts (P5)`

---

## Pendientes externos (NO ejecutar)

Estos son responsabilidad de otros procesos o requieren decisión del usuario:

- **P4:** `carga-siniestros/page.tsx` tiene error tsc (`countryId` línea 733) + 2 warnings eslint. Cambios externos no míos.
- **P6:** 5 migraciones SQL sin commitear (`100`, `101`, `264`, `265`, `266`, `267`). Revisar con el usuario antes de commitear.

---

## Orden de ejecución

```
Fase 11 (P1+P3) → Fase 12 (P2) → Fase 13 (P5)
```

Fase 11 es prioritaria (mecánica, arregla 17 ocurrencias en 15 min).
Fase 12 requiere más cuidado (crear clases CSS, tocar gradientes).
Fase 13 es limpieza opcional.

## Verificación final

Después de las 3 fases:
- [ ] `npx tsc --noEmit` = 0 errores
- [ ] `npx eslint` = 0 errores/warnings
- [ ] `grep -r "modal-body space-y-2" src/` = 0 ocurrencias
- [ ] `grep -r "flex-1 overflow-y-auto" src/ | grep -v min-h-0` = 0 ocurrencias (excepto nav-wrapper)
- [ ] Probar en mobile 375px: dashboard, claims/[id], inspecciones/[id], un catálogo
- [ ] Actualizar `docs/responsive-reaudit.md` marcando P1, P2, P3 como resueltos
