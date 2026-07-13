# Claims Hub Platform — Reglas del Proyecto

## Stack Tecnológico
- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript (estricto)
- **Estilos:** Tailwind CSS v4
- **Componentes UI:** shadcn/ui
- **Formularios:** React Hook Form + Zod
- **Gestión de Estado:** Zustand
- **Datos/Cache:** TanStack Query (React Query)
- **Backend:** Supabase (PostgreSQL + PostgREST, Auth, Storage, Edge Functions)
- **Gestor de paquetes:** pnpm
- **Deploy:** Vercel

## Arquitectura
- Estructura **feature-based**:
  - `src/app/` — rutas de Next.js App Router
  - `src/features/` — módulos de negocio (auth, dashboard, claims, inspections, etc.)
  - `src/components/` — componentes compartidos (ui, layout)
  - `src/lib/` — utilidades, configuraciones (nhost, etc.)
  - `src/hooks/` — custom hooks reutilizables
  - `src/services/` — lógica de acceso a datos (Supabase PostgREST clients)
  - `src/server/` — server actions y lógica server-only
  - `src/types/` — tipos TypeScript globales
- No usar mocks ni funcionalidades simuladas. Todo conectado a Supabase desde la primera versión.

## Convenciones de Código
- Usar **function components** en lugar de arrow functions para componentes React.
- Usar `async/await` para operaciones asíncronas.
- Preferir **Server Components** por defecto; usar `"use client"` solo cuando sea necesario (hooks del browser, eventos, etc.).
- Validar todos los inputs de usuario con **Zod**.
- Usar **React Hook Form** para todos los formularios.
- Mantener separación clara entre Server Actions y Client Components.
- Usar `@supabase/ssr` para autenticación en Next.js (cookies via middleware).

## Multi Tenant & Seguridad
- Todas las tablas deben tener `company_id` o `tenant_id`.
- Implementar **Row Level Security (RLS)** en TODAS las tablas desde el inicio.
- Nunca usar bypass de seguridad (`security definer` solo en funciones controladas).
- Usar `NHOST_ADMIN_SECRET` solo en server actions o Nhost Functions, nunca en cliente.
- Auditoría completa: registrar quién crea/modifica/elimina registros.

## Base de Datos (Supabase / PostgreSQL)
- Usar migraciones SQL manuales versionadas en `migrations/`.
- Supabase auto-detecta todas las tablas (sin "tracking" manual como Hasura).
- Configurar **Row Level Security (RLS)** en TODAS las tablas.
- Usar `SUPABASE_SERVICE_ROLE_KEY` solo en server actions o API routes, nunca en cliente.
- Tablas clave: `companies`, `tenants`, `profiles`, `roles`, `user_roles`, `claims`, `claim_participants`, `claim_actions`, `action_template`, `action_features`, `gestion_screens`, `inspection_sessions`, `inspection_checklists`, `inspection_damages`, `inspection_evidences`, `inspection_notes`, `inspection_signatures`, `inspection_reports`, `inspection_chat_messages`, `audit_logs`.

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

### Regla OBLIGATORIA de Comboboxes (Select) — Estilo Visual
```
┌─────────────────────────────────────────────────────────────────┐
│ ESTA ES LA ÚNICA REGLA DE COMBOBOXES. TODOS los Select de la     │
│ app DEBEN usar el componente Select de shadcn/ui (Base UI)       │
│ definido en src/components/ui/select.tsx.                        │
│ NUNCA usar <select> nativo de HTML. NUNCA crear selects custom.  │
└─────────────────────────────────────────────────────────────────┘

PROHIBIDO:
  ❌ <select> nativo de HTML (el dropdown usa estilo del OS)
  ❌ Crear componentes Select custom
  ❌ Modificar el estilo del SelectContent/SelectItem por página

PERMITIDO:
  ✅ Importar Select, SelectContent, SelectItem, SelectTrigger, SelectValue
     de "@/components/ui/select"
  ✅ Pasar className="app-input" al SelectTrigger para heredar el estilo
     compacto (28px, 12px, border 10px)

ESTILO DEFINITIVO del Select (definido en src/components/ui/select.tsx):

TRIGGER (SelectTrigger):
  - Altura: 28px (h-7) con className="app-input"
  - Fuente: 12px (text-xs)
  - Border-radius: 10px (rounded-lg)
  - Border: 1px solid var(--input)
  - Fondo: color-mix(var(--card) 75%, transparent) con blur(8px)
  - Al abrir: rounded-b-none + border-b-transparent (se fusiona con popup)
  - Chevron: rota 180° al abrir (feedback visual de despliegue)

POPUP (SelectContent):
  - Border-radius: 10px (mismo que trigger)
  - data-[side=bottom]: rounded-t-none (sin border-top, conecta con trigger)
  - sideOffset: 0 (sin gap, pegado al trigger)
  - align: start (alinea con borde izquierdo del trigger)
  - Border: 1px solid var(--input) (mismo que trigger)
  - Fondo: bg-card/85 backdrop-blur-xl saturate-150
  - Sombra: 0 8px 32px rgba(0,0,0,0.12) / dark: 0.4
  - Animación: fade-in + zoom-in-100 (sutil, no exagerado)

ITEMS (SelectItem):
  - Fuente: 12px (text-xs)
  - Border-radius: rounded-lg
  - Padding: py-1.5 pr-8 pl-2
  - Cursor: pointer (no default)
  - Hover: bg-primary/10 text-foreground (highlight azul sutil)
  - Focus (teclado): bg-primary/15 text-foreground
  - Dark hover: bg-white/8
  - Transition: 150ms (suave)
  - Indicador de selección: CheckIcon a la derecha

PATRÓN DE USO (buscador en listados):
  Usar la clase `.liquid-search` para inputs de búsqueda. Es un pill shape
  con Liquid Glass: blur 20px, saturate 180%, gradiente blanco 14% -> 4%,
  sombra suave, highlight interno, border-radius 999px.

  <div className="relative flex-1 min-w-[200px] max-w-sm">
    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input className="liquid-search" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
  </div>

PATRÓN DE USO (filtros en listados):
  SIEMPRE pasar la prop `items` con `{ value, label }` para que el trigger
  muestre el label correcto (Base UI muestra el raw value por defecto).

  const filterItems = [{ value: "__all", label: "Todas las compañías" }, ...(companies || []).map(c => ({ value: c.id, label: c.name }))];

  <Select value={filter || "__all"} onValueChange={(v) => setFilter(v === "__all" || v === null ? "" : v)} items={filterItems}>
    <SelectTrigger className="app-input max-w-[200px]">
      <SelectValue placeholder="Todas las compañías" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="__all">Todas las compañías</SelectItem>
      {items.map((c) => (
        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>

  Nota: Usar "__all" como valor para representar "sin filtro" (empty string).
  El onValueChange convierte "__all" o null a "".
  La prop `items` DEBE incluir el SelectItem de "__all"/__none" con su label.

PATRÓN DE USO (formularios con react-hook-form):
  Usar FormSelect (wrapper de Select con react-hook-form), que ya pasa `items` automáticamente:
  <FormSelect
    control={form.control}
    name="brokerId"
    placeholder="Seleccionar corredor..."
    className="app-input h-7"
    clearable  // solo si NO es obligatorio
    items={brokers?.map((b) => ({ value: b.id, label: b.name })) || []}
  >
    {brokers?.map((b) => (
      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
    ))}
  </FormSelect>
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

---

## 13. Storage en Cloudflare R2 — Estructura de Archivos

### Problema
Nhost Storage solo ofrece 1GB gratis y cobra egress. Los siniestros generan muchos archivos (documentos, imágenes, firmas) que necesitan almacenamiento escalable y barato.

### Solución Definitiva
Usar **Cloudflare R2** (S3-compatible, 10GB free, egress gratis) con estructura de carpetas basada en códigos.

### Variables de Entorno (`.env.local`)
```env
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=hub-inspection
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

### Estructura de Carpetas
```
configuracion/gestiones/{CODIGO_COMPUESTO}/{CODIGO_COMPUESTO}-NNNNN.docx
siniestros/{L-NNNNNNNNN}/
  documentos/{L-NNNNNNNNN}-DOC-NNNNNN.pdf
  gestiones/{L-NNNNNNNNN}-{CODIGO_COMPUESTO}-NNNN/
    {L-NNNNNNNNN}-{CODIGO_COMPUESTO}-NNNN.docx
    documentos/{L-NNNNNNNNN}-{CODIGO_COMPUESTO}-NNNN-DOC-NNNN.pdf
    imagenes/{L-NNNNNNNNN}-{CODIGO_COMPUESTO}-NNNN-EVI-NNNN.jpg
empresas/{company_id}/logos/logo.png
```

### Codificación
- **Liquidación**: `L-NNNNNNNNN` (9 dígitos, secuencia global)
- **Línea de negocios**: 1 letra en `business_lines.code_prefix` (H, C, R, V, T)
- **Característica**: 3 letras en `action_features.code` (INS, ILI, PCA, RES, etc.)
- **Compuesto**: Línea + Característica = HILI, CILI, HINS, PCA
- **Template**: 5 dígitos por código compuesto (00001)
- **Instancia de gestión**: 4 dígitos por siniestro + código compuesto (0001)

### 4 Tipos de Gestiones
| Tipo | Template | Workflow | Pantalla | Ejemplo |
|------|----------|----------|----------|---------|
| Con template + workflow | Sí | 0-3 niveles | No | ILI, PCA |
| Con pantalla, sin template | No | 0-3 niveles | Sí | INS, CIN |
| Híbrida | Sí | 0-3 niveles | Sí | RES |
| Gestión muerta | No | 0 niveles | No | IMP, RTA |

### Trazabilidad de Templates
- `template_usage_log`: registra qué template se usó en cada gestión, cuándo y quién
- `template_modification_log`: historial de modificaciones (nunca se sobreescribe, se sube nueva versión)
- Hash del archivo para detectar cambios

### Vinculación Documento ↔ Gestión
- Los documentos del siniestro viven en `siniestros/{L}/documentos/`
- Se vinculan a gestiones vía `claim_document_gestions` (sin duplicar archivos)

### Regla
```
Los archivos se renombran al código al subir (el nombre original se guarda en BD).
Si se pierde la BD, los archivos se identifican por su nombre.
Los templates NUNCA se sobreescriben — cada modificación es una nueva versión.
R2 se configura con variables de entorno R2_* en .env.local.
```

---

## 14. Layout de Formularios de Configuración — Regla de Diseño

### Problema
Los formularios de configuración apilan todas las cards verticalmente, dejando mucho espacio vacío a los lados en pantallas anchas y obligando a scroll excesivo.

### Solución Definitiva
Usar **layout de 2 columnas** en pantallas anchas (`xl`) para aprovechar el espacio horizontal.

### Patrón Obligatorio
```tsx
<form className="space-y-4">
  {/* Grid 2 columnas en xl, apila en pantallas pequeñas */}
  <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4 items-start">
    {/* Columna izquierda */}
    <div className="space-y-4">
      {/* Card 1: Configuración principal */}
      <section className="app-panel">...</section>
      {/* Card 2: Workflow / configuración secundaria */}
      <section className="app-panel">...</section>
    </div>
    {/* Columna derecha */}
    <div>
      {/* Card 3: Plantillas / datos relacionados */}
      <section className="app-panel">...</section>
    </div>
  </div>
  {/* Footer full-width con botones */}
  <div className="flex items-center justify-end gap-2 pt-2">
    <button className="btn-cancel">Cancelar</button>
    <button className="btn-save">Guardar</button>
  </div>
</form>
```

### Reglas de Distribución
```
1. Columna izquierda: configuración principal + workflow
2. Columna derecha: datos relacionados (plantillas, asociaciones, etc.)
3. Footer: SIEMPRE full-width debajo del grid, nunca dentro de una columna
4. items-start: para que las columnas no se estiren verticalmente
5. En pantallas pequeñas (< xl): todo se apila verticalmente automáticamente
```

### Densidad de Campos dentro de Cards
```
1. Usar grid de 3 columnas (no 6) para campos de formulario dentro de cards
2. Agrupar campos relacionados en filas lógicas:
   - Fila 1: identificación (código, nombre, tipo)
   - Fila 2: clasificación (característica, línea, despacho)
   - Fila 3: descripción (full-width)
3. Toggles + chips: usar grid [auto_1fr] para que el toggle ocupe lo mínimo
4. Textareas: min-h-[50px] (no 60px+) para reducir altura
5. Labels: text-[10px] para compactar
6. Inputs: h-7 (no h-9) dentro de cards de configuración
```

### Estado Vacío en Columna Derecha
```
Si la columna derecha depende de que el registro exista (ej: plantillas de una gestión
que aún no se ha guardado), mostrar un panel con mensaje placeholder:
  "Guarda el registro primero para configurar [X]."
NUNCA dejar la columna derecha vacía o sin renderizar.
```

### Regla
```
TODO formulario de configuración con 2+ cards DEBE usar layout de 2 columnas en xl.
Los campos dentro de cards DEBEN usar grid de 3 columnas (no 6).
El footer con botones SIEMPRE va full-width debajo del grid.
NUNCA dejar columnas vacías — usar estado vacío con mensaje.
```

---

## 15. Grillas de Listado — Regla de Diseño

### Problema
Las grillas siempre están desordenadas, los comboboxes no tienen orden, y el usuario pierde tiempo buscando visualmente.

### Solución Definitiva
Toda grilla de listado DEBE tener: filtros, ordenamiento por columna, orden alfabético por defecto, y paginación.

### Componentes Reutilizables
- `src/hooks/use-table-sort.ts` — hook con accessors para campos anidados
- `src/components/ui/sortable-th.tsx` — header con indicador visual (▲▼)

### Patrón Obligatorio — Ejemplo: Grilla de Gestiones

#### 1. Estado de filtros + sort
```tsx
const [search, setSearch] = useState("");
const [filterFeature, setFilterFeature] = useState("");
const [filterLine, setFilterLine] = useState("");

// Filtro combinado
const filtered = data?.filter((t) => {
  const matchText = [t.name, t.code].join(" ").toLowerCase().includes(search.toLowerCase());
  const matchFeature = !filterFeature || t.action_features_id === filterFeature;
  const matchLine = !filterLine || t.line_business_id === filterLine;
  return matchText && matchFeature && matchLine;
});

// Sort con accessors (soporta campos anidados)
const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
  name: (t) => t.name,
  code: (t) => (t.line_business?.code_prefix || "") + (t.action_feature?.code || ""),
  action_type: (t) => t.action_type?.name || "",
  days_to_issue: (t) => t.days_to_issue,
}, "name"); // "name" = orden por defecto

const { paginatedData, ... } = usePagination(sorted);
```

#### 2. Toolbar con filtros compactos en una fila
```tsx
<div className="app-toolbar">
  <div className="flex items-center gap-3 flex-wrap">
    <Search className="h-4 w-4 text-muted-foreground" />
    <Input placeholder="Buscar..." className="h-9 max-w-[200px]" />
    <Select> {/* Filtro 1 */} </Select>
    <Select> {/* Filtro 2 */} </Select>
    {(filter1 || filter2 || search) && (
      <Button variant="ghost" size="sm" onClick={clearAll}>
        <X /> Limpiar
      </Button>
    )}
  </div>
  <Button className="btn-create btn-sm"><Plus /> Agregar</Button>
</div>
```

#### 3. Tabla con SortableTh en todas las columnas ordenables
```tsx
<table className="app-data-table">
  <thead><tr>
    <th className="w-10"></th> {/* estado (no ordenable) */}
    <SortableTh sortKey="code" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Código</SortableTh>
    <SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Nombre</SortableTh>
    <SortableTh sortKey="action_type" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Tipo</SortableTh>
    <th className="w-[80px]"></th> {/* acciones (no ordenable) */}
  </tr></thead>
  <tbody>
    {isLoading ? <tr><td colSpan={N}>Cargando...</td></tr>
    : paginatedData.length === 0 ? <tr><td colSpan={N}>No se encontraron registros.</td></tr>
    : paginatedData.map((t) => ( <tr>...</tr> ))}
  </tbody>
</table>
```

### Reglas

```
1. ORDEN POR DEFECTO: Toda grilla DEBE ordenar por "name" asc por defecto.
   Si no tiene campo "name", ordenar por el campo principal de identificación.

2. SORT EN TODAS LAS COLUMNAS: Toda columna de datos DEBE ser ordenable
   con <SortableTh>. Solo se exceptúan: columna de estado (bolita),
   columna de acciones (botones), y columnas calculadas complejas.

3. COMPORTAMIENTO DE SORT (3 estados cíclicos):
   - Click 1: ascendente (▲)
   - Click 2: descendente (▼)
   - Click 3: sin orden (icono neutral) — vuelve al orden por defecto

4. FILTROS: Toda grilla con >10 registros DEBE tener al menos:
   - Búsqueda por texto (Input)
   - Filtro por categoría padre (Select) si aplica
   - Botón "Limpiar" visible solo cuando hay filtros activos

5. ORDEN DE COMBOS: Todos los <Select> y comboboxes DEBEN recibir datos
   ordenados alfabéticamente por nombre desde la query (order_by: { name: asc }).
   NUNCA ordenar por sort_order en catálogos de selección.

6. PAGINACIÓN: Toda grilla con >20 registros DEBE paginar.
   <Pagination> va arriba y abajo de la tabla.

7. ESTADOS DE LA GRILLA (3 estados obligatorios):
   - isLoading: "Cargando..."
   - error: "Error: {mensaje}"
   - empty: "No se encontraron registros."
   Todos con colSpan={N} y text-center text-muted-foreground py-4.

8. ACCIONES POR FILA: Botones icon-only (Pencil, Trash2) en columna
   fija w-[80px], alineados a la derecha con app-row-actions.

9. COLUMNAS DE CÓDIGO: Usar font-mono text-[12px] para códigos.
   Mostrar código compuesto si existe (ej: prefijo + característica).

10. ANCHO DE COLUMNS: Solo columnas especiales tienen w-* fijo:
    - Estado: w-10
    - Acciones: w-[80px]
    - Resto: automático
```

### Hook useTableSort — API
```tsx
const { sorted, sortKey, sortDir, toggleSort } = useTableSort(
  data,                    // T[] | undefined
  accessors,               // Record<string, (item: T) => unknown>
  initialKey?,             // string | null (default: "name")
  initialDirection?        // SortDirection (default: "asc")
);
```

### Regla
```
TODA grilla de listado DEBE usar useTableSort + SortableTh.
TODA query de catálogo DEBE ordenar por name: asc (excepto claim_status).
TODA grilla con >10 registros DEBE tener filtros + botón Limpiar.
EL orden por defecto SIEMPRE es name asc.
```

---

## 16. Centralización de Estilos — Regla Absoluta

### Problema
Los estilos están repartidos entre componentes shadcn (`.tsx`), hojas CSS, y clases inline `className`. Un cambio visual requiere revisar todas las páginas y componentes individualmente.

### Solución Definitiva
**TODA regla visual va en `src/app/styles/*.css`.** Los componentes `.tsx` solo definen estructura y layout mínimo.

### Estructura de Hojas de Estilo
```
src/app/styles/
├── buttons.css      → botones (.btn-save, .btn-cancel, .btn-create, etc.)
├── components.css   → layout (.app-page, .app-panel, .app-data-table, etc.)
├── forms.css        → inputs, selects, textareas (.app-input, [data-slot])
├── modals.css       → modales (.modal-body, .modal-footer, etc.)
└── animations.css   → animaciones
```

Todas se importan en `src/app/globals.css`:
```css
@import "./styles/buttons.css";
@import "./styles/modals.css";
@import "./styles/components.css";
@import "./styles/animations.css";
@import "./styles/forms.css";
```

### Regla Absoluta
```
1. NUNCA poner estilos visuales (fondo, color, borde, sombra, hover, focus,
   disabled) en los componentes .tsx. Solo layout (flex, grid, gap, w-, h-).

2. Los componentes shadcn (input.tsx, select.tsx, textarea.tsx, etc.) solo
   definen estructura. El estilo visual se aplica via [data-slot] en forms.css.

3. Los selectores [data-slot] son la forma canónica de estilizar componentes
   shadcn desde CSS centralizado:
     [data-slot="input"] { background: var(--card) !important; }
     [data-slot="select-trigger"] { background: var(--card) !important; }
     [data-slot="textarea"] { background: var(--card) !important; }

4. La clase .app-input es un override compacto (28px, 12px, 10px radius)
   para formularios densos. Se aplica solo donde se necesita.

5. Si necesitas un estilo nuevo, lo agregas a la hoja CSS correspondiente,
   NUNCA al componente .tsx.

6. Los componentes .tsx pueden tener className para layout (flex, grid,
   gap, w-, h-, max-w-) pero NUNCA para bg-, text-, border-, shadow-.
   Excepción: clases semánticas (.btn-save, .app-input, .app-panel).
```

### Ejemplo Correcto
```tsx
// ✅ BIEN: input.tsx solo tiene layout
className={cn(
  "h-8 w-full min-w-0 rounded-lg border border-input px-2.5 py-1 ...",
  className
)}

// ❌ MAL: input.tsx con estilos visuales inline
className={cn(
  "h-8 w-full bg-card text-foreground border-input dark:bg-card ...",
  className
)}
```

```css
/* ✅ BIEN: el fondo, color, focus van en forms.css */
[data-slot="input"] {
  background: var(--card) !important;
  color: var(--foreground) !important;
}
[data-slot="input"]:focus-visible {
  border-color: #0095DA !important;
  box-shadow: 0 0 0 3px rgba(0, 149, 218, 0.12) !important;
}
```

### Regla
```
TODA regla visual va en src/app/styles/*.css.
LOS componentes .tsx SOLO definen layout (flex, grid, gap, w-, h-).
LOS selectores [data-slot] estilizan componentes shadcn desde CSS.
NUNCA poner bg-, text-, border-, shadow- en className de componentes.
```

---

## 17. Sistema de Permisos — Documentación Completa y Definitiva

### Visión General

El sistema de permisos tiene **3 niveles de seguridad** que se aplican en cascada.
Ningún nivel por sí solo es suficiente; los tres trabajan juntos para garantizar
que un usuario no pueda hacer algo que no debe, **incluso si manipula el DOM
con DevTools del navegador**.

```
┌─────────────────────────────────────────────────────────────────┐
│ NIVEL 1: Permisos de Sección (user_type_permissions)            │
│ ¿El rol del usuario puede acceder al módulo?                    │
│ Ej: adjuster puede "view" claims pero no "edit" catalogos       │
├─────────────────────────────────────────────────────────────────┤
│ NIVEL 2: Permisos de Campo (field_permissions)                  │
│ ¿El rol del usuario puede editar este campo específico?         │
│ Ej: adjuster puede editar "name" pero no "is_blocker"           │
├─────────────────────────────────────────────────────────────────┤
│ NIVEL 3: Campos Inmutables (código del server action)           │
│ ¿Este campo NUNCA se puede cambiar después de crear?            │
│ Ej: action_features_id y line_business_id en gestiones          │
│         (nadie puede cambiarlos, ni siquiera internal)          │
└─────────────────────────────────────────────────────────────────┘
```

### Regla Absoluta
```
NUNCA confiar en el cliente para seguridad. El UI (disabled, hidden)
es solo para UX. Toda validación de seguridad DEBE hacerse en el
servidor via Server Actions ("use server").

Un usuario puede:
  - Habilitar campos disabled con DevTools
  - Llamar mutations directamente con curl/fetch
  - Inyectar campos extra en el payload

El servidor DEBE:
  1. Verificar permisos del rol (requirePermission)
  2. Validar campos inmutables (validateImmutableFields)
  3. Filtrar campos permitidos (filterAllowedFields)
  4. Filtrar por permisos dinámicos del rol (filterFieldsByPermission)
  5. Validar reglas de negocio (validateBusinessRules)
```

---

### Nivel 1 — Permisos de Sección (`user_type_permissions`)

#### Tabla
```sql
user_type_permissions (
  id          UUID PRIMARY KEY,
  user_type   TEXT NOT NULL,  -- 'internal' | 'adjuster' | 'inspector' | 'client_operator'
  section     TEXT NOT NULL,  -- 'dashboard' | 'claims' | 'catalogos' | 'catalogos_gestiones' | ...
  can_view    BOOLEAN DEFAULT false,
  can_edit    BOOLEAN DEFAULT false,
  can_create  BOOLEAN DEFAULT false,
  can_delete  BOOLEAN DEFAULT false,
  UNIQUE(user_type, section)
)
```

#### Migración
- `migrations/69_user_type_permissions.sql` — tabla + seed inicial
- `migrations/71_subsection_permissions.sql` — sub-secciones (claims_detalle, etc.)
- `migrations/76_gestiones_permissions.sql` — sección "gestiones"

#### Secciones del Sistema
| Sección | Descripción | Sub-secciones |
|---------|-------------|---------------|
| `dashboard` | Dashboard principal | — |
| `claims` | Siniestros | `claims_listado`, `claims_detalle`, `claims_participantes`, `claims_incidente`, `claims_gestiones`, `claims_documentos`, `claims_log` |
| `inspecciones` | Inspecciones | `inspecciones_listado`, `inspecciones_detalle`, `inspecciones_acta`, `inspecciones_danos`, `inspecciones_evidencias`, `inspecciones_croquis`, `inspecciones_firmas`, `inspecciones_informe` |
| `agenda` | Agenda | — |
| `catalogos` | Catálogos | `catalogos_gestiones`, `catalogos_ubicaciones`, `catalogos_causas`, `catalogos_tipos_siniestros`, `catalogos_eventos`, `catalogos_companias`, `catalogos_corredores`, `catalogos_asesores`, `catalogos_lineas_negocio`, `catalogos_productos`, `catalogos_tipos_polizas`, `catalogos_parentescos`, `catalogos_tipos_documentos`, `catalogos_antiguedades`, `catalogos_clasificacion_bien`, `catalogos_clasificacion_danos`, `catalogos_destinos_vivienda` |
| `catalogos_inspeccion` | Catálogos de Inspección | `catalogos_inspeccion_muros`, `catalogos_inspeccion_cubierta`, `catalogos_inspeccion_pavimentos`, `catalogos_inspeccion_cielos`, `catalogos_inspeccion_cierre_perimetral`, `catalogos_inspeccion_terminaciones_exteriores`, `catalogos_inspeccion_terminaciones_interiores`, `catalogos_inspeccion_relacion_asegurado`, `catalogos_inspeccion_categorias_evidencia` |
| `operaciones` | Operaciones | `operaciones_carga_siniestros`, `operaciones_carga_catalogos`, `operaciones_inhabilitar`, `operaciones_reabrir` |
| `administracion` | Administración | — |
| `users` | Usuarios | — |
| `companies` | Empresas | — |
| `configuracion` | Configuración | — |

#### Resolución de Sub-secciones (Fallback al Padre)
```
Si se consulta "catalogos_causas" y no existe fila para esa sub-sección,
se hace fallback al padre "catalogos" y se usan sus permisos.

Orden de fallback:
  1. Buscar permiso exacto de la sub-sección
  2. Si no existe, buscar el primer prefijo: section.split("_")[0]
     Ej: "catalogos_inspeccion_muros" → "catalogos"
  3. Si no existe, buscar dos prefijos: section.split("_").slice(0,2).join("_")
     Ej: "catalogos_inspeccion_muros" → "catalogos_inspeccion"
  4. Si no existe, deny (false)
```

#### Roles
| Rol | Descripción | Acceso por defecto |
|-----|-------------|-------------------|
| `internal` | Usuarios internos del sistema | Todo (view + edit + create + delete en casi todo) |
| `adjuster` | Liquidadores asociados a clientes | Claims (view + edit), Inspecciones (view), Agenda (view) |
| `inspector` | Inspectores asociados a clientes | Claims (view), Inspecciones (view + edit + create), Agenda (view) |
| `client_operator` | Operativos del cliente | Claims (view), Inspecciones (view), Agenda (view) — solo lectura |

#### Archivos Clave
| Archivo | Propósito |
|---------|-----------|
| `src/services/permissions.ts` | Service cliente: `getAllPermissions`, `updatePermission`, `sectionLabels`, `sectionActions`, `sectionSubPages`, `subSectionActions` |
| `src/hooks/use-permissions.ts` | Hook cliente: `canView`, `canEdit`, `canCreate`, `canDelete` con fallback al padre |
| `src/hooks/use-auth.ts` | Carga permisos del usuario al hacer login (los guarda en React Query) |
| `src/server/lib/session.ts` | Helper server-side: `getServerUser`, `getServerPermissions`, `checkPermission`, `requirePermission` |
| `src/app/dashboard/permisos/page.tsx` | UI de configuración de permisos (tabla por rol × sección con sub-páginas expandibles) |

---

### Nivel 2 — Permisos de Campo (`field_permissions`)

#### Tabla
```sql
field_permissions (
  id          UUID PRIMARY KEY,
  user_type   TEXT NOT NULL,  -- 'internal' | 'adjuster' | 'inspector' | 'client_operator'
  section     TEXT NOT NULL,  -- ej: 'catalogos_gestiones'
  field_name  TEXT NOT NULL,  -- ej: 'is_blocker'
  can_edit    BOOLEAN DEFAULT true,
  UNIQUE(user_type, section, field_name)
)
```

#### Regla de Default
```
Si NO existe fila para (user_type, section, field_name), el campo
es EDITABLE por defecto. Solo se insertan filas para RESTRINGIR.

Esto significa que:
  - internal no tiene filas → puede editar todo
  - adjuster tiene filas con can_edit=false → no puede editar esos campos
  - Si se agrega un campo nuevo a una entidad, es editable por todos
    hasta que alguien lo restrinja explícitamente
```

#### Migración
- `migrations/89_field_permissions.sql` — tabla + seed inicial

#### Seed Inicial (Gestiones)
Para `catalogos_gestiones`, los roles `adjuster`, `inspector` y `client_operator`
tienen restringidos los campos estructurales:
- `is_blocker` — no pueden cambiar si una gestión es bloqueante
- `review_levels` — no pueden cambiar los niveles de revisión
- `is_dispatch_applicable` — no pueden cambiar el flag de despacho
- `issuer_roles` — no pueden cambiar los roles del emisor
- `reviewer_roles` — no pueden cambiar los roles del revisor
- `approver_roles` — no pueden cambiar los roles del aprobador
- `is_active` — no pueden desactivar gestiones

Sí pueden editar: `name`, `description`, `code`, `days_to_*`, `days_to_alert_*`.

#### Catálogo de Campos
El catálogo de campos configurables por entidad está en:
`src/lib/field-catalog.ts`

```ts
export const fieldCatalog: EntityFieldCatalog[] = [
  {
    section: "catalogos_gestiones",
    label: "Gestiones",
    fields: [
      { name: "name", label: "Nombre", group: "Básico" },
      { name: "is_blocker", label: "Es Bloqueante", group: "Estructura" },
      { name: "review_levels", label: "Niveles de Revisión", group: "Estructura" },
      { name: "days_to_issue", label: "Días para Emitir", group: "Plazos" },
      { name: "issuer_roles", label: "Roles Emisor", group: "Roles" },
      // ... etc
    ],
  },
];
```

#### Archivos Clave
| Archivo | Propósito |
|---------|-----------|
| `src/lib/field-catalog.ts` | Catálogo de campos por entidad (labels, grupos) |
| `src/services/field-permissions.ts` | Service cliente: `getAllFieldPermissions`, `getFieldPermissions`, `upsertFieldPermission`, `deleteFieldPermission` |
| `src/server/lib/field-permissions.ts` | Helper server-side: `getEditableFields`, `filterFieldsByPermission`, `isFieldEditable` |
| `src/app/dashboard/permisos/page.tsx` | UI: expandir sub-página → botón "Campos" → toggle por campo |

#### UI de Configuración
1. Ir a **Administración → Permisos**
2. Expandir el módulo (ej: "Catálogos")
3. Ver las sub-páginas (ej: "Gestiones")
4. Al lado de cada sub-página con campos configurables, hay un botón **"Campos"** con ícono de engranaje
5. Al clic, se expande la lista de campos agrupados por categoría
6. Cada campo tiene un toggle: verde = editable, gris = restringido
7. Los cambios se guardan inmediatamente (upsert en `field_permissions`)

---

### Nivel 3 — Campos Inmutables (Server Action)

#### Concepto
Algunos campos **NUNCA** pueden cambiarse después de crear el registro,
sin importar el rol del usuario. Esto se define en el código del server action
(hardcoded, no configurable desde UI).

#### Ejemplo: Gestiones
```ts
// src/server/actions/gestiones.ts
const IMMUTABLE_ON_UPDATE = [
  "action_features_id",   // la característica define toda la estructura
  "line_business_id",     // la línea de negocio afecta el código
] as const;
```

#### Validación
```ts
// 1. Obtener registro actual de la BD
const current = await getCurrentTemplate(id);

// 2. Comparar campos inmutables
validateImmutableFields(current, input, IMMUTABLE_ON_UPDATE);
// → Si action_features_id cambió, lanza:
//   "No se pueden modificar campos inmutables: action_features_id"
```

#### Diferencia con Field Permissions
| | Inmutable | Field Permission |
|---|-----------|------------------|
| **Quién** | Nadie (ni internal) | Depende del rol |
| **Cuándo** | Solo en update (al crear sí se puede) | Solo en update |
| **Dónde se configura** | Código del server action | Tabla BD + UI |
| **Propósito** | Integridad referencial | Seguridad por rol |

---

### Server Actions — Patrón Obligatorio

Todo módulo que permita crear/editar/eliminar registros DEBE usar Server Actions
con esta estructura:

```ts
// src/server/actions/<modulo>.ts
"use server";

import { graphqlRequest } from "@/lib/nhost/graphql";
import { logger } from "@/lib/logger";
import { requirePermission, getServerUser } from "@/server/lib/session";
import {
  validateImmutableFields,
  filterAllowedFields,
} from "@/server/lib/immutable-fields";
import { filterFieldsByPermission } from "@/server/lib/field-permissions";

// ─── Configuración de campos ───
const IMMUTABLE_ON_UPDATE = ["campo1", "campo2"] as const;
const ALLOWED_ON_UPDATE = ["campo3", "campo4", ...] as const;
const ALLOWED_ON_CREATE = ["campo1", "campo2", "campo3", ...] as const;
const SECTION = "catalogos_gestiones"; // sección para field permissions

// ─── Create ───
export async function createX(input: Record<string, unknown>) {
  try {
    await requirePermission("catalogos", "create");
    const filtered = filterAllowedFields(input, ALLOWED_ON_CREATE as string[]);
    // validar reglas de negocio
    // graphql mutation insert
  } catch (err) {
    logger.error("createX falló", err as Error, { ... });
    throw err;
  }
}

// ─── Update ───
export async function updateX(id: string, input: Record<string, unknown>) {
  try {
    // 1. Permiso de sección
    await requirePermission("catalogos", "edit");

    // 2. Obtener registro actual
    const current = await getCurrentX(id);

    // 3. Validar inmutables
    validateImmutableFields(current, input, IMMUTABLE_ON_UPDATE as string[]);

    // 4. Filtrar por lista estática
    const staticFiltered = filterAllowedFields(input, ALLOWED_ON_UPDATE as string[]);

    // 5. Filtrar por permisos dinámicos del rol
    const user = await getServerUser();
    const filtered = await filterFieldsByPermission(
      staticFiltered,
      ALLOWED_ON_UPDATE as string[],
      user.role,
      SECTION
    );

    // 6. Validar reglas de negocio
    // 7. graphql mutation update
  } catch (err) {
    logger.error("updateX falló", err as Error, { ... });
    throw err;
  }
}

// ─── Delete (soft) ───
export async function deleteX(id: string) {
  try {
    await requirePermission("catalogos", "delete");
    // marcar is_active = false o eliminar
  } catch (err) {
    logger.error("deleteX falló", err as Error, { ... });
    throw err;
  }
}
```

### Regla
```
TODO módulo que permita crear/editar/eliminar DEBE:
  1. Usar Server Actions ("use server") — NUNCA services del cliente
  2. Llamar requirePermission() al inicio de cada acción
  3. Validar campos inmutables con validateImmutableFields()
  4. Filtrar campos con filterAllowedFields()
  5. Filtrar por permisos dinámicos con filterFieldsByPermission()
  6. Loguear errores con logger.error()
  7. Usar try/catch y relanzar el error

NUNCA hacer mutations directamente desde el cliente (src/services/).
Los services del cliente solo se usan para QUERIES (lectura).
```

---

## Regla de Soft-Delete: Desactivar vs Eliminar

### Principio Fundamental
**NUNCA se elimina (DELETE) un registro que ha sido utilizado en el sistema.**
En su lugar, se **desactiva** (`is_active = false`).

### Comportamiento
1. **Botón "Eliminar" → cambia a "Desactivar"** cuando el registro está referenciado
   en algún siniestro, workflow, gestión, o cualquier otra entidad.
2. **Al desactivar**: el registro deja de estar disponible para NUEVAS asignaciones
   (no aparece en dropdowns, selects, ni formularios de creación).
3. **Datos existentes**: todo lo relacionado al registro desactivado SIGUE mostrándose
   normalmente (siniestros, gestiones, workflows, detalles, etc.).
4. **Reactivación**: el usuario puede reactivar un registro desactivado en cualquier momento.

### Ejemplo
```
Eventos: "Normal" y "Terremoto 2026"
- Hoy se desactiva "Terremoto 2026"
- NO se puede: crear workflow con ese evento, asignarlo a nuevos siniestros, etc.
- SÍ se puede: ver siniestros existentes con ese evento, ver gestiones, ver reportes
- El evento desactivado NO aparece en dropdowns de creación
- El evento desactivado SÍ aparece en detalles/visualizaciones de datos existentes
```

### Implementación Técnica
- **Todas las tablas de catálogo** deben tener columna `is_active BOOLEAN DEFAULT true`.
- **DELETE en UI** → siempre hace `UPDATE is_active = false` (soft-delete).
- **Queries para dropdowns/selects** → filtrar `.eq("is_active", true)`.
- **Queries para detalles/listados de datos existentes** → NO filtrar por `is_active`
  (mostrar tanto activos como inactivos para no perder información).
- **Páginas de administración** (gestiones, tipos, características) → muestran
  activos e inactivos con indicador visual (punto verde/gris) para permitir reactivación.

### Tablas que DEBEN cumplir esta regla
events, countries, business_lines, insurance_companies, brokers, advisors,
claim_causes, claim_types, insurance_products, regions, cities, communes,
property_classifications, damage_classifications, policy_types, housing_destinations,
building_ages, relationships, action_template, action_features, characteristic,
gestion_screens, lookup_catalog (action_type, claim_status, action_status, etc.),
workflow_configs, action_template_dependencies.

### Regla
```
1. NUNCA usar DELETE SQL en tablas de catálogo referenciadas.
2. Siempre usar UPDATE is_active = false.
3. Los dropdowns SIEMPRE filtran is_active = true.
4. Los detalles de siniestros/gestiones NUNCA filtran is_active
   (muestran el nombre aunque esté desactivado).
5. Las páginas de administración muestran activos e inactivos.
```

---

## Regla de Diseño: Glassmorphism en Páginas de Catálogo

### Principio
Todas las páginas de catálogo y configuración (workflows, dependencias, gestiones, etc.)
DEBEN usar el estilo **glassmorphism** para headers, cards y contenedores principales.

### Implementación
```tsx
// Header glassmorphism (patrón obligatorio)
<div className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/5
                bg-white/5 dark:bg-white/[0.02] backdrop-blur-xl
                shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]
                px-5 py-4">
  {/* Blurs decorativos */}
  <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
  <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-sky-500/10 blur-3xl" />

  <div className="relative flex items-center gap-3">
    {/* Icono con gradiente */}
    <div className="flex h-10 w-10 items-center justify-center rounded-xl
                    bg-linear-to-br from-violet-500/20 to-sky-500/20 backdrop-blur-sm
                    border border-white/10">
      <Icon className="h-5 w-5 text-violet-400" />
    </div>
    {/* Contenido */}
  </div>
</div>

// Card glassmorphism
<div className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/5
                bg-white/5 dark:bg-white/[0.02] backdrop-blur-xl
                shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.2)]
                p-4">
  <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-violet-500/5 blur-2xl" />
  {/* Contenido */}
</div>

// Modal glassmorphism
<DialogContent className="modal-sm !bg-white/80 dark:!bg-zinc-900/80 !backdrop-blur-xl
                          !border-white/20 dark:!border-white/10 !shadow-2xl">
```

### Regla
```
1. Headers de páginas de catálogo: SIEMPRE glassmorphism con blurs decorativos.
2. Cards contenedoras: glassmorphism con border sutil y shadow suave.
3. Modales: usar !bg-white/80 dark:!bg-zinc-900/80 + !backdrop-blur-xl.
4. Blurs decorativos: bg-violet-500/10 y bg-sky-500/10, SIEMPRE pointer-events-none.
5. Iconos header: gradiente from-violet-500/20 to-sky-500/20 con border-white/10.
6. NUNCA usar fondos sólidos opacos en páginas de catálogo. Siempre translucidos.
```

---

### Cliente — Cómo deshabilitar campos según permisos

En el page.tsx del formulario:

```tsx
import { useAuth } from "@/hooks/use-auth";
import { getFieldPermissions, type FieldPermission } from "@/services/field-permissions";

// 1. Obtener el rol del usuario
const { profile } = useAuth();

// 2. Consultar field permissions para esta sección
const { data: fieldPerms } = useQuery<FieldPermission[]>({
  queryKey: ["field-permissions", profile?.role, "catalogos_gestiones"],
  queryFn: () => getFieldPermissions(profile!.role, "catalogos_gestiones"),
  enabled: !!profile?.role,
});

// 3. Helper: ¿este campo está restringido?
const fieldRestricted = new Set(
  (fieldPerms ?? []).filter(p => !p.can_edit).map(p => p.field_name)
);
const isFieldDisabled = (fieldName: string): boolean => {
  if (!editingId) return false; // creando: todo habilitado
  return fieldRestricted.has(fieldName);
};

// 4. Usar en los inputs
<Input
  value={form.name}
  onChange={...}
  disabled={isFieldDisabled("name")}
/>
<Checkbox
  checked={form.is_blocker}
  disabled={isFieldDisabled("is_blocker")}
/>
```

### Regla
```
LOS campos del formulario DEBEN usar isFieldDisabled() para deshabilitarse
según los permisos del rol. Esto es UX, no seguridad — la seguridad real
está en el server action que filtra los campos antes de llegar a la BD.

Al CREAR (sin editingId), todos los campos están habilitados.
Al EDITAR (con editingId), los campos restringidos se deshabilitan.
Los campos inmutables (action_features_id, line_business_id) se
deshabilitan siempre al editar (marcados con "(inmutable)" en el label).
```

---

### Cómo replicar el sistema para un nuevo módulo

#### Paso a paso (ej: "Causas")

1. **Migración**: Si la sección no existe, agregarla a `user_type_permissions`:
   ```sql
   INSERT INTO user_type_permissions (user_type, section, can_view, can_edit, can_create, can_delete) VALUES
     ('internal', 'catalogos_causas', true, true, true, true),
     ('adjuster', 'catalogos_causas', false, false, false, false),
     ...
   ON CONFLICT (user_type, section) DO NOTHING;
   ```

2. **Sub-página**: Agregar a `sectionSubPages` en `src/services/permissions.ts`:
   ```ts
   // Ya existe si es sub-página de catalogos:
   { section: "catalogos_causas", label: "Causas" },
   ```

3. **Catálogo de campos**: Agregar a `fieldCatalog` en `src/lib/field-catalog.ts`:
   ```ts
   {
     section: "catalogos_causas",
     label: "Causas",
     fields: [
       { name: "name", label: "Nombre", group: "Básico" },
       { name: "code", label: "Código", group: "Básico" },
       { name: "is_active", label: "Activo", group: "Básico" },
     ],
   }
   ```

4. **Server Action**: Crear `src/server/actions/causas.ts`:
   ```ts
   "use server";
   import { requirePermission, getServerUser } from "@/server/lib/session";
   import { validateImmutableFields, filterAllowedFields } from "@/server/lib/immutable-fields";
   import { filterFieldsByPermission } from "@/server/lib/field-permissions";

   const IMMUTABLE_ON_UPDATE: string[] = []; // causas no tiene inmutables
   const ALLOWED_ON_UPDATE = ["name", "code", "is_active"] as const;
   const ALLOWED_ON_CREATE = ["name", "code"] as const;
   const SECTION = "catalogos_causas";

   export async function createCausa(input) { ... }
   export async function updateCausa(id, input) { ... }
   export async function deleteCausa(id) { ... }
   ```

5. **Page.tsx**: Reemplazar imports de services por server actions:
   ```ts
   // ANTES (inseguro):
   import { createCausa } from "@/services/causas";
   // AHORA (seguro):
   import { createCausa } from "@/server/actions/causas";
   ```

6. **Form**: Agregar `isFieldDisabled()` a los campos del formulario.

7. **Hasura**: Hacer track de la tabla si es nueva (`pnpm tsx scripts/hasura-track-tables.ts`).

### Regla
```
TODO nuevo módulo que permita editar datos DEBE implementar los 3 niveles
de permisos desde el inicio. No se puede agregar seguridad después como
un "patch" — debe ser parte del diseño desde el primer commit.
```

---

### Archivos del Sistema de Permisos — Mapa Completo

```
src/
├── lib/
│   └── field-catalog.ts                    # Catálogo de campos por entidad
├── services/
│   ├── permissions.ts                      # Service cliente: permisos de sección
│   └── field-permissions.ts                # Service cliente: permisos de campo
├── hooks/
│   ├── use-auth.ts                         # Carga perfil + permisos al login
│   └── use-permissions.ts                  # Hook: canView, canEdit, canCreate, canDelete
├── server/
│   ├── lib/
│   │   ├── session.ts                      # Server: getServerUser, requirePermission
│   │   ├── immutable-fields.ts             # Server: validateImmutableFields, filterAllowedFields
│   │   └── field-permissions.ts            # Server: getEditableFields, filterFieldsByPermission
│   └── actions/
│       └── gestiones.ts                    # Server action: createGestion, updateGestion, deleteGestion
├── app/dashboard/
│   ├── permisos/page.tsx                   # UI: configuración de permisos (sección + campo)
│   └── catalogos/gestiones/gestiones/
│       └── page.tsx                        # UI: form con isFieldDisabled()
└── types/
    └── index.ts                            # Tipos: UserRole, UserTypePermission

migrations/
├── 69_user_type_permissions.sql            # Tabla user_type_permissions + seed
├── 71_subsection_permissions.sql           # Sub-secciones (claims_detalle, etc.)
├── 76_gestiones_permissions.sql            # Sección "gestiones"
└── 89_field_permissions.sql                # Tabla field_permissions + seed
```

---

### Hasura Permissions (Capa Adicional)

Además del sistema de permisos de la aplicación, Hasura tiene su propio
sistema de permisos que actúa como última línea de defensa a nivel BD.

#### Configuración
1. Ir a **Hasura Console → Data → [Tabla] → Permissions**
2. Configurar por rol (`user`, `admin`, etc.)
3. Las mutations hechas desde Server Actions usan el JWT del usuario,
   por lo que Hasura Permissions se aplican automáticamente

#### Regla
```
Las Hasura Permissions son la ÚLTIMA línea de defensa. No se debe
confiar solo en ellas. El control de acceso real se hace en los
Server Actions de la aplicación.

Si alguien bypassa el server action y llama GraphQL directamente,
Hasura Permissions bloquean según el rol del JWT.
```

---

## 18. Migración a Supabase — Decisión Definitiva

### Problema
Hasura (Nhost) presentaba inestabilidad persistente (502/503 intermitentes) que afectaba el desarrollo y la experiencia de usuario.

### Solución Definitiva
- **Backend:** Supabase (PostgreSQL + PostgREST + Auth + Storage + Edge Functions)
- **Data access:** `supabase.from('table').select()` (PostgREST REST API)
- **Auth:** `@supabase/ssr` con cookies via middleware
- **Storage:** Cloudflare R2 para archivos + Supabase Storage para archivos temporales
- **RLS:** Policies en todas las tablas con `TO public` (no `TO authenticated`)

### Regla
```
TODO el data access usa Supabase PostgREST. NO usar GraphQL.
Las queries con embeddings usan FK hints: alias:table!fk_constraint_name(fields)
El service role key SOLO se usa en server-side (API routes, server actions).
```

---

## 19. Dos Tipos de Pantallas — Decisión Definitiva

### Problema
El sistema de pantallas dinámicas (gestion-screens) no soporta tabs, wizard steps, upload de archivos, canvas de firmas, chat en tiempo real ni videollamada. La inspección necesita todos estos componentes especializados.

### Solución Definitiva
El sistema tiene **dos tipos de pantallas** que coexisten:

#### 1. Pantallas Dinámicas (Gestion Screens)
- **Propósito:** Formularios configurables para gestiones de siniestros
- **Configuración:** `form_schema` JSONB + constructor visual drag-and-drop
- **Tipos de campo:** text, textarea, number, date, select, checkbox, table, section
- **Entidades:** 13 simples (read-only del claim), 7 de gestión, 10 complejas (componentes React)
- **Layout:** Secciones verticales apiladas (sin tabs, sin wizard)
- **Uso:** Email, coberturas, reservas, documentos, liquidación, etc.

#### 2. Pantallas Fijas (Inspection Screens)
- **Propósito:** Aplicación colaborativa en tiempo real para inspecciones
- **Configuración:** Hardcoded por diseño (proceso regulado)
- **Componentes:** 7 tabs + wizard de 6 pasos (acta)
- **Especializados:** Canvas de firmas, upload de evidencias, chat real-time, videollamada LiveKit, CRUD de daños, croquis
- **Sync:** Inspector controla tabs, cliente sigue via magic link (polling 2s)

### Integración
- Las pantallas dinámicas pueden incrustar vistas de inspección via `complex_entity` (`inspection_coordination`, `inspection_session_view`)
- El `action_template` de inspección puede tener una pantalla dinámica asociada para campos adicionales configurables
- Las inspecciones crean `claim_actions` estándar y aparecen en el listado de gestiones del siniestro

### Regla
```
Las pantallas dinámicas son para FORMULARIOS configurables.
Las pantallas fijas son para APLICACIONES especializadas con componentes
que no se pueden expresar en un form_schema JSONB (videollamada, canvas,
chat, upload, wizard, sync real-time).
NUNCA intentar meter inspección dentro de pantallas dinámicas.
NUNCA intentar hacer configurables los tabs/wizard de inspección.
```

---

## 19b. Glosario: Gestiones = Acciones

### Regla
```
Cuando hablamos de "gestiones" o "acciones" nos referimos a lo mismo.
Una gestión del siniestro = un claim_action.
Usar los términos indistintamente.
```

### Vocabulario Importante: Gestión vs Plantilla
```
Gestión / Acción (claim_actions):
  Cada tarea dentro de un siniestro (Reserva, Coberturas, Inspección, etc.).
  Es la instancia concreta en un siniestro específico.

Definición de Gestión (action_template):
  El catálogo de gestiones disponibles. Configura roles, plazos, pantallas,
  características. NO es una "plantilla" en el sentido documental.
  Una definición de gestión genera gestiones (claim_actions) en los siniestros.

Plantilla (document_template — futuro):
  Un documento Word/PDF con campos y logos de la aseguradora, que se asocia
  a una gestión de tipo ofimática para que el liquidador genere el documento
  rápido al ejecutar la gestión. Ej: un Word de "Informe de Liquidación"
  con campos merge y logos de la cia.

NUNCA llamar "template" a una definición de gestión (action_template).
"Template" se reserva exclusivamente para documentos ofimáticos.
```

---

## 20. Inspecciones como Gestiones Estándar — Decisión Definitiva

### Problema
Las inspecciones no creaban `claim_actions`, aparecían en el listado de gestiones del siniestro como objetos "fake" sin código estándar, sin action_status, sin issuer/reviewer/approver. El `inspection_number` se calculaba client-side con un formato distinto al estándar de gestiones.

### Solución Definitiva
- Cada inspección crea un `claim_action` con `action_features_id` = "Inspección" (INS)
- El `code` se genera por el trigger `set_claim_action_code()` siguiendo el estándar: `{liquidation}-{line_letter}{template_code}-{seq}` (ej: `L-000000141-HINS-001`)
- **Correlativo por template:** la secuencia es por `template_code` dentro de cada claim, no global. Ej: HCOB-001, HCOB-002, HRES-001, HINS-001
- `inspection_sessions.claim_action_id` vincula la sesión con la gestión
- El trigger `sync_inspection_claim_action()` sincroniza el status automáticamente:
  - `scheduled` → `todo` (pendiente)
  - `active` → `issued` (emitida, setea `issued_on`)
  - `completed` → `issued` (emitida, setea `issued_on` si no existe)
  - `cancelled` → `cancelled` (cancelada)
- El `inspection_number` se obtiene SIEMPRE del `claim_action.code`
- Migración 130 creó claim_actions retroactivamente para inspecciones legacy
- Migración 131 corrigió el correlativo a por-template y recorregió los codes legacy
- Eliminadas `buildInspectionNumber()` y `attachInspectionNumber()` (cálculo client-side legacy)

### Regla
```
Toda inspección DEBE crear un claim_action al momento de agendarse.
El inspection_number DEBE ser el code del claim_action (estándar de gestiones).
El correlativo del code es POR TEMPLATE_CODE dentro de cada claim, no global.
El status de la inspección y del claim_action se sincronizan automáticamente via trigger.
NUNCA calcular el inspection_number client-side. Siempre viene del claim_action.code.
```

---

## 21. Comboboxes (Select) — Estilo Visual Definitivo

### Problema
Los `<select>` nativos de HTML no se pueden estilar con CSS. El dropdown con las opciones usa el estilo del sistema operativo (Windows antiguo), rompiendo el diseño Liquid Glass de la app.

### Solución Definitiva
- **PROHIBIDO** usar `<select>` nativo de HTML en cualquier parte de la app.
- **OBLIGATORIO** usar el componente `Select` de shadcn/ui (Base UI) definido en `src/components/ui/select.tsx`.
- El estilo del Select (trigger, popup, items) está centralizado en el componente — NO se modifica por página.
- Para formularios con react-hook-form, usar `FormSelect` (wrapper de Select).
- Los triggers SIEMPRE llevan `className="app-input"` para heredar el estilo compacto (28px, 12px, border 10px).
- El popup aparece pegado al trigger (`sideOffset: 0`), con el mismo border-radius y borde, fusionándose visualmente como una extensión del combobox.
- Los items tienen hover (`bg-primary/10`) y cursor pointer.
- El chevron rota 180° al abrir el popup.
- Para filtros en listados, usar `"__all"` como valor para representar "sin filtro" (empty string).

### Regla
```
NUNCA usar <select> nativo de HTML. SIEMPRE usar Select de shadcn/ui.
El estilo está centralizado en src/components/ui/select.tsx — NO modificarlo por página.
Los triggers SIEMPRE llevan className="app-input".
Para filtros: usar "__all" como valor vacío, convertir a "" en onValueChange.
```
