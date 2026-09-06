# Plan: App Móvil Nativa Offline-First

> **Estado:** Plan documentado para implementación futura
> **Fecha:** 2026-08-25
> **Objetivo:** App móvil nativa que funciona 100% offline para inspecciones

## Contexto

La app actual usa Capacitor con WebView que carga `https://claims.fdpchile.com`.
Funciona offline **después** de la primera visita (SW cachea la UI), pero:

- La primera carga necesita internet
- El service worker puede fallar o ser invalidado
- No hay control total sobre el ciclo de vida offline
- El WebView tiene overhead de memoria

Este plan describe cómo construir una app nativa real que no dependa del WebView.

## Arquitectura propuesta

```
┌─────────────────────────────────────────────────┐
│  App Nativa (React Native o Capacitor local)    │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  UI empaquetada en el APK                 │  │
│  │  (no carga desde servidor)                │  │
│  │  • Login con PIN offline                  │  │
│  │  • Lista de inspecciones                  │  │
│  │  • Detalle de inspección (tabs)           │  │
│  │  • Acta, daños, evidencias, firmas        │  │
│  │  • Croquis, checklist, notas              │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  SQLite local (capacitor-community/sqlite)│  │
│  │  • inspection_sessions                    │  │
│  │  • inspection_damages                     │  │
│  │  • inspection_evidences (metadata)        │  │
│  │  • inspection_signatures                  │  │
│  │  • damage_sketches                        │  │
│  │  • inspection_checklists                  │  │
│  │  • inspection_notes                       │  │
│  │  • third_parties                          │  │
│  │  • sync_queue (cambios pendientes)        │  │
│  │  • catalogs (caché 24h)                   │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  Filesystem nativo                        │  │
│  │  • photos/ (evidencias offline)           │  │
│  │  • sketches/ (croquis)                    │  │
│  │  • signatures/ (firmas)                   │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  Sync Engine                              │  │
│  │  • Detectar conexión (Network plugin)     │  │
│  │  • Subir fotos a R2/Supabase Storage      │  │
│  │  • Subir datos a Supabase DB              │  │
│  │  • Marpiar como synced                    │  │
│  │  • Resolver conflictos                    │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  Puentes nativos                          │  │
│  │  • Camera (fotos nativas con EXIF GPS)    │  │
│  │  • Geolocation (GPS de alta precisión)    │  │
│  │  • Haptics (vibración)                    │  │
│  │  • Network (online/offline detection)     │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         │
         │ (cuando hay internet)
         ▼
┌─────────────────────────────────────────────────┐
│  Supabase (PostgreSQL + Storage + Auth)         │
│  • inspection_sessions                          │
│  • inspection_damages                           │
│  • inspection_evidences                         │
│  • R2 Storage (fotos, firmas, croquis)          │
└─────────────────────────────────────────────────┘
```

## Opción A: Capacitor con build local (recomendado)

Mantener Capacitor pero empaquetar la UI dentro del APK.

### Cambios necesarios

1. **Crear build estático de las páginas móviles**
   - Extraer `/mobile/*` del web app
   - Exportar como estático (sin SSR, sin API routes)
   - Las API calls van directo a Supabase (no via Next.js API routes)

2. **Reemplazar IndexedDB por SQLite**
   - `capacitor-community/sqlite` ya instalado
   - Migrar `src/db/offline-db.ts` de Dexie/IndexedDB a SQLite
   - Mismas tablas, mismo schema

3. **Reemplazar fetch a API routes por Supabase directo**
   - En vez de `fetch('/api/inspection/evidences/upload')`
   - Usar `supabase.storage.from('evidences').upload()`
   - En vez de `fetch('/api/inspection/sign')`
   - Usar `supabase.from('inspection_signatures').insert()`

4. **Configurar capacitor.config.ts**
   ```ts
   server: {
     // Sin url — carga desde webDir local
     androidScheme: "https",
   },
   webDir: "out", // build estático empaquetado
   ```

### Ventajas
- Reusa componentes React existentes
- Mismo código de UI
- SQLite nativo (más rápido que IndexedDB)
- Funciona 100% offline desde la primera vez

### Desventajas
- Necesita refactorizar las API calls (de Next.js routes a Supabase directo)
- El build estático puede tener problemas con middleware/auth

## Opción B: React Native (rewrite completo)

Reescribir la UI con componentes nativos de React Native.

### Ventajas
- Performance nativa real
- No hay WebView
- Acceso completo al hardware

### Desventajas
- Reescribir TODA la UI (semanas de trabajo)
- No reusa componentes React existentes
- Curva de aprendizaje

## Opción C: Expo + React Native (medio término)

Usar Expo con React Native Web para compartir algo de código.

### Ventantes
- Comparte lógica de negocio (hooks, services, types)
- UI nativa real
- Expo maneja el build

### Desventajas
- UI necesita reescribirse
- Configuración compleja

## Recomendación

**Opción A (Capacitor con build local)** porque:

1. Reusa todo el código de UI existente
2. Solo necesita refactorizar API calls (de Next.js routes a Supabase directo)
3. SQLite ya instalado (`capacitor-community/sqlite`)
4. Mismo flujo de build (Android Studio)
5. Menor tiempo de implementación (1-2 semanas vs 4-6 semanas)

## Fases de implementación (Opción A)

### Fase 1: Build estático (3-5 días)
- [ ] Crear `apps/mobile` con Next.js export estático
- [ ] Copiar páginas de `/mobile/*` del web app
- [ ] Configurar `output: "export"` en next.config
- [ ] Resolver problemas de SSR/middleware
- [ ] Probar que las páginas carguen localmente

### Fase 2: SQLite local (3-5 días)
- [ ] Crear schema de SQLite (mismas tablas que IndexedDB)
- [ ] Implementar capa de datos offline (CRUD local)
- [ ] Migrar `offline-db.ts` de Dexie a SQLite
- [ ] Implementar descarga de inspecciones a SQLite
- [ ] Probar offline: descargar → editar → verificar datos locales

### Fase 3: Sync engine (3-5 días)
- [ ] Implementar detección de conexión (Network plugin)
- [ ] Implementar subida de fotos a R2/Storage
- [ ] Implementar subida de datos a Supabase
- [ ] Implementar resolución de conflictos
- [ ] Probar: offline → editar → online → sync → verificar en DB

### Fase 4: Refactor API calls (2-3 días)
- [ ] Reemplazar `fetch('/api/inspection/*')` por Supabase directo
- [ ] Reemplazar upload de archivos (de API route a Storage directo)
- [ ] Reemplazar generación de reportes (de API route a función local)
- [ ] Probar que todo funcione online y offline

### Fase 5: Build y distribución (1-2 días)
- [ ] Build del APK en Android Studio
- [ ] Probar en dispositivo real
- [ ] Generar AAB para Google Play
- [ ] Configurar ícono, splash screen, permisos

## Total estimado: 12-20 días hábiles

## Datos del web app que se reusan

### Tipos (src/types/index.ts)
- `InspectionSession` (líneas 408-500)
- `InspectionDamage` (líneas 500-600)
- `InspectionEvidence` (líneas 600-700)
- `InspectionSignature` (líneas 700-750)
- `DamageSketch` (líneas 750-789)

### Servicios (src/services/inspections.ts)
- `startInspection()` (línea 430)
- `completeInspection()` (línea 500)
- `getInspectionSession()` (línea 100)
- `updateActa()` (línea 600)
- `createDamage()` / `updateDamage()` / `deleteDamage()`

### Offline (src/lib/offline/)
- `download-session.ts` — Lógica de descarga
- `sync-session.ts` — Lógica de sync
- `offline-db.ts` — Schema de IndexedDB (migrar a SQLite)

### Componentes (src/app/mobile/)
- `page.tsx` — Lista de inspecciones
- `[id]/page.tsx` — Detalle con tabs
- `tabs/acta-tab.tsx` — Formulario de acta
- `tabs/damages-tab.tsx` — Registro de daños
- `tabs/evidences-tab.tsx` — Fotos
- `tabs/signatures-tab.tsx` — Firmas
- `tabs/sketches-tab.tsx` — Croquis
- `tabs/checklist-tab.tsx` — Checklist
- `tabs/report-tab.tsx` — Informe

### Puentes nativos ya configurados
- `@capacitor/camera` — Cámara nativa
- `@capacitor/geolocation` — GPS nativo
- `@capacitor/filesystem` — Filesystem del teléfono
- `@capacitor/haptics` — Vibración
- `@capacitor/network` — Detección online/offline
- `@capacitor-community/sqlite` — SQLite local
- `@capacitor/preferences` — Storage key-value
- `@capacitor/splash-screen` — Splash screen
- `@capacitor/status-bar` — Status bar

## Rutas API que se eliminan (van directo a Supabase)

| API Route | Reemplazo |
|-----------|-----------|
| `/api/inspection/evidences/upload` | `supabase.storage.upload()` |
| `/api/inspection/evidences/session/[sessionId]` | `supabase.from('inspection_evidences').select()` |
| `/api/inspection/evidences/[evidenceId]` | `supabase.from('inspection_evidences').delete()` |
| `/api/inspection/sign/upload` | `supabase.storage.upload()` + `supabase.from('inspection_signatures').insert()` |
| `/api/inspection/sign` | `supabase.from('inspection_signatures').insert()` |
| `/api/inspection/sketch/upload` | `supabase.storage.upload()` |
| `/api/inspection/sketch` | `supabase.from('damage_sketches').insert()` |
| `/api/inspection/chat` | `supabase.from('inspection_chat_messages').insert()` |
| `/api/inspection/geo/save-map` | `supabase.storage.upload()` |
| `/api/inspection/geo/reset-geo` | `supabase.from('inspection_sessions').update()` |
| `/api/inspection/sessions/[id]/active-tab` | `supabase.from('inspection_sessions').update()` |

## Rutas API que se mantienen (necesitan lógica server-side)

| API Route | Motivo |
|-----------|--------|
| `/api/inspection/live/[token]` | Validación de magic link |
| `/api/inspection/report/upload` | Generación de PDF (requiere servidor) |
| `/api/inspection/connection-log` | Log de conexión (realtime) |
| `/api/inspection/event-log` | Log de eventos (realtime) |

Estas rutas se llaman directo a `https://claims.fdpchile.com/api/...` desde la app móvil.
