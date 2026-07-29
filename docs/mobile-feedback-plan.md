# Plan Mobile-First — Feedback Samsung S23 Ultra

> **Fecha:** 2026-07-28
> **Dispositivo test:** Samsung S23 Ultra (~360px width)
> **URL probada:** Vercel Preview (UAT branch)
> **Base:** Feedback del usuario tras revisión completa en celular

---

## Filosofía Mobile (definida por el usuario)

> "Desde el celular debería ser como una especie de aplicación celular.
> No es que el sistema se me ajuste. El sistema tiene que entregarme la
> información suficiente para poder verla. **Cambia el sistema cuando es
> por celular.** Cambia el sistema cuando es por tablet."

### Principios
1. **Mobile = ver información, no modificar configuración**
2. **Catálogos no se ven ni se configuran desde mobile** — requieren PC
3. **Navegación mobile reducida:** Dashboard, Pólizas, Siniestros, Inspecciones, Agenda, Informes. Nada más.
4. **Botones diferentes para mobile** — no los mismos botones que desktop
5. **Inspector puede responder inspección desde mobile** — pero no crear documentos
6. **Tablet = mismo sistema que desktop** (no necesita cambios)
7. **Grillas mobile = poca información, solo lo esencial** (liquidación, referencia, asegurado)

---

## Problemas encontrados (priorizados)

### P0 — Bugs críticos (rompen funcionalidad)

| ID | Problema | Causa | Archivo(s) |
|----|----------|-------|------------|
| **P0-1** | Pólizas: no se ve botón Guardar | Botón al final de formulario largo, fuera del viewport. `app-panel` tiene `overflow: hidden !important` que puede cortar. | `polizas/[id]/page.tsx:874`, `components.css:246` |
| **P0-2** | Coordinación inspección: editar no funciona | Bug en edición de coordinación — no funciona ni en PC ni en mobile | `claims/[id]/page.tsx` (modal coordinación) |
| **P0-3** | Agenda: rota en mobile, no se puede scroll | `.agenda-calendar` tiene `overflow: hidden` que bloquea scroll horizontal del hijo. Select de inspectores tiene ancho fijo 260px. | `dashboard.css:2069`, `agenda/page.tsx:333` |
| **P0-4** | Combo gestiones: muestra "línea" como texto | Hardcodeado `tags.push("Línea")` en vez de resolver nombre real del catálogo | `claims/[id]/page.tsx:1651` |

### P1 — UX mobile deficiente (funciona pero se ve mal)

| ID | Problema | Causa | Archivo(s) |
|----|----------|-------|------------|
| **P1-1** | Dashboard chart "Top compañías": dice "VALUE 2" | `BarChartGlass` no pasa `name` prop al `<Bar>` de Recharts | `bar-chart.tsx:85-89`, `dashboard/page.tsx:775` |
| **P1-2** | Dashboard chart: compañías apretadas | 5 compañías en bar chart horizontal, poco espacio en 360px | `bar-chart.tsx`, `dashboard/page.tsx` |
| **P1-3** | Grilla siniestros: 10 columnas, no se ven todos los datos | No hay ocultamiento de columnas en mobile. Scroll horizontal como única solución. | `claims/page.tsx:2291-2363` |
| **P1-4** | Informe: solo botón descargar en mobile | No hay vista visual del informe en mobile, solo descarga | `inspecciones/[id]/report-tab.tsx` |
| **P1-5** | Catálogos: grillas no ajustan bien (clasificación del bien) | Grids de catálogos no se adaptan al ancho mobile | `catalogos/inspeccion/*` |
| **P1-6** | Email templates: grilla no se ve bien | Grid de plantillas de email no ajusta en mobile | `email-templates/page.tsx` |

### P2 — Mejoras de producto mobile (nuevas features)

| ID | Feature | Descripción |
|----|---------|-------------|
| **P2-1** | **Navegación mobile reducida** | Solo mostrar: Dashboard, Pólizas, Siniestros, Inspecciones, Agenda, Informes. Ocultar catálogos, operaciones, admin. Requiere `hideOnMobile` en `NavLink` + filtrado en `useNavLinks`. |
| **P2-2** | **Workflow visual desde siniestro** | En `claims/[id]` → pestaña datos del siniestro → al lado del evento, mostrar gráfica Mermaid-like de todos los workflows configurados para ese evento/país/línea. Click → modal con imagen del flujo. |
| **P2-3** | **Agenda vista de día en mobile** | En mobile mostrar solo 1 día con swipe horizontal. En desktop mantener vista semanal. |
| **P2-4** | **Botones mobile diferenciados** | Definir botones más grandes, simplificados para mobile. No reutilizar los mismos botones desktop. |
| **P2-5** | **Grilla siniestros mobile simplificada** | Mostrar solo: N° Liquidación, Ref Cliente, Asegurado. Ocultar las otras 7 columnas en mobile. |
| **P2-6** | **Botón Guardar sticky en mobile** | Para formularios largos (pólizas, etc.), botón flotante o sticky footer que siempre sea visible. |
| **P2-7** | **Informe mobile: vista visual** | En mobile mostrar el informe renderizado (no solo descarga). Quizás simplificado. |

### P3 — Lo que funciona bien (NO tocar)

- Siniestros: entrar, editar, guardar, ubicación/mapa ✓
- Gestiones: auto-asignación, listar, crear nueva ✓
- Inspección: menú, croquis, funciones ✓
- Informes: lengüetas por compañía, detalle ✓
- Workflow: vista, íconos, campos de plantillas ✓
- Catálogo destino del bien ✓
- Catálogo antigüedad inmueble ✓

---

## Plan de ejecución

### Fase 15 — Bugs críticos (P0) — ~2 horas

#### 15.1 — P0-1: Pólizas botón Guardar visible en mobile
- Agregar botón Guardar sticky al header de la página (visible siempre)
- O: agregar `sticky bottom-0` footer con botón Guardar solo en mobile (`sm:hidden`)
- Reducir `gap-4` → `gap-2` en mobile para compactar formulario
- Archivos: `polizas/[id]/page.tsx`, `components.css`

#### 15.2 — P0-2: Coordinación inspección editar
- Investigar el bug del modal de coordinación (no funciona ni PC ni mobile)
- El email dentro de coordinación tiene un espacio extraño arriba
- Archivos: `claims/[id]/page.tsx` (modal coordinación)

#### 15.3 — P0-3: Agenda scroll mobile
- Quitar `overflow: hidden` de `.agenda-calendar` → `overflow: visible` o `overflow-x: auto`
- Hacer el select de inspectores responsive (`width: 100%` en mobile, `260px` en desktop)
- Archivos: `dashboard.css:2069`, `dashboard.css:2034-2038`

#### 15.4 — P0-4: Combo gestiones "línea" → nombre real
- Reemplazar `tags.push("Línea")` con resolución del nombre real:
  ```tsx
  const lineName = businessLinesCatalog?.find(b => b.id === tpl.line_business_id)?.name;
  tags.push(lineName || "Línea");
  ```
- Hacer lo mismo para Evento y Cía
- Archivos: `claims/[id]/page.tsx:1648-1654`

### Fase 16 — UX mobile (P1) — ~3 horas

#### 16.1 — P1-1: Chart "VALUE 2" → "Siniestros"
- Agregar prop `label` a `BarChartGlass` y pasar `name={label}` al `<Bar>`
- Usar `label="Siniestros"` en el dashboard
- Archivos: `bar-chart.tsx`, `dashboard/page.tsx:775`

#### 16.2 — P1-2: Chart compañías apretadas
- En mobile (<640px): mostrar top 3 en vez de top 5
- O: hacer el chart scrollable verticalmente
- Archivos: `dashboard/page.tsx:235-244`

#### 16.3 — P1-3: Grilla siniestros columnas mobile
- En mobile: ocultar columnas con `hidden sm:table-cell`:
  - Visible siempre: N° Liquidación, Asegurado, Estado
  - Visible sm+: N° Ref Cliente, N° Siniestro Cía
  - Visible lg+: Dirección, Siniestro, Denuncio, Creación, Tipo/País
- Archivos: `claims/page.tsx:2291-2363`

#### 16.4 — P1-4: Informe mobile vista visual
- En mobile: mostrar informe renderizado en HTML (no solo botón descargar)
- Botón descargar abajo o en header
- Archivos: `inspecciones/[id]/report-tab.tsx`

### Fase 17 — Navegación mobile (P2-1) — ~2 horas

#### 17.1 — NavLink con hideOnMobile
- Agregar `hideOnMobile?: boolean` a la interfaz `NavLink`
- Marcar todos los catálogos, operaciones y admin como `hideOnMobile: true`
- Modificar `useNavLinks` para filtrar items con `hideOnMobile` en mobile
- Archivos: `nav-data.ts`, `use-nav-links.ts`, `mobile-nav.tsx`

#### 17.2 — Mobile nav simplificada
- En mobile mostrar solo: Dashboard, Pólizas, Siniestros, Inspecciones, Agenda, Informes
- Sin acordeones de catálogos
- UI más app-like (íconos grandes, lista simple)
- Archivos: `mobile-nav.tsx`

### Fase 18 — Workflow visual (P2-2) — ~4 horas

#### 18.1 — Workflow graph desde siniestro
- En `claims/[id]` → pestaña datos del siniestro → al lado del evento
- Query: buscar workflows configurados para (país, línea, evento)
- Renderizar gráfica Mermaid-like (o SVG) del flujo configurado
- Click → modal con imagen grande del flujo
- Archivos: `claims/[id]/page.tsx`, nuevo componente `workflow-graph.tsx`

### Fase 19 — Agenda mobile (P2-3) — ~3 horas

#### 19.1 — Vista de día en mobile
- Detectar mobile (<640px) → mostrar solo 1 día
- Swipe horizontal (o botones prev/next) para cambiar de día
- En desktop mantener vista semanal
- Archivos: `agenda/page.tsx`, `dashboard.css`

### Fase 20 — Pulido mobile (P2-4, P2-5, P2-6) — ~2 horas

#### 20.1 — Botones mobile diferenciados
- Definir clase `.btn-mobile` con tamaño 48px height, full width
- Usar en formularios y modales en mobile

#### 20.2 — Botón Guardar sticky en mobile
- Para formularios largos: sticky footer con botón Guardar
- Clase `.form-sticky-save` solo visible en mobile

#### 20.3 — Grilla siniestros simplificada
- Implementar ocultamiento de columnas (ver Fase 16.3)

---

## Orden de ejecución sugerido

```
Fase 15 (P0 bugs) → Fase 16 (P1 UX) → Fase 17 (nav mobile) → Fase 19 (agenda)
                                                                    ↓
                                                            Fase 18 (workflow graph)
                                                                    ↓
                                                            Fase 20 (pulido)
```

**Fase 15 es prioritaria** — son bugs que rompen funcionalidad.
**Fase 17 es la más impactante** — cambia toda la experiencia mobile.
**Fase 18 es la más compleja** — requiere nuevo componente de visualización.

---

## Notas del usuario

- "No me voy a poner a configurar sistemas en el celular"
- "Si yo soy el inspector, pudiera responder la inspección desde el celular"
- "No puedo hacer un documento desde el celular"
- "La grilla tendría que ser como muy poca información para la grilla cuando es liquidación"
- "Tendría que ser una visión celular, pensado para una visión celular"
- "Los botones debieran cambiar todo. Debiéramos definir un botón para celular"
