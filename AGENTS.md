# Hub Inspections — Reglas del Proyecto

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
