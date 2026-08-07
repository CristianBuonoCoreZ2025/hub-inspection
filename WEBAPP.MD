# Estrategia Mobile para el Módulo de Inspecciones

> Fecha: sesión actual.
> Estado: documento de alcance para decisión de arquitectura.

---

## 1. Contexto

El objetivo es permitir que un **inspector** haga login desde su celular, vea sus inspecciones asignadas y las ejecute con una mecánica de pantallas similar a la actual del dashboard.

Dado el estado actual del sistema (magic link lento, bundle pesado, trabajo en curso en optimización del lado asegurado), se analizaron dos alternativas: **Solución A (Web/PWA móvil)** y **Solución B (App instalable nativa/híbrida)**.

---

## 2. Solución A — Web/PWA móvil

### 2.1 Tecnología
- Next.js App Router.
- Tailwind responsive mobile-first.
- Supabase Auth (mismo login).
- TanStack Query con cache y reintentos.
- IndexedDB para cache offline básico.
- PWA manifest para instalación parcial.
- Cámara vía `<input capture>`.

### 2.2 Rutas propuestas

```
/mobile/login
/mobile/inspecciones
/mobile/inspecciones/[id]
/mobile/inspecciones/[id]/paso/1  # inicio
/mobile/inspecciones/[id]/paso/2  # fotos
/mobile/inspecciones/[id]/paso/3  # checklist
/mobile/inspecciones/[id]/paso/4  # daños
/mobile/inspecciones/[id]/paso/5  # croquis
/mobile/inspecciones/[id]/paso/6  # firmas
/mobile/inspecciones/[id]/paso/7  # chat/videollamada
/mobile/inspecciones/[id]/paso/8  # resumen y finalizar
```

### 2.3 Flujo pantalla por pantalla

#### Pantalla 1 — Login
- Logo.
- Email (`input type="email"`).
- Contraseña (`input type="password"`).
- Toggle "Recordarme".
- Botón "Iniciar".
- Badge de conectividad.

#### Pantalla 2 — Lista de inspecciones
- Tabs: Hoy, Pendientes, Completadas.
- Cards con: código, dirección, fecha, estado, tipo.
- Pull-to-refresh.
- Botón recargar.

#### Pantalla 3 — Detalle de inspección
- Datos del siniestro y asegurado.
- Botón llamar y enviar email.
- Botón "Iniciar inspección".

#### Pantalla 4 — Inicio
- Confirmación de datos.
- Magic Link si es remota.
- Geolocalización.
- Botón "Continuar a fotos".

#### Pantalla 5 — Fotos
- Botón cámara y galería.
- Grid de fotos.
- Toggle "Reporte" por foto.
- Contador "X en informe / 20".
- Botón borrar.

#### Pantalla 6 — Checklist
- Un ítem por pantalla o lista compacta.
- Sí / No / N/A.
- Notas.
- Foto opcional.

#### Pantalla 7 — Daños
- Lista de daños.
- Botón "Agregar daño".
- Formulario: área, categoría, descripción, severidad, cantidad, unidad, foto.

#### Pantalla 8 — Croquis
- Canvas táctil.
- Pinceles.
- Guardar PNG.

#### Pantalla 9 — Firmas
- Pads para asegurado e inspector.
- "No firmó" con motivo.

#### Pantalla 10 — Chat / videollamada
- Mensajes.
- Input.
- Botón unirse a videollamada LiveKit.

#### Pantalla 11 — Resumen
- Resumen de pasos completados.
- Observaciones.
- Estado final.
- Botón "Finalizar".

#### Pantalla 12 — Confirmación
- Éxito.
- Volver al listado.

### 2.4 Cambios en base de datos

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mobile_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE inspection_sessions ADD COLUMN IF NOT EXISTS started_from_mobile BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE inspection_sessions ADD COLUMN IF NOT EXISTS inspector_geo_lat NUMERIC;
ALTER TABLE inspection_sessions ADD COLUMN IF NOT EXISTS inspector_geo_lng NUMERIC;
```

### 2.5 API endpoints nuevos

```
POST /api/mobile/auth/login
GET  /api/mobile/inspections
GET  /api/mobile/inspections/[id]
POST /api/mobile/inspections/[id]/start
POST /api/mobile/inspections/[id]/complete
```

### 2.6 Ventajas
- Rápida de implementar (~4 semanas MVP).
- Reutiliza backend y componentes.
- No requiere stores.
- Deploy continuo.

### 2.7 Desventajas
- Offline limitado.
- No publicable en App Store/Play Store.
- Cámara, GPS y notificaciones limitadas por navegador.
- Sin bloqueo real de inspecciones descargadas.
- Si el inspector borra datos del navegador, pierde todo el trabajo no sincronizado.

---

## 3. Solución B — App instalable nativa/híbrida

### 3.1 Tecnología
- Capacitor + Next.js/React estático.
- SQLite local (`@capacitor-community/sqlite`).
- Supabase Auth.
- Filesystem nativo para fotos, firmas, croquis.
- Cola de sincronización local.
- Push nativo.

### 3.2 Arquitectura
- App instalada desde Play Store / App Store.
- Base de datos local SQLite.
- Sincronización delta con backend.
- Inspecciones descargadas quedan bloqueadas en central.
- Subida de archivos en segundo plano.

### 3.3 Flujo resumido

```
Instalar app → Login → Descargar inspecciones → Trabajar offline → Sincronizar
```

### 3.4 Base de datos local (SQLite)

Tablas:
- `local_inspections`
- `local_evidences`
- `local_checklists`
- `local_damages`
- `local_sketches`
- `local_signatures`
- `local_chat_messages`
- `sync_queue`

### 3.5 API endpoints

```
POST /api/mobile/auth/login
POST /api/mobile/sync/download
POST /api/mobile/sync/upload
POST /api/mobile/upload
```

### 3.6 Ventajas
- Verdadero offline-first.
- Publicada en App Store/Play Store.
- Reconocida como app segura.
- Tokens en Keystore/Keychain.
- Acceso nativo completo.
- Sincronización robusta.

### 3.7 Desventajas
- Mucho más caro y lento (~2.5-3 meses).
- Cuentas de desarrollador y publicación.
- Mantenimiento de builds nativos.
- Actualizaciones requieren aprobación de stores.

---

## 4. Decisión de arquitectura

### 4.1 ¿Acá mismo o proyecto separado?

Dado el estado actual del proyecto:

- El magic link (`/inspection/[token]`) ya está con problemas de performance.
- Se están haciendo optimizaciones pesadas (subida secuencial, chat separado, mensajes de error por SO, etc.).
- El bundle de la app ya es grande.

**Recomendación:** no meter el módulo inspector mobile acá de inmediato. En su lugar:

1. Terminar y estabilizar las optimizaciones del magic link.
2. Medir bundle y performance en 3G/4G.
3. Si el bundle sigue creciendo: crear un **proyecto separado** que comparta Supabase, tipos y servicios.
4. Si mejora: agregar rutas `/mobile/*` con lazy loading estricto.

### 4.2 Recomendación inmediata

Para la **Solución A**, la opción más segura es un **proyecto separado** (`hub-inspection-mobile`) que importe `types`, `lib` y `services` del repo principal. Así:

- No afecta el dashboard ni el magic link.
- Crece independiente.
- Comparte base de datos y lógica.
- Deploy separado en Vercel.

---

## 5. Próximos pasos recomendados

1. Medir bundle actual del magic link.
2. Terminar optimizaciones en curso.
3. Decidir si el módulo mobile va acá o en proyecto separado.
4. Armar MVP de login + lista de inspecciones móvil.
5. Iterar paso a paso del wizard.

---

## 6. Notas

- Cero destrucción de datos.
- Cero migraciones forzosas.
- Si se agrega `mobile_enabled`, es una columna aditiva con default `false`.
