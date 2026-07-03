# Claims Hub Platform — Reglas del Proyecto

## Stack Tecnológico
- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript (estricto)
- **Estilos:** Tailwind CSS v4
- **Componentes UI:** shadcn/ui
- **Formularios:** React Hook Form + Zod
- **Gestión de Estado:** Zustand
- **Datos/Cache:** TanStack Query (React Query)
- **Backend:** Nhost (PostgreSQL + Hasura GraphQL, Auth, Storage, Functions)
- **Gestor de paquetes:** pnpm
- **Deploy:** Vercel

## Arquitectura
- Estructura **feature-based**:
  - `src/app/` — rutas de Next.js App Router
  - `src/features/` — módulos de negocio (auth, dashboard, claims, inspections, etc.)
  - `src/components/` — componentes compartidos (ui, layout)
  - `src/lib/` — utilidades, configuraciones (nhost, etc.)
  - `src/hooks/` — custom hooks reutilizables
  - `src/services/` — lógica de acceso a datos (Nhost GraphQL clients)
  - `src/server/` — server actions y lógica server-only
  - `src/types/` — tipos TypeScript globales
- No usar mocks ni funcionalidades simuladas. Todo conectado a Nhost desde la primera versión.

## Convenciones de Código
- Usar **function components** en lugar de arrow functions para componentes React.
- Usar `async/await` para operaciones asíncronas.
- Preferir **Server Components** por defecto; usar `"use client"` solo cuando sea necesario (hooks del browser, eventos, etc.).
- Validar todos los inputs de usuario con **Zod**.
- Usar **React Hook Form** para todos los formularios.
- Mantener separación clara entre Server Actions y Client Components.
- Usar `@nhost/nhost-js` para autenticación en Next.js (cookies via SessionStorage).

## Multi Tenant & Seguridad
- Todas las tablas deben tener `company_id` o `tenant_id`.
- Implementar **Row Level Security (RLS)** en TODAS las tablas desde el inicio.
- Nunca usar bypass de seguridad (`security definer` solo en funciones controladas).
- Usar `NHOST_ADMIN_SECRET` solo en server actions o Nhost Functions, nunca en cliente.
- Auditoría completa: registrar quién crea/modifica/elimina registros.

## Base de Datos (Nhost / Hasura)
- Usar migraciones SQL manuales versionadas en `migrations/`.
- Hasura debe "track" las tablas después de aplicar migraciones.
- Configurar permisos de Hasura (además de RLS PostgreSQL) desde Nhost Console.
- Tablas clave: `companies`, `tenants`, `profiles`, `roles`, `user_roles`, `claims`, `claim_participants`, `inspection_sessions`, `inspection_checklists`, `inspection_damages`, `inspection_evidences`, `inspection_notes`, `inspection_signatures`, `inspection_reports`, `inspection_chat_messages`, `magic_links`, `audit_logs`.

## Branding & UI
- Diseño premium inspirado en Vercel, Stripe, Linear, Notion, Clerk, Nhost.
- Dark Mode y Light Mode obligatorios.
- Mobile First, totalmente responsive.
- Sidebar profesional con navegación clara.
- Sistema de white-label preparado para logos y colores por empresa.

## Módulos de Desarrollo (Orden de Prioridad)
1. **Base SaaS:** Landing, Auth, Dashboard, Navegación, Multi-tenant, Usuarios, Empresas.
2. **Core:** Siniestros (Claims), Agenda.
3. **Inspección Remota:** Sala LiveKit, Evidencias, Checklist, Daños, Firmas, PDF.
4. **Avanzado:** IA (OpenRouter), OCR, Croquis, Realtime completo.

## Comandos del Proyecto
- `pnpm dev` — iniciar desarrollo
- `pnpm build` — build de producción
- `pnpm lint` — linting
- `pnpm typecheck` — verificación de tipos (si está configurado)
- `pnpm db:push` — ejecutar migraciones SQL en PostgreSQL (scripts/db-push.ts)

## Notas Importantes
- No comenzar con videollamadas, IA o PDF hasta que la base SaaS esté 100% funcional.
- Todo debe ser escalable, seguro y listo para producción.
- Documentar decisiones técnicas importantes en este archivo.

---

# Decisiones Técnicas y Soluciones Definitivas (Lecciones Aprendidas)

> Cada problema encontrado durante el desarrollo debe resolverse con una solución definitiva de producto final (no workarounds temporales). Esta sección documenta esas decisiones.

---

## 1. Migraciones SQL en Nhost / Hasura

### Problema
Nhost no tiene CLI nativo para Windows. No se puede usar `nhost db push` como en Supabase.

### Solución Definitiva
- Crear script propio `scripts/db-push.ts` usando `node-postgres` (`pg`).
- Las migraciones se ejecutan contra PostgreSQL directamente con la `DATABASE_URL`.
- Siempre usar `ssl: { rejectUnauthorized: false }` en conexiones externas a Nhost PostgreSQL.
- Dividir migraciones en archivos secuenciales (`01_tables.sql`, `02_triggers.sql`, `03_policies.sql`).
- Como fallback, si el DNS de Nhost no resuelve (acción pública recién activada), usar el **Hasura SQL Editor** (Data → SQL).

### Regla
```
Toda migración nueva debe: (a) funcionar con pnpm db:push, y (b) poder ejecutarse manualmente en Hasura SQL Editor.
```

---

## 2. No usar `CREATE POLICY IF NOT EXISTS`

### Problema
PostgreSQL 14 (versión de Nhost) no soporta `CREATE POLICY IF NOT EXISTS`. Lanza: `syntax error at or near "NOT"`.

### Solución Definitiva
Usar el patrón:
```sql
DROP POLICY IF EXISTS "nombre_policy" ON tabla;
CREATE POLICY "nombre_policy" ON tabla ...;
```

### Regla
```
Nunca usar CREATE POLICY IF NOT EXISTS en migraciones. Siempre usar DROP IF EXISTS + CREATE.
```

---

## 3. No usar `TO authenticated` en Policies PostgreSQL

### Problema
`authenticated` no es un rol PostgreSQL nativo. Es específico de Supabase. Nhost/Hasura usan roles diferentes.

### Solución Definitiva
- **RLS PostgreSQL:** usar `TO public` o no especificar `TO` (default `public`).
- **Control de acceso real:** Configurar permisos en **Hasura Console → Data → [Tabla] → Permissions**.
- Los roles de Hasura son: `admin`, `user`, `anonymous`, etc. (configurables).
- El rol por defecto de Nhost Auth es `user`.

### Regla
```
Nunca usar TO authenticated en CREATE POLICY. Las restricciones de acceso se implementan vía Hasura Permissions, no RLS nativo.
```

---

## 4. Flujo de Registro (Signup) con Nhost Auth

### Problema
Nhost Auth requiere verificación de email por defecto. Al registrarse, `session` es `null` hasta que el usuario confirme el email. Intentar hacer GraphQL queries (como crear empresa) inmediatamente después del signup falla porque no hay sesión activa.

### Solución Definitiva
1. **Signup puro:** solo registrar en Nhost Auth, sin operaciones GraphQL.
2. **Si requiere verificación:** mostrar pantalla de "Revisa tu correo".
3. **Si no requiere verificación (dev):** redirigir al onboarding o dashboard.
4. **Onboarding obligatorio:** Después del primer login exitoso, si el usuario no tiene `company_id` asignado en su `profile`, redirigir a `/onboarding` para crear la empresa.
5. **La empresa se crea DESPUÉS del login**, no durante el registro.
6. El trigger `handle_new_user` crea el `profile` automáticamente al insertar en `auth.users`.

### Regla
```
El registro NUNCA debe hacer operaciones GraphQL. La empresa y perfil completo se configuran en el onboarding post-login.
```

---

## 5. Hasura: Track Tables Obligatorio

### Problema
Hasura no expone automáticamente las tablas en GraphQL después de crearlas con SQL.

### Solución Definitiva
Después de cada migración que crea tablas nuevas:
1. Ir a **Hasura Console → Data**
2. Buscar la sección **"Untracked tables or views"**
3. Seleccionar todas las tablas nuevas → **"Track"** o **"Track All"**
4. Opcionalmente, también hacer **"Track All Relationships"** para que Hasura reconozca las FK.

### Regla
```
Toda tabla nueva creada por migración DEBE ser "tracked" en Hasura antes de que el frontend pueda usarla en GraphQL.
```

---

## 6. Variables de Entorno para Nhost

### Configuración mínima requerida en `.env.local`:
```env
# Nhost Cloud (subdomain + region)
NEXT_PUBLIC_NHOST_SUBDOMAIN=tu-subdomain
NEXT_PUBLIC_NHOST_REGION=eu-central-1

# O URLs individuales (para local o custom)
NEXT_PUBLIC_NHOST_AUTH_URL=https://auth.tu-proyecto.nhost.run
NEXT_PUBLIC_NHOST_GRAPHQL_URL=https://graphql.tu-proyecto.nhost.run/v1
NEXT_PUBLIC_NHOST_STORAGE_URL=https://storage.tu-proyecto.nhost.run

# Para db:push (PostgreSQL connection string)
DATABASE_URL="postgres://postgres:password@host:port/database"
```

### Regla
```
El archivo .env.local debe tener SIEMPRE DATABASE_URL para migraciones, y las variables de Nhost para la app.
```

---

## 7. SDK de Nhost v4: Patrones de Uso

### Auth (siempre retorna `FetchResponse` con `.body`):
```ts
const { body } = await nhost.auth.signInEmailPassword({ email, password });
if (body.session) { /* login OK */ }
```

### GraphQL (siempre envuelto en objeto `{ query, variables }`):
```ts
const { body } = await nhost.graphql.request({
  query: `...`,
  variables: { ... }
});
if (body.errors) { throw new Error(...) }
return body.data;
```

### Regla
```
Todas las llamadas al SDK Nhost v4 deben usar .body para acceder a los datos de respuesta.
```

---

## 8. Onboarding de Empresa (Flujo Definitivo)

### Problema
El usuario recién registrado no tiene empresa asociada. No puede crear siniestros ni invitar usuarios.

### Solución Definitiva
1. Trigger `handle_new_user` crea `profiles` automáticamente con `company_id = null`.
2. Middleware detecta usuarios autenticados sin `company_id`.
3. Redirige a `/onboarding` donde el usuario crea su primera empresa.
4. La empresa queda vinculada al perfil del usuario.
5. Después del onboarding, redirige al dashboard.

### Regla
```
Todo usuario autenticado DEBE tener una empresa asociada antes de acceder al dashboard principal.
El onboarding es una barrera obligatoria para usuarios sin company_id.
```

---

## 9. Sistema de Logging Centralizado

### Problema
Errores del frontend se pierden en la consola del navegador. No hay trazabilidad de errores en producción.

### Solución Definitiva
- Crear `src/lib/logger.ts` — logger centralizado con niveles (info, warn, error).
- Usar `logger.error(message, error, context)` en TODOS los catch blocks del frontend.
- Crear `src/components/error-boundary.tsx` — captura errores de React y los loguea.
- Crear API route `POST /api/logs` — recibe logs del frontend en producción.
- En desarrollo, los logs se imprimen en consola. En producción, se envían al servidor.
- El logger almacena hasta 500 logs en memoria para debugging.

### Uso obligatorio:
```ts
import { logger } from "@/lib/logger";

// En catch blocks del frontend:
logger.error("Descripción del error", err, {
  component: "NombreComponente",
  action: "nombreAccion",
  metadata: { userId, extraData },
});
```

### Regla
```
Todo error capturado en el frontend DEBE pasar por logger.error() con contexto (componente, acción, metadata).
Nunca usar console.error() directamente en producción.
```

---

## 10. Sistema de Estilos (de hub-stock-ai)

### Principio
Todo el diseño visual sigue el sistema de estilos de hub-stock-ai: tokens CSS, paleta semántica de botones, clases de layout, y modales estándar.

### Tokens de Color
- Modo claro: fondo #fafafa, texto #0a0a0a, primario #0a0a0a, acento cálido #fff7ed
- Modo oscuro: fondo #0c0c0e, texto #fafafa, primario #fafafa
- Radio base: 0.75rem (12px)
- Sombra de tarjeta: `0 1px 2px rgb(0 0 0 / 0.04), 0 4px 12px rgb(0 0 0 / 0.04)`

### Paleta Semántica de Botones (OBLIGATORIA)
```
.btn-save / .btn-confirm     → verde esmeralda  (Guardar, Confirmar)
.btn-create / .btn-new       → esmeralda-teal    (Crear, Nuevo)
.btn-run / .btn-execute      → sky-blue          (Ejecutar, Procesar)
.btn-homolog / .btn-ai       → violeta-primary   (IA, Homologación)
.btn-review / .btn-violet-alt → violeta-fuchsia  (Revisar)
.btn-warn / .btn-alert       → ámbar-naranja     (Advertencia)
.btn-danger / .btn-delete    → rosa-rojo         (Eliminar)
.btn-cancel                   → zinc con borde    (Cancelar)
.btn-close                    → borde neutro      (Cerrar)
.btn-skip                     → slate semi-opaco  (Saltar)
.btn-neutral                  → fondo mutado      (Acción neutral)
```

### Tamaños de Botones
```
.btn-lg       → h-10 w-[225px]    (principal con texto)
.btn-lg-block → h-10 w-full       (ancho completo en modales)
.btn-sm       → h-10 w-[175px]    (secundario)
.btn-footer   → h-9 shrink-0       (pie de modal)
.btn-icon     → w-8 h-8           (solo ícono)
```

### Regla OBLIGATORIA y ÚNICA de Botones
```
ESTA ES LA ÚNICA REGLA DE BOTONES. NO crear botones con dimensiones,
colores o textos diferentes a los definidos aquí.

┌─────────────────────────────────────────────────────────────────┐
│ 1. TEXTO: Siempre UNA sola palabra. NUNCA dos. NUNCA sin texto. │
│    Si se necesita contexto, usar un ícono, nunca texto extra.    │
│    Los botones SIEMPRE deben tener texto (no solo ícono).        │
└─────────────────────────────────────────────────────────────────┘

Textos permitidos (una palabra + ícono opcional):
  ✅ "Nuevo"    (Plus)       ✅ "Editar"   (Pencil)
  ✅ "Guardar"  (Save)       ✅ "Crear"    (Plus)
  ✅ "Cancelar" (sin ícono)  ✅ "Exportar" (Download)
  ✅ "Imprimir" (Printer)    ✅ "Eliminar" (Trash2)
  ✅ "Invitar"  (UserPlus)   ✅ "Atrás"    (ArrowLeft)
  ✅ "Siguiente"(ArrowRight) ✅ "Cerrar"   (X)

Textos PROHIBIDOS (dos o más palabras):
  ❌ "Nuevo Siniestro"    ❌ "Guardar Cambios"
  ❌ "Exportar CSV"       ❌ "Crear Empresa"
  ❌ "Enviar Invitación"  ❌ "Imprimir / Guardar PDF"

Excepción: Títulos de modales (DialogTitle) pueden tener texto descriptivo.

┌─────────────────────────────────────────────────────────────────┐
│ 2. COLORES: Solo dos clases de color para botones de acción.     │
│    .btn-save  → azul  (Aceptar, Siguiente, Grabar, Crear, Guardar)│
│    .btn-cancel→ rosa  (Cancelar, Cerrar)                         │
│    NUNCA usar otros colores. NUNCA mezclar.                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 3. DIMENSIONES: Alto fijo 29px para todos. Ancho según contexto. │
│    .btn-save / .btn-cancel → height: 29px (en buttons.css)       │
│    .btn-sm  → w-[175px]  (pantallas de listado/catálogos)        │
│    .btn-lg  → w-[225px]  (pantallas principales)                 │
│    Wizard footer → w-[122px] (Cancelar, Atrás, Siguiente, Crear) │
│    NUNCA crear botones con alto o ancho diferente.               │
└─────────────────────────────────────────────────────────────────┘

Excepción ÚNICA: Botón "Desligar Asegurado" (esmeralda, w-[150px], h-6)
es el único botón especial permitido. No crear más botones especiales.
```

### Regla OBLIGATORIA de Combos (FormSelect) No Obligatorios
```
Todos los FormSelect que NO sean obligatorios (sin asterisco rojo *)
DEBEN incluir la prop `clearable` para permitir al usuario deseleccionar
y volver al estado vacío.

Ejemplo:
<FormSelect
  control={form.control}
  name="brokerId"
  placeholder="Seleccionar corredor..."
  className="app-input h-7"
  clearable
  items={...}
>
  ...
</FormSelect>

Los FormSelect obligatorios (con *) NO deben tener `clearable`.
```

### Clases de Layout
```
.app-page          → max-w-6xl, flex flex-col gap-8
.app-page-header   → flex flex-col gap-1.5
.app-page-title    → text-lg/xl font-semibold
.app-page-lead     → text-[13px] text-muted-foreground
.app-panel         → rounded-xl border bg-card p-4 sm:p-6
.app-toolbar       → flex flex-col gap-3 sm:flex-row sm:justify-between
.glass-panel      → tarjeta con borde + sombra + fondo elevado
```

### Modales (3 tamaños canónicos)
```
.modal-sm  → w-[min(96vw,480px)]  → confirmaciones, formularios simples (1-3 campos)
.modal-md  → w-[min(96vw,640px)]  → formularios estándar (4-8 campos) ← DEFAULT
.modal-lg  → w-[min(98vw,900px)]  → tablas, vistas complejas, dos columnas
```
Estructura interna:
```
.modal-header  → border-b px-6 pb-4 pt-5
.modal-body    → flex-1 overflow-y-auto px-6 py-5
.modal-footer  → border-t px-6 py-4 (botones a la derecha)
```

### Formularios
```
.app-field-label   → text-[11px] font-semibold uppercase tracking-wide
.app-input         → h-7 (28px) rounded-lg border px-2.5 text-[12px]
```

### Espaciado entre Agrupaciones (OBLIGATORIO)
```
Entre cards/grupos dentro de un tab o sección, usar SIEMPRE space-y-2 (8px)
y gap-2 (8px) para grids. NO usar space-y-4, space-y-6, gap-4, o gap-6
entre agrupaciones de cards.

Esto aplica a TODAS las pantallas del sistema, tanto de visualización
como de edición/formularios:
- Detalle de siniestro (view)
- Editar siniestro (edit-claim-form)
- Detalle de inspección
- Catálogos
- Operaciones
- Wizard de creación

Ejemplo correcto:
<div className="space-y-2">
  <div className="app-panel">...</div>
  <div className="app-panel">...</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
  <div className="lg:col-span-2 space-y-2">...</div>
  <div className="space-y-2">...</div>
</div>
```

### Tamaño de Inputs y Combos (OBLIGATORIO)
```
Todos los inputs (.app-input) y combos (FormSelect) DEBEN usar:
- font-size: 12px (text-xs)
- height: 28px (h-7)

Esto mantiene consistencia con las pantallas de visualización (text-[12px])
y evita que los formularios se desordenen con cajas demasiado grandes.

Los FormSelect SIEMPRE deben llevar className="app-input h-7".
NO usar h-8, h-9, h-10, ni text-sm en inputs o combos.
```

### Tablas
```
.app-data-table-wrap → overflow-x-auto rounded-xl border bg-card
.app-data-table      → w-full min-w-[520px] text-[13px]
```

### Regla
```
Nunca usar colores hardcodeados (bg-blue-500). Siempre usar clases semánticas (.btn-save, .btn-danger) o tokens CSS (var(--primary)).
Todos los modales DEBEN usar uno de los 3 tamaños canónicos: modal-sm (480px), modal-md (640px), o modal-lg (900px).
Todas las tarjetas DEBEN usar glass-panel o app-panel.
```

### Skins de Escritorio
```
5 pieles disponibles via html[data-ui-style]:
- nordic-air     → DM Sans + Sora, radius 1rem, rejilla holgada
- pastel-dream   → Quicksand + Manrope, radius 1.45rem, modal etéreo
- bubble-play    → Nunito + Fredoka, radius 1.85rem, modal grueso
- kinetic-pop    → Space Grotesk + Syne, radius 0.45rem, compacto
- neo-playful    → Bricolage + Unbounded, radius 1.15rem, display

Selección en sidebar: UiStyleDevSelect recarga la página al cambiar.
```

### Log de Diagnóstico
```
- Panel flotante global activable desde /dashboard/configuracion
- Intercepta todos los fetch cuando está activo
- Sesiones por ruta con métricas (eventos, errores, lentos, duplicados)
- Exporta a JSON: diagnostic-log__ruta__fecha.json
- No exponer secrets ni datos sensibles (sanitizeObject)
```

---

## 11. Estados del Siniestro (Claim Status) — Flujo Definitivo

> Los estados del siniestro son **lineales y no reversibles** (excepto reapertura especial).
> Una vez que un caso avanza al siguiente estado, no puede volver al anterior por flujo normal.

### Estados (5) — `lookup_catalog` categoría `claim_status`

| Código | Nombre | sort_order | Color Badge |
|---|---|---|---|
| `created` | Creación | 1 | slate (gris claro) |
| `adjustment` | Liquidación | 2 | amber (ámbar) |
| `dispatchment` | Despacho | 3 | blue (azul) |
| `closed` | Cierre | 4 | gray (gris) |
| `reopened` | Reapertura | 5 | purple (púrpura) |

### Flujo de Estados

```
created → adjustment → dispatchment → closed
                                              ↓
                                         [Reapertura especial]
                                              ↓
                                         reopened ≡ adjustment
                                              ↓
                                         closed (vía gestión de cierre)
```

### Reglas por Estado

#### 1. Creación (`created`)
- **Estado inicial** al crear un siniestro.
- El caso puede o no tener inspector/liquidador asignado (la asignación no determina el estado).
- Se pueden editar todos los datos del siniestro.
- Se pueden asignar participantes (asegurado, contratante, beneficiario).
- **Transición a `adjustment`:** Puede ocurrir por cualquiera de estos triggers:
  - Asignación de inspector o liquidador.
  - Creación/agendamiento de la primera inspección.
  - Cambio manual desde la UI.
  - Lo importante es que el cambio sea **unidireccional** (no se puede volver a `created`).

#### 2. Liquidación (`adjustment`)
- Es el estado de **trabajo activo** del caso.
- Se realizan inspecciones, se cargan evidencias, daños, firmas, etc.
- Se pueden modificar datos del siniestro (con permisos).
- Se pueden agregar/editar participantes.
- Se pueden generar gestiones.
- **Transición:** Cuando se carga una **gestión de despacho** → `dispatchment`.

#### 3. Despacho (`dispatchment`)
- El caso ya tiene ciertas gestiones aplicadas.
- Se solicita el despacho del caso.
- Se continúa trabajando pero con restricciones.
- **Transición:** Cuando se carga una **gestión de cierre** → `closed`.

#### 4. Cierre (`closed`)
- El caso está **totalmente bloqueado**.
- **NO se pueden ejecutar acciones:**
  - No se pueden generar nuevas inspecciones.
  - No se pueden modificar datos del siniestro.
  - No se pueden agregar/editar participantes.
  - No se pueden cargar gestiones.
  - No se pueden modificar evidencias, daños, ni firmas.
- El caso queda en modo **solo lectura**.
- **Transición:** Solo vía **Reapertura especial** (proceso administrativo).

#### 5. Reapertura (`reopened`)
- Es un **proceso especial** (no parte del flujo normal).
- Se accede desde un **menú de operaciones** (similar al menú de inhabilitación de casos).
- Requiere permisos especiales (rol administrador/operaciones).
- Al reabrir, el estado es **funcionalmente idéntico a `adjustment`** (liquidación):
  - Permite trabajar en el sistema.
  - Permite modificar datos (con permisos).
  - Permite generar gestiones e inspecciones.
- **Transición:** Cuando se carga una nueva **gestión de cierre** → `closed` (vuelve a quedar bloqueado).

### Transiciones Permitidas

| Desde | Hacia | Trigger |
|---|---|---|
| `created` | `adjustment` | Asignar inspector/liquidador, agendar primera inspección, o cambio manual |
| `adjustment` | `dispatchment` | Cargar gestión de despacho |
| `dispatchment` | `closed` | Cargar gestión de cierre |
| `closed` | `reopened` | Reapertura especial (menú operaciones) |
| `reopened` | `closed` | Cargar gestión de cierre |

### Transiciones PROHIBIDAS
- `adjustment` → `created` (no se puede volver atrás)
- `dispatchment` → `adjustment` (no se puede volver atrás)
- `closed` → `adjustment` (solo vía reapertura especial)
- `closed` → `dispatchment` (no se puede volver atrás)
- `closed` → `created` (no se puede volver atrás)

### Bloqueos en estado `closed`

Cuando un siniestro está en estado `closed`:
- **UI:** Todos los formularios de edición se deshabilitan.
- **Botones de acción:** "Editar", "Nueva Inspección", "Agregar Gestión" se ocultan o deshabilitan.
- **API:** Las mutaciones de GraphQL deben validar que el claim no esté `closed` antes de permitir cambios.
- **Excepción:** La reapertura desde el menú de operaciones es la única acción permitida.

### Menú de Reapertura (Operaciones)

- Ubicación: Dashboard → Operaciones (o Configuración avanzada).
- Similar al menú de inhabilitación de casos existente.
- Lista solo casos en estado `closed`.
- Al reabrir:
  1. Cambia `status_id` al ID correspondiente de `reopened`.
  2. Registra auditoría (quién, cuándo, motivo).
  3. El caso vuelve a ser editable como en `adjustment`.
- Al cerrar nuevamente:
  1. Se carga una **gestión de cierre** dentro del caso.
  2. Cambia `status_id` al ID de `closed`.
  3. El caso vuelve a quedar bloqueado.

### Regla
```
Los estados del siniestro son LINEALES: created → adjustment → dispatchment → closed.
Ningún caso puede retroceder al estado anterior por flujo normal.
La única excepción es la REAPERTURA especial desde operaciones, que es funcionalmente
idéntica a liquidación (adjustment) y permite volver a trabajar y cerrar el caso nuevamente.
El estado closed BLOQUEA TODA acción: no ediciones, no inspecciones, no gestiones, no modificaciones.
```

---

## 12. Sistema de Acciones (Claim Actions) — Modelo del Cliente

> **Concepto clave:** Todo lo que se hace dentro de un siniestro es una **Acción**.
> Una inspección es una acción con la característica "Inspección". Una reapertura es una acción
> con la característica "Reapertura". Un cierre es una acción con la característica "Cierre".
> Las acciones tienen tipos, características (features), plantillas, y un workflow de emisión/revisión/aprobación/despacho.

### Arquitectura del Modelo (6 tablas + 1 puente)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CATÁLOGOS GLOBALES                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  action_type          action_features          characteristic       │
│  (categoría de        (característica/         (configuración       │
│   la acción)           feature de la acción)    detallada por        │
│                                              feature)              │
│  6 registros          22 registros            19+ registros         │
│                                                                     │
│  1. Proceso Ajuste    1. Inspección            screen, control,      │
│  2. Proceso Inspec.   2. Cobertura             issue, review,        │
│  3. Proceso Impug.    3. Reserva               approve, doc_tpl,     │
│  4. Cierre siniestro  4. Ajuste                email_tpl, doc_type   │
│  5. Comunicaciones    5. Coordinación Inspec.                        │
│  6. Reapertura        6. Informe Liquidación                         │
│                       7. Solicitud Anteced.                          │
│                       8. Aviso Asignación                            │
│                       9. Contacto Email Aseg.                        │
│                      10. Recepción Anteced.                          │
│                      11. Cierre                                      │
│                      12. Reapertura                                  │
│                      13. Impugnación                                 │
│                      14. Registro Indemnización                      │
│                      15. Carta Propuesta Aseg.                       │
│                      16. Respuesta Impugnación                       │
│                      17. Prórroga Siniestro                          │
│                      18. Recepción Prórroga CMF                      │
│                      19. Genérica                                    │
│                      20. Solicitud Despacho                          │
│                      21. Addendum                                    │
│                      22. Reporte Preliminar                          │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PLANTILLAS (CONFIGURACIÓN)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  action_template                                                     │
│  (plantilla predefinida por línea de negocio)                       │
│                                                                     │
│  - action_type_id     → FK a action_type                             │
│  - action_features_id → FK a action_features                         │
│  - line_business_id   → FK a línea de negocio                        │
│  - company_id         → opcional, específico por empresa             │
│  - event_id           → opcional, específico por evento              │
│  - name, description, code                                          │
│  - is_blocker, is_review_applicable, is_approval_applicable         │
│  - is_dispatch_applicable                                            │
│  - roles: issuer_role, reviewer_role, approver_role                  │
│  - días: days_to_issue/review/approve + alertas                     │
│                                                                     │
│         │                                                           │
│         ├──→ action_template_claim_status                            │
│         │    (qué plantillas aplican en qué estados del siniestro)   │
│         │    - action_template_id → FK                               │
│         │    - claim_status_id    → FK a claim_status                │
│         │    - is_active                                               │
│         │                                                           │
│         └──→ action_template_email                                    │
│              (plantillas de email asociadas a la acción)              │
│              - action_template_id → FK                                │
│              - template_id         → FK a email_template              │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    INSTANCIAS (DATOS DEL SINIESTRO)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  action (claim_actions en nuestro sistema)                          │
│  (instancia de una acción ejecutada en un siniestro)                │
│                                                                     │
│  - action_type_id, action_features_id, line_business_id             │
│  - action_template_id  → FK a la plantilla origen                    │
│  - claim_id            → FK al siniestro                             │
│  - name, description, code (copiados de la plantilla)               │
│  - action_data         → JSON con datos específicos de la acción     │
│  - action_status_id    → estado de la acción                         │
│                                                                     │
│  WORKFLOW:                                                           │
│  - created_by, created_on                                           │
│  - issued_by, issued_on     (emisión)                                │
│  - reviewed_by, reviewed_on (revisión)                               │
│  - approved_by, approved_on (aprobación)                             │
│  - dispatched_by, dispatched_on (despacho)                           │
│  - rejection fields (review_rejected_*, approve_rejected_*)         │
│  - expected_date                                                     │
│  - issuer_id, reviewer_id, approver_id, dispatcher_id                │
└─────────────────────────────────────────────────────────────────────┘
```

### Adaptación a Nuestro Sistema (PostgreSQL/UUID)

| Tabla SQL Server (bigint) | Tabla PostgreSQL (uuid) | Categoría |
|---|---|---|
| `action_type` | `action_type` (lookup_catalog cat=`action_type`) | Catálogo global |
| `action_features` | `action_features` (lookup_catalog cat=`action_feature`) | Catálogo global |
| `characteristic` | `characteristic` (tabla propia) | Catálogo global |
| `action_template` | `action_template` (tabla propia) | Configuración |
| `action_template_claim_status` | `action_template_claim_status` (tabla puente) | Configuración |
| `action_template_email` | `action_template_email` (tabla propia) | Configuración |
| `action` | `claim_actions` (tabla propia) | Datos del siniestro |

### Workflow de una Acción

```
CREADA → EMITIDA (issued) → REVISADA (reviewed) → APROBADA (approved) → DESPACHADA (dispatched)
                ↑                ↑                    ↑                    ↑
           [issuer_role]    [reviewer_role]      [approver_role]      [dispatcher_role]
```

Cada fase puede ser **rechazada** (con comentario):
- `review_rejected_by/on + reviewer_rejection_comment`
- `approve_rejected_by/on + approver_rejection_comment`
- `dispatch_rejected_by/on + dispatcher_rejection_comment`

### action_data (JSON) — Datos Específicos

Cada acción guarda sus datos específicos en `action_data` (JSON):
- **Coordinación Inspección:** `{contact, coordinationMethodId, coordinationTypeId, inspectionDateTime, inspectorId, location}`
- **Inspección:** `{contact, location, inspectionDateTime, inspectionType, comments}`
- **Coberturas:** `{coveragesRequested: [...]}`
- **Cierre:** `{closeReasonId, notes, ...}`
- **Reapertura:** `{reopenReasonId, notes, ...}`

### action_template_claim_status — Reglas de Visibilidad

Determina qué plantillas de acción están disponibles según el estado del siniestro:
- En `created` (Creación): pocas acciones disponibles
- En `adjustment` (Liquidación): la mayoría de acciones disponibles
- En `dispatchment` (Despacho): acciones de cierre
- En `closed` (Cierre): NINGUNA acción disponible (caso bloqueado)
- En `reopened` (Reapertura): mismas acciones que `adjustment`

### Características (characteristic) — Flags por Feature

Cada feature tiene flags que determinan su comportamiento:
- `screen` → tiene pantalla específica (ej: Inspección tiene pantalla, Informe de Liquidación no)
- `control` → tiene control de UI
- `issue` → requiere fase de emisión
- `review` → requiere fase de revisión
- `approve` → requiere fase de aprobación
- `document_template` → genera documento
- `email_template` → envía email
- `document_type` → tiene tipo de documento

### Mapeo de Features a Pantallas

| action_feature | Pantalla en nuestro sistema |
|---|---|
| Inspección (1) | `/dashboard/inspecciones/[id]` (ya existe) |
| Coordinación Inspección (5) | Formulario de coordinación |
| Cobertura (2) | Formulario de coberturas |
| Reserva (3) | Formulario de reserva |
| Ajuste (4) | Planilla de cuadro de ajuste |
| Informe Liquidación (6) | Generación de PDF |
| Solicitud Antecedentes (7) | Formulario + email |
| Aviso Asignación (8) | Notificación automática |
| Contacto Email (9) | Formulario + email |
| Recepción Anteced. (10) | Confirmación de recepción |
| Cierre (11) | Formulario de cierre → cambia estado a `closed` |
| Reapertura (12) | Formulario de reapertura → cambia estado a `reopened` |
| Impugnación (13) | Formulario de impugnación |
| Indemnización (14) | Registro de indemnización |
| Carta Propuesta (15) | Generación de carta + PDF |
| Respuesta Impug. (16) | Respuesta a impugnación |
| Prórroga (17) | Solicitud de prórroga |
| Recepción Prórroga (18) | Confirmación CMF |
| Genérica (19) | Formulario libre |
| Solicitud Despacho (20) | Solicitud de despacho → cambia estado a `dispatchment` |
| Addendum (21) | Addendum |
| Reporte Preliminar (22) | Reporte preliminar |

### Regla
```
TODO lo que se hace en un siniestro es una ACCIÓN (claim_action).
Las acciones tienen: tipo, característica (feature), plantilla, y workflow.
Las plantillas determinan qué acciones están disponibles según el estado del siniestro.
El estado `closed` del siniestro BLOQUEA toda nueva acción.
La reapertura y el cierre son acciones especiales que cambian el estado del siniestro.
Cada reapertura queda registrada como una claim_action individual (con su motivo),
mientras que la última reapertura se refleja en claims.reopened_at/by/reason.
```
