# Plan de Inspecciones — Hub Inspection

> Estado al **2026-07-23**. Documento vivo: se actualiza con cada commit.
>
> **Convención de estados:**
> - ✅ **Completado** — funcional y en producción
> - 🟡 **Parcial** — implementado pero con limitaciones conocidas
> - ⏳ **Pendiente** — no implementado aún
> - 🔴 **Bloqueado** — requiere decisión o infraestructura externa

---

## 1. Arquitectura General

### 1.1 Modelo de datos (PostgreSQL / Supabase)

| Tabla | Estado | Migración | Descripción |
|-------|--------|-----------|-------------|
| `inspection_sessions` | ✅ | 008, 056, 057, 154, 201 | Sesión de inspección (1 por gestión INS) |
| `inspection_evidences` | ✅ | 008, 165, 173, 202 | Evidencias (foto, video, pdf, mapa, screenshot) |
| `inspection_checklists` | ✅ | 008 | Checklist de áreas/ítems |
| `inspection_damages` | ✅ | 008 | Daños declarados |
| `inspection_signatures` | ✅ | 008 | Firmas del asegurado y ajustador |
| `inspection_chat_messages` | ✅ | 056 | Chat inspector ↔ cliente |
| `damage_sketches` | ✅ | 056 | Croquis dibujados a mano |
| `inspection_reports` | ✅ | 168 | Reporte PDF generado |
| `claims.claim_latitude` / `claim_longitude` | ✅ | 021, 201 | Coords geocodificadas del siniestro |
| `inspection_sessions.geo_*` | ✅ | 201 | Geolocalización capturada en la inspección |
| `inspection_evidences.source` | ✅ | 202 | Origen: upload / screenshot_inspector / screenshot_client / live_video / geo_map |

### 1.2 Reglas de negocio

- ✅ Las inspecciones **solo se crean desde el workflow de gestiones** del siniestro (gestión COI emitida → trigger crea INS → genera `inspection_session`). No hay botón "Crear inspección" en el módulo.
- ✅ El módulo de Inspecciones es **solo lectura/resolución**, nunca creación.
- ✅ Cada sesión tiene un `magic_link_token` único para acceso público del cliente.

---

## 2. Tipos de Inspección

### 2.1 Presencial (`onsite`)

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Captura de geolocalización del inspector | ✅ | `GeoCapture` con validación contra dirección del siniestro (500m) |
| Bloqueo de "Iniciar inspección" sin geo | ✅ | Botón deshabilitado si `geo_status` es `pending` o `failed` |
| Banner de aviso antes de iniciar | ✅ | "Primero debes capturar tu geolocalización" |
| `out_of_range` no bloquea | ✅ | Warning no bloqueante (queda registrado para auditoría) |
| Mapa interactivo (Leaflet) | ✅ | OpenStreetMap, marcadores azul (capturada) + rojo (declarada) |
| Guardado automático del mapa como evidencia | ✅ | API `/api/inspection/geo/save-map` → R2 con `source='geo_map'` |
| Botón "Tomar foto del lugar" | ✅ | `<input capture="environment">` → upload a R2 |
| Miniaturas de mapa + foto | ✅ | En el panel de GeoCapture |
| Videollamada | ⏳ | No aplica (presencial) |

### 2.2 Remota (`remote`)

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Captura de geolocalización del cliente | ✅ | `GeoCapture` en magic link, validación contra dirección del siniestro |
| Mapa interactivo (Leaflet) | ✅ | Igual que presencial |
| Guardado automático del mapa como evidencia | ✅ | Igual que presencial |
| Botón "Tomar foto del lugar" | ✅ | Igual que presencial |
| **Videollamada WebRTC p2p** | ✅ | `LiveVideoCall` con signaling via Supabase Realtime |
| **Captura de fotos desde video en vivo** | ✅ | `canvas.drawImage(video)` → R2 con `source='screenshot_*'` |
| Ambos pueden capturar fotos | ✅ | Inspector y cliente tienen botón 📷 |
| Grabación de video de la sesión | ⏳ | Fase 8 pendiente (MediaRecorder) |
| Chat en vivo | ✅ | `ChatTab` + `ChatPanel` con Supabase Realtime |

---

## 3. Geolocalización (Fase completada)

### 3.1 Geocodificación de direcciones de siniestros

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Auto-geocodificación al crear claim (`createClaim`) | ✅ | Background, no bloquea |
| Auto-geocodificación al editar claim (`updateClaim`) | ✅ | Re-geocodifica si la dirección cambia |
| Auto-geocodificación al crear claim mínimo (`createClaimMinimal`) | ✅ | Background |
| Script batch para claims existentes | ✅ | `scripts/geocode-claims.cjs` |
| Proveedor de geocoding | 🟡 | Nominatim (OpenStreetMap) — gratis pero limitado. 50/127 claims geocodificados. Mejoraría con Google/Mapbox. |

### 3.2 Captura de geolocalización en inspección

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Helper `src/lib/geo.ts` | ✅ | `haversine`, `validateGeoProximity`, `geocodeAddress`, `reverseGeocode`, `generateStaticMapUrl` |
| Componente `GeoCapture` | ✅ | `src/components/inspection/geo-capture.tsx` |
| Validación de proximidad (500m) | ✅ | `geo_status`: `pending`, `verified`, `out_of_range`, `failed` |
| API para guardar mapa como evidencia | ✅ | `/api/inspection/geo/save-map` |
| Integración en inspector (presencial) | ✅ | Tab Resumen |
| Integración en cliente (remota) | ✅ | Magic link |
| Persistencia en `inspection_sessions.geo_*` | ✅ | lat, lng, captured_at, captured_by, distance_meters, status, map_url |

---

## 4. Videollamada y Captura en Vivo (Fase completada)

### 4.1 WebRTC peer-to-peer

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Signaling via Supabase Realtime | ✅ | Canal `webrtc:{sessionId}`, mensajes offer/answer/ice/hangup/ready |
| Helper de signaling | ✅ | `src/lib/webrtc/signaling.ts` |
| Componente `LiveVideoCall` | ✅ | `src/components/inspection/live-video-call.tsx` |
| Video bidireccional | ✅ | Local PiP + remoto grande |
| Audio bidireccional | ✅ | Echo cancellation + noise suppression |
| Perfect negotiation pattern | ✅ | Inspector impolite, cliente polite |
| STUN público de Google | ✅ | Sin servidor SFU, sin costo |
| ICE restart automático | ✅ | Si `iceConnectionState === 'failed'` |
| Controles: mic, cámara, fullscreen, colgar | ✅ | |
| Estados visuales (conectando, conectado, etc.) | ✅ | |
| Indicador "Esperando al otro participante" | ✅ | |
| Reemplazo de Jitsi anterior | ✅ | Jitsi era iframe externo, sin acceso al stream |

### 4.2 Captura de fotos desde video en vivo (anti-fraude)

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Botón 📷 captura frame del video remoto | ✅ | `canvas.drawImage(video)` → blob JPEG |
| Upload a R2 como evidencia | ✅ | Reutiliza `/api/inspection/evidences/upload` con `source` |
| Inspector captura (`screenshot_inspector`) | ✅ | |
| Cliente captura (`screenshot_client`) | ✅ | |
| Aviso al otro par via signaling | ✅ | Mensaje `screenshot` broadcast |
| Contador de fotos en header | ✅ | |
| Notificación visual "Foto capturada: L-...-EVI-0001" | ✅ | |
| Invalidación de queries al capturar | ✅ | Aparece en lista de evidencias |

### 4.3 Grabación de video (pendiente)

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Grabación con `MediaRecorder` | ⏳ | Fase 8 — pendiente |
| Upload del video completo a R2 | ⏳ | `source='live_video'` |
| Indicador "Grabando" | ⏳ | |

---

## 5. Evidencias

### 5.1 Upload y almacenamiento

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| API de upload a Cloudflare R2 | ✅ | `/api/inspection/evidences/upload` |
| Path estructurado en R2 | ✅ | `claims/{L}/actions/{code}/images/{code}-EVI-NNNN.ext` |
| Numeración correlativa atómica | ✅ | `EVI-0001`, `EVI-0002`, ... |
| Soporte foto, video, PDF, documento | ✅ | |
| Extracción de GPS de EXIF | ✅ | `exif_lat`, `exif_lng` (anti-fraude) |
| Geo del navegador | ✅ | `lat`, `lng` columnas dedicadas |
| Resumen automático con IA | ✅ | `ai_summary`, `ai_model` (OpenRouter) |
| Resumen de PDF | ✅ | Primeras 10 páginas |
| Campo `source` (origen) | ✅ | Migration 202 |
| Listado de evidencias por sesión | ✅ | `/api/inspection/evidences/session/[sessionId]` |
| Eliminación de evidencias | ✅ | `/api/inspection/evidences/[evidenceId]` |

### 5.2 Tipos de evidencia por origen

| `source` | Estado | Descripción |
|----------|--------|-------------|
| `upload` | ✅ | Subida manual (foto, video, PDF) |
| `screenshot_inspector` | ✅ | Capturada en vivo por inspector desde video |
| `screenshot_client` | ✅ | Capturada en vivo por cliente desde video |
| `live_video` | ⏳ | Grabación de video de la sesión (Fase 8) |
| `geo_map` | ✅ | Mapa de geolocalización generado automáticamente |

---

## 6. Tabs de la Inspección

| Tab | Estado | Archivo | Descripción |
|-----|--------|---------|-------------|
| Resumen | ✅ | `page.tsx` | Datos del siniestro, estado, geo, videollamada |
| Evidencias | ✅ | `evidences-tab.tsx` | Drag & drop + lista con IA |
| Checklist | ✅ | `checklist-tab.tsx` | Áreas e ítems a revisar |
| Daños | ✅ | `damages-tab.tsx` | Daños declarados con severidad |
| Croquis | ✅ | `sketches-tab.tsx` | Dibujo a mano sobre canvas |
| Firmas | ✅ | `signatures-tab.tsx` | Asegurado + ajustador |
| Reporte | ✅ | `report-tab.tsx` | PDF generado |
| Chat | ✅ | `chat-tab.tsx` | Chat en vivo inspector ↔ cliente |
| Acta | ✅ | `acta-form.tsx` | Acta de inspección |

---

## 7. APIs de Inspección

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/api/inspection/live/[token]` | GET, PATCH | ✅ | Datos públicos del magic link + update geo |
| `/api/inspection/evidences/upload` | POST | ✅ | Subir evidencia a R2 (con `source`) |
| `/api/inspection/evidences/session/[sessionId]` | GET | ✅ | Listar evidencias de una sesión |
| `/api/inspection/evidences/[evidenceId]` | DELETE | ✅ | Eliminar evidencia |
| `/api/inspection/geo/save-map` | POST | ✅ | Descargar mapa estático y guardarlo como evidencia |
| `/api/inspection/chat` | GET, POST | ✅ | Chat en vivo |
| `/api/inspection/sign` | POST | ✅ | Firmar inspección |
| `/api/inspection/sign/upload` | POST | ✅ | Subir firma |
| `/api/inspection/sketch` | GET, POST | ✅ | Croquis |
| `/api/inspection/sketch/[sketchId]` | DELETE | ✅ | Eliminar croquis |
| `/api/inspection/sketch/upload` | POST | ✅ | Subir croquis |
| `/api/inspection/report/upload` | POST | ✅ | Subir reporte PDF |
| `/api/inspection/upload` | POST | ✅ | Upload genérico |

---

## 8. Navegación

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| Redirect desde inspección → siniestro | ✅ | Al cancelar/reprogramar, `router.push(/dashboard/claims/{claim_id})` |
| N° de liquidación clickable → siniestro | ✅ | En 9 ubicaciones (inspecciones, informes, gestiones, claims, operaciones) |
| N° de liquidación en magic link | 🟡 | No es clickable (cliente no tiene acceso al dashboard) |
| Botón "Videollamada" en inspector | ✅ | Solo si `status=active` y `inspection_type=remote` |
| Botón "Videollamada" en magic link | ✅ | Solo si `!isCompleted` |

---

## 9. Pendientes y Mejoras Futuras

### 9.1 Pendiente (Fase 8)

- ⏳ **Grabación de video de la sesión** con `MediaRecorder`
  - Grabar video + audio de la sesión completa
  - Upload a R2 con `source='live_video'`
  - Indicador "Grabando" visible para ambos
  - Detener grabación al colgar
  - **Prioridad:** Media (la captura de fotos ya cumple el objetivo anti-fraude)

### 9.2 Mejoras opcionales

- 🔴 **Migrar geocoding a Google Maps / Mapbox**
  - Nominatim (gratis) no resuelve direcciones chilenas muy específicas
  - 50/127 claims geocodificados actualmente
  - Requiere API key con costo

- ⏳ **Servidor TURN para WebRTC**
  - STUN de Google funciona para la mayoría de conexiones
  - Para NAT simétrico (redes corporativas restrictivas) se necesita TURN
  - Opciones: coturn self-hosted, Twilio NAT Traversal Service, Cloudflare TURN

- ⏳ **Compartir pantalla del cliente** (screen sharing)
  - El cliente puede mostrar documentos/photos de su dispositivo
  - `navigator.mediaDevices.getDisplayMedia()`
  - Útil para que el cliente muestre documentos sin enviarlos

- ⏳ **Marcar fotos capturadas en vivo como "verificadas"**
  - Badge visual en la lista de evidencias
  - Filtro "Solo capturadas en vivo" en evidences-tab
  - Distinción clara para auditoría anti-fraude

- ⏳ **Notificación push al inspector cuando el cliente se conecta**
  - Actualmente hay que entrar al modal y esperar
  - Toast o badge en el botón "Videollamada" cuando el cliente está online

- ⏳ **Grabación automática de la sesión de chat**
  - Persistir el chat completo en el reporte PDF

---

## 10. Archivos Clave

### Componentes
- `src/components/inspection/geo-capture.tsx` — captura de geolocalización + mapa + foto
- `src/components/inspection/live-video-call.tsx` — videollamada WebRTC p2p + captura de fotos
- `src/components/ui/drawing-canvas.tsx` — canvas para croquis

### Librerías
- `src/lib/geo.ts` — helpers de geolocalización (haversine, geocode, static map)
- `src/lib/webrtc/signaling.ts` — signaling WebRTC via Supabase Realtime
- `src/lib/storage/inspection-upload.ts` — upload a R2 con path estructurado
- `src/lib/storage/exif.ts` — extracción de GPS de EXIF

### Servicios
- `src/services/inspections.ts` — acceso a datos de inspecciones
- `src/services/claims.ts` — geocodificación automática al crear/editar claims

### Páginas
- `src/app/dashboard/inspecciones/page.tsx` — lista de inspecciones
- `src/app/dashboard/inspecciones/[id]/page.tsx` — detalle del inspector
- `src/app/inspection/[token]/page.tsx` — magic link público del cliente

### Migraciones relevantes
- `migrations/201_inspection_geolocation.sql` — campos geo en inspection_sessions
- `migrations/202_evidence_source.sql` — campo source en inspection_evidences
- `migrations/165_evidence_geo_columns.sql` — lat/lng/exif en evidences
- `migrations/173_inspection_evidences_ai_columns.sql` — ai_summary, ai_model
- `migrations/154_auto_inspection_session.sql` — auto-creación desde workflow

### Scripts
- `scripts/geocode-claims.cjs` — batch geocoding de claims existentes

---

## 11. Commits Relevantes

| Commit | Fecha | Descripción |
|--------|-------|-------------|
| `8f876d1` | 2026-07-22 | Geolocalización completa: mapa evidencia + foto + bloqueo inicio |
| `cc88210` | 2026-07-23 | Videollamada WebRTC p2p con captura de fotos en vivo (anti-fraude) |
| `2aa8c60` | 2026-07-23 | N° de liquidación clickable → redirige al siniestro |

---

## 12. Decisiones Técnicas

### 12.1 WebRTC p2p en lugar de Jitsi/LiveKit

**Problema:** Jitsi Meet usaba un iframe externo que no daba acceso al stream de video, impidiendo capturar frames para fotos anti-fraude.

**Solución:** WebRTC peer-to-peer puro con signaling via Supabase Realtime (ya existente en el stack).

**Ventajas:**
- Acceso directo al `<video>` element → captura de frames con `canvas.drawImage`
- Sin servidor SFU → sin costo
- Sin dependencias externas (Jitsi era un script externo)
- STUN público de Google → sin infraestructura adicional

**Desventajas:**
- Para NAT simétrico se necesitaría TURN (pendiente)
- Sin grabación en la nube (la grabación sería client-side con MediaRecorder)

### 12.2 Geocoding con Nominatim

**Problema:** Necesitamos geocodificar direcciones de siniestros para validar la geolocalización del inspector/cliente.

**Solución:** Nominatim de OpenStreetMap (gratis, sin API key).

**Limitación:** No resuelve direcciones chilenas muy específicas (50/127 claims geocodificados). Para mejorar precisión se necesitaría Google Maps Geocoding API o Mapbox (con costo).

### 12.3 Campo `source` en evidencias

**Problema:** Necesitamos distinguir evidencias subidas manualmente de las capturadas en vivo (anti-fraude).

**Solución:** Columna `source` en `inspection_evidences` con valores: `upload`, `screenshot_inspector`, `screenshot_client`, `live_video`, `geo_map`.

### 12.4 Bloqueo de inicio sin geolocalización (presencial)

**Regla:** En inspecciones presenciales, el botón "Iniciar inspección" está deshabilitado hasta que el inspector capture su geolocalización en el lugar del siniestro.

**Excepción:** `out_of_range` no bloquea (warning no bloqueante — se permite continuar pero queda registrado para auditoría).

**Rationale:** Prevenir que el inspector inicie la inspección desde una ubicación que no sea el lugar del siniestro (anti-fraude).
