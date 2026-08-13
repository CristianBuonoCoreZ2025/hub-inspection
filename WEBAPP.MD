# Estrategia Mobile para Inspecciones Presenciales

> Fecha: 2026-08-07 (reconstruido con enfoque en inspecciones presenciales).
> Estado: documento de alcance — implementación en local, sin tocar producción.

---

## 1. Contexto

El objetivo es permitir que un **inspector** haga login desde su celular o tablet
y ejecute **inspecciones presenciales en campo**. El inspector está en el lugar
del siniestro con su dispositivo. El desafío es distinto al del magic link:

- **Magic link (asegurado):** inspección remota, videollamada, chat, declaración por voz.
- **Mobile inspector:** inspección presencial, cámara del dispositivo, geolocalización
  del lugar, checklist en sitio, daños en el momento, croquis en tablet, firmas con touch.

**No es importante para el mobile:** videollamada, chat, conexiones WebRTC.
Esos son del lado del asegurado (magic link).

---

## 2. Flujo de Acceso y Derivación

### 2.1 Login (mismo que dashboard)

```
Usuario abre la app desde cualquier dispositivo
  → Pantalla de login (email + contraseña) — misma que dashboard
  → Supabase Auth valida credenciales
  → Obtiene profile (role, company_id, etc.)
  → Detecta dispositivo:
     ¿Es móvil o tablet? (useMediaQuery, breakpoint < 1024px)
       NO → Dashboard normal (desktop)
       SÍ → ¿Tiene rol inspector o internal/admin?
              NO → Dashboard responsive (lo que se ve en móvil)
              SÍ → Pantalla de elección:
                     ┌──────────────────────────────────┐
                     │  ¿Cómo quieres trabajar?          │
                     │                                  │
                     │  🖥️  Sistema tradicional          │
                     │      Dashboard adaptado a móvil   │
                     │                                  │
                     │  📱  Inspección mobile             │
                     │      Módulo de inspección         │
                     │      optimizado para campo        │
                     └──────────────────────────────────┘
```

### 2.2 Reglas de derivación

| Condición | Derivación |
|-----------|------------|
| Desktop (≥1024px) | Dashboard normal, sin pantalla de elección |
| Móvil/tablet + rol inspector | Pantalla de elección → Sistema tradicional o Inspección mobile |
| Móvil/tablet + rol internal/admin | Pantalla de elección → Sistema tradicional o Inspección mobile |
| Móvil/tablet + rol ajustador/otros | Dashboard responsive (sin opción Inspección mobile) |

### 2.3 Detección de dispositivo

- Hook `useMediaQuery` con `useSyncExternalStore` (React 19).
- Breakpoint `max-width: 1023px` para móvil + tablet.
- Detección en el cliente (no SSR) — devuelve false durante SSR.
- Recordar la elección en `localStorage` para no preguntar cada vez.
- Botón "Cambiar modo" (icono Monitor) siempre disponible en el header.

### 2.4 Rutas

```
/login                              # login existente (compartido)
/dashboard                          # dashboard desktop (existente)
/mobile                             # pantalla de elección
/mobile/inspecciones                # lista de inspecciones del inspector
/mobile/inspecciones/[id]           # detalle de inspección (tabs)
```

---

## 3. Módulo de Inspección Mobile — Enfoque Presencial

### 3.1 Filosofía

El inspector está **en el lugar del siniestro**. Lo que necesita:

1. **Ver sus inspecciones asignadas** del día
2. **Iniciar la inspección** desde el campo (con geolocalización)
3. **Tomar fotos** con la cámara del dispositivo
4. **Marcar checklist** en el momento
5. **Registrar daños** en sitio
6. **Dibujar croquis** en tablet
7. **Firmar** con touch (asegurado + inspector)
8. **Completar acta** y generar informe
9. **Finalizar** desde el campo

### 3.2 Tabs del módulo mobile (7 tabs — sin chat ni conexiones)

| Tab | Estado | Descripción |
|-----|--------|-------------|
| Resumen | ✅ | Datos del siniestro, estado, inspector asignado |
| Fotos | ✅ | Cámara del dispositivo + galería + lista de evidencias |
| Checklist | ✅ | Marcar items Sí/No/N/A en el momento |
| Daños | ✅ | Registrar daños en sitio con foto |
| Firmas | ✅ | Canvas touch para asegurado e inspector |
| Acta | ✅ | Acta de inspección con declaración |
| Informe | ✅ | PDF generado |

**No incluidas en mobile (no aplican a presencial):**
- ~~Chat~~ — es del magic link (asegurado remoto)
- ~~Conexiones WebRTC~~ — es del magic link (videollamada remota)
- ~~Videollamada~~ — es del magic link (inspección remota)

### 3.3 Funcionalidades del módulo actual que se reutilizan

| Funcionalidad | Estado | Cómo se reutiliza |
|---------------|--------|-------------------|
| Geolocalización (presencial) | ✅ | `GeoCapture` — automática al iniciar, navigator.geolocation |
| Validación de proximidad (500m) | ✅ | Haversine, geo_status: verified/out_of_range/failed |
| Mapa interactivo (Leaflet) | ✅ | Touch-friendly en móvil |
| Guardado de mapa como evidencia | ✅ | source='geo_map' |
| Pausa de inspección | ✅ | substate='paused', botón pausar |
| Reanudar inspección | ✅ | Solo inspector asignado |
| Work periods (chess clock) | ✅ | getWorkPeriods(sessionId) |
| Evidencias con EXIF GPS | ✅ | exif_lat, exif_lng (anti-fraude) |
| Resumen IA de fotos | ✅ | ai_summary, ai_model (OpenRouter) |
| Firmas touch | ✅ | Canvas con pointer events |
| Acta con declaración | ✅ | ActaForm con pasos |
| Informe PDF | ✅ | ReportTab |
| Solo inspector asignado inicia/reanuda | ✅ | effectiveInspectorId === profile.id |
| Reagendamiento con maxDate hábil | ✅ | getInspectionMaxDate (server action) |

### 3.4 APIs existentes (reutilizadas sin cambios)

| Endpoint | Método | Uso en mobile |
|----------|--------|---------------|
| `/api/inspection/evidences/upload` | POST | Subir foto a R2 |
| `/api/inspection/evidences/session/[id]` | GET | Listar evidencias |
| `/api/inspection/evidences/[id]` | DELETE | Eliminar evidencia |
| `/api/inspection/geo/save-map` | POST | Guardar mapa como evidencia |
| `/api/inspection/sign` | POST | Firmar inspección |
| `/api/inspection/sign/upload` | POST | Subir firma |
| `/api/inspection/sketch` | GET, POST | Croquis |
| `/api/inspection/sketch/upload` | POST | Subir croquis |
| `/api/inspection/report/upload` | POST | Subir reporte PDF |

### 3.5 Servicios existentes (reutilizados)

| Función | Uso en mobile |
|---------|---------------|
| `getInspectionSessionsLight()` | Lista de inspecciones |
| `getInspectionSessionById(id)` | Detalle de inspección |
| `startInspection(id)` | Iniciar inspección |
| `resumeInspection(id)` | Reanudar inspección pausada |
| `getWorkPeriods(id)` | Períodos de trabajo |
| `canAccessInspectionSession()` | Validar acceso por bloqueo |
| `moveInspectionDate()` | Mover fecha |
| `rescheduleInspectionViaCIN()` | Reagendar |
| `cancelInspectionViaCIN()` | Cancelar |

### 3.6 Server actions existentes (reutilizados)

| Función | Uso en mobile |
|---------|---------------|
| `getInspectionMaxDate(claimId)` | Calcular maxDate con días hábiles |

---

## 4. Arquitectura — Solución A (Web/PWA móvil)

### 4.1 Tecnología
- Next.js App Router (mismo proyecto, rutas `/mobile/*`).
- Tailwind responsive mobile-first.
- Supabase Auth (mismo login).
- TanStack Query con cache y reintentos.
- `useSyncExternalStore` para detección de dispositivo.
- Cámara vía `<input type="file" accept="image/*" capture="environment">`.
- Geolocalización vía `navigator.geolocation.getCurrentPosition()`.
- Leaflet para mapas (touch-friendly).

### 4.2 Cambios en base de datos (migración 341 — ya aplicada en local)

```sql
-- Aditivas, no destructivas. Defaults seguros.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mobile_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE inspection_sessions ADD COLUMN IF NOT EXISTS started_from_mobile BOOLEAN NOT NULL DEFAULT false;
```

### 4.3 Sin APIs nuevas

No se crean APIs nuevas. Se reutilizan todas las existentes (`/api/inspection/*`).
Los servicios y server actions existentes se usan directamente desde los componentes mobile.

### 4.4 Ventajas
- Reutiliza 100% del backend, servicios, server actions y APIs existentes.
- Geolocalización ya funciona en móvil (navigator.geolocation + Leaflet touch).
- Evidencias ya funcionan en móvil (upload a R2 + EXIF GPS).
- Firmas ya funcionan con touch (canvas pointer events).
- Deploy continuo en Vercel (mismo proyecto).
- No requiere stores ni cuentas de desarrollador.

### 4.5 Desventajas
- Offline limitado (se requiere conexión para iniciar/finalizar).
- Cámara limitada por navegador (no acceso nativo completo).
- No publicable en App Store/Play Store (PWA instalable solo).

---

## 5. Pantallas del módulo mobile

### Pantalla 0 — Login + derivación
- Logo.
- Email + contraseña (mismo login que desktop).
- Toggle "Recordarme".
- Post-login: si móvil + inspector/internal → pantalla de elección.

### Pantalla 1 — Lista de inspecciones
- Tabs: Hoy, Pendientes, Pausadas, Completadas.
- Cards con: liquidación, dirección, fecha, estado, tipo.
- Pull-to-refresh (botón actualizar).
- Solo inspecciones asignadas al inspector logueado.
- Badge de pausada si corresponde.
- Click → entra al detalle.

### Pantalla 2 — Detalle de inspección
- Header: liquidación + estado + dirección + asegurado.
- Botón "Iniciar inspección" (solo inspector asignado, no pausada).
- Botón "Reanudar" (solo inspector asignado, pausada).
- Indicador de períodos de trabajo (work periods).
- 7 tabs horizontales: Resumen, Fotos, Checklist, Daños, Firmas, Acta, Informe.

### Tab Resumen
- Datos del siniestro (liquidación, ref. cliente, dirección, tipo, fecha).
- Asegurado.
- Estado de la inspección (estado, substate, inspector asignado).
- Aviso si no es inspector asignado.

### Tab Fotos (Evidencias)
- Botón "Tomar foto" (`<input capture="environment">`).
- Botón "Subir desde galería".
- Grid de fotos con thumbnails.
- EXIF GPS visible por foto.
- Badge de source (upload, screenshot, geo_map).
- Resumen IA visible por foto.
- Botón borrar.

### Tab Checklist
- Lista de items a revisar.
- Toggle Sí / No / N/A (switches grandes 44px).
- Notas por item.
- Progreso "X de N completados".

### Tab Daños
- Lista de daños declarados.
- Botón "Agregar daño".
- Formulario: área, categoría, descripción, severidad, cantidad, unidad, foto.
- Edición touch-friendly (inputs 48px, selects nativos).

### Tab Firmas
- Pad para asegurado (canvas touch).
- Pad para inspector (canvas touch).
- Botón "No firmó" con motivo.
- Guardado como PNG.

### Tab Acta
- Acta de inspección con pasos.
- Datos del siniestro, seguridad, declaración, terceros.
- Inspector completa en campo.

### Tab Informe
- Vista del reporte renderizado.
- Botón "Generar PDF".
- Botón "Descargar".

---

## 6. Optimizaciones específicas mobile

- Botones de 48px height (no 36px como desktop).
- Inputs con `inputmode` apropiado (numeric, tel, email).
- `font-size: 16px` en inputs (evita zoom automático en iOS).
- `touch-action: manipulation` para evitar double-tap zoom.
- `-webkit-tap-highlight-color: transparent`.
- Scroll suave con `-webkit-overflow-scrolling: touch`.
- Touch target mínimo: 44px (iOS) / 48px (Android).
- Tabs con scroll horizontal si exceden el ancho.
- Cards con borde redondeado y sombra sutil.
- Badges de color por estado (scheduled, active, paused, completed, cancelled).
- Lazy loading: cada tab se carga on-demand.

---

## 7. Archivos creados (solo local, sin subir a producción)

### Migración
- `migrations/341_mobile_inspection_columns.sql` — columnas aditivas.

### Hook
- `src/hooks/use-media-query.ts` — detección de dispositivo con useSyncExternalStore.

### Layout
- `src/app/mobile/layout.tsx` — server component, valida sesión.
- `src/components/mobile/mobile-layout.tsx` — client component, header minimal.

### Páginas
- `src/app/mobile/page.tsx` — pantalla de elección.
- `src/app/mobile/inspecciones/page.tsx` — lista de inspecciones.
- `src/app/mobile/inspecciones/[id]/page.tsx` — detalle con tabs.

### Tabs (wrappers que reutilizan tabs del desktop)
- `src/app/mobile/inspecciones/[id]/tabs/evidences-tab.tsx`
- `src/app/mobile/inspecciones/[id]/tabs/checklist-tab.tsx`
- `src/app/mobile/inspecciones/[id]/tabs/damages-tab.tsx`
- `src/app/mobile/inspecciones/[id]/tabs/signatures-tab.tsx`
- `src/app/mobile/inspecciones/[id]/tabs/acta-tab.tsx`
- `src/app/mobile/inspecciones/[id]/tabs/report-tab.tsx`

### Estilos
- `src/app/styles/mobile.css` — clases CSS del módulo mobile.

---

## 8. Pendientes y mejoras futuras

### 8.1 GeoCapture mobile integrado
- Integrar `GeoCapture` en el tab Resumen o como paso previo al iniciar.
- Captura automática al iniciar inspección presencial.
- Mapa Leaflet touch-friendly.

### 8.2 Reagendar/mover/cancelar desde mobile
- Modal con CoordScheduler (vista de día en móvil).
- maxDate calculado con días hábiles (server action existente).
- Motivo de reagendamiento (fallida) o cancelación (desistida).

### 8.3 Croquis en tablet
- Canvas táctil con pointer events.
- En móvil pequeño: solo ver croquis existente.
- En tablet: edición completa.

### 8.4 PWA manifest
- Instalable desde el navegador.
- Icono en home screen.
- Splash screen.

### 8.5 Offline básico
- Cache de inspecciones asignadas en IndexedDB.
- Cola de uploads de fotos cuando no hay conexión.
- Sync cuando vuelve la conexión.

---

## 9. Reglas

- Cero destrucción de datos.
- Cero migraciones forzosas (solo aditivas con defaults seguros).
- No duplicar APIs existentes (`/api/inspection/*` se reutilizan).
- No duplicar servicios existentes (`src/services/inspections.ts` se reutiliza).
- No duplicar server actions existentes (`getInspectionMaxDate` se reutiliza).
- Solo inspector asignado puede iniciar, pausar, reanudar o finalizar.
- Validación de inspector asignado tanto en frontend como en backend.
- **Todo en local** — no subir a producción hasta que esté probado en campo.
- Si algo sale mal, se descarta y se reconstruye. No se toca lo activo.
