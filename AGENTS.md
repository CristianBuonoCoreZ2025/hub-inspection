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

### Regla OBLIGATORIA de Texto en Botones
```
NUNCA usar dos palabras en el texto de un botón. Siempre UNA sola palabra.
Si se necesita contexto, usar un ícono de referencia, nunca texto adicional.

Ejemplos válidos:
  ✅ "Nuevo"    (con ícono Plus)
  ✅ "Editar"   (con ícono Pencil)
  ✅ "Guardar"  (con ícono Save)
  ✅ "Crear"    (con ícono Plus)
  ✅ "Cancelar" (sin ícono)
  ✅ "Exportar" (con ícono Download)
  ✅ "Imprimir" (con ícono Printer)
  ✅ "Eliminar" (con ícono Trash2)
  ✅ "Invitar"  (con ícono UserPlus)

Ejemplos PROHIBIDOS:
  ❌ "Nuevo Siniestro"
  ❌ "Guardar Cambios"
  ❌ "Exportar CSV"
  ❌ "Crear Empresa"
  ❌ "Enviar Invitación"
  ❌ "Imprimir / Guardar PDF"

Excepción: Los títulos de modales (DialogHeader/DialogTitle) SÍ pueden
tener texto descriptivo (ej: "Editar Empresa", "Nueva Inspección").
```

### Regla OBLIGATORIA de Colores y Dimensiones en Botones
```
Todos los botones de acción (Aceptar, Siguiente, Grabar, Crear, Guardar)
DEBEN usar la clase .btn-save (azul: gradiente #0095DA → #005BBB).

Todos los botones de cancelación DEBEN usar la clase .btn-cancel
(rosa: gradiente #fb7185 → #f43f5e).

Dimensiones estándar (definidas en buttons.css con !important):
- Alto: 29px para btn-save y btn-cancel
- btn-sm: w-[175px]
- btn-lg: w-[225px]
- Wizard footer: w-[122px]

Excepción: Botones especiales como "Desligar Asegurado" pueden usar
colores personalizados (esmeralda) con ancho fijo w-[150px].
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
.app-input         → h-10 rounded-xl border border-input px-3 text-[13px]
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
