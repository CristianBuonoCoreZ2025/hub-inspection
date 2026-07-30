# Entorno Local + UAT — Guía de Trabajo

> Documenta el flujo completo: Supabase local con Docker → rama UAT → producción.

---

## Arquitectura del entorno

```
┌─────────────────────────────────────────────────────────┐
│  DESARROLLO LOCAL                                        │
│                                                          │
│  Next.js dev (pnpm dev)                                  │
│    └── .env.local → http://127.0.0.1:54321 (Supabase)   │
│                                                          │
│  Supabase local (Docker)                                 │
│    ├── PostgreSQL 17.6  → 127.0.0.1:54322               │
│    ├── Auth (GoTrue)   → 127.0.0.1:54321                │
│    ├── REST (PostgREST)→ 127.0.0.1:54321/rest/v1        │
│    ├── Studio          → http://127.0.0.1:54323         │
│    └── Mailpit (email) → http://127.0.0.1:54324         │
│                                                          │
│  Datos: dump de producción (backups/prod_dump.sql)       │
│  Rama git: UAT                                           │
└─────────────────────────────────────────────────────────┘
                          │
                          │ (cuando todo está OK)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  PRODUCCIÓN                                              │
│                                                          │
│  Vercel → Supabase hosted (uoqubwwimudywcpxyxdk)        │
│  Rama git: main                                          │
│  .env.local → .env.production (restaurar al deployar)   │
└─────────────────────────────────────────────────────────┘
```

---

## Comandos esenciales

### Iniciar Supabase local
```bash
supabase start
```

### Detener Supabase local
```bash
supabase stop
```

### Ver estado de Supabase local
```bash
supabase status
```

### Iniciar la app
```bash
pnpm dev
```
→ http://localhost:3000

### Acceder a Supabase Studio (admin visual de la BD)
→ http://127.0.0.1:54323

### Ver emails capturados (Mailpit)
→ http://127.0.0.1:54324

---

## Cambiar entre local y producción

### Estoy en LOCAL (.env.local apunta a 127.0.0.1)
- `.env.local` contiene las URLs/keys de Supabase local
- `.env.production` contiene el backup de las URLs/keys de producción

### Volver a PRODUCCIÓN (antes de deployar)
```bash
Copy-Item .env.production .env.local -Force
```

### Volver a LOCAL
```bash
# Restaurar .env.local con los valores locales (ver sección "Recrear .env.local")
```

---

## Flujo de trabajo UAT → producción

### 1. Trabajar en UAT
```bash
git checkout UAT
# Hacer cambios, probar en local contra Supabase local
# Commitear en UAT
git add .
git commit -m "fix(...): descripción del cambio"
```

### 2. Cuando UAT está estable y probado → merge a main
```bash
git checkout main
git merge UAT --no-edit
# Opcional: push a origin/main para deployar a Vercel
git push origin main
```

### 3. Sincronizar UAT con main (si main avanzó por hotfixes)
```bash
git checkout UAT
git merge main --no-edit
git push origin UAT
```

---

## Recrear .env.local desde cero

Si se pierde el `.env.local` local, recrearlo con estos valores:

```env
# Supabase LOCAL
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ver abajo cómo obtenerla>
SUPABASE_SERVICE_ROLE_KEY=<ver abajo cómo obtenerla>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# El resto de variables (R2, OpenRouter, Mapbox, etc.) copiar de .env.production
```

### Obtener las keys JWT locales

El JWT secret por defecto de Supabase local es:
```
super-secret-jwt-token-with-at-least-32-characters-long
```

Generar las keys con:
```bash
node -e "
const crypto=require('crypto');
const secret='super-secret-jwt-token-with-at-least-32-characters-long';
function makeJwt(payload){
  const header={typ:'JWT',alg:'HS256'};
  const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const h=enc(header);
  const p=enc({...payload,iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+100*365*24*3600});
  const sig=crypto.createHmac('sha256',secret).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+sig;
}
console.log('ANON_KEY='+makeJwt({ref:'hub-inspection',role:'anon'}));
console.log('SERVICE_ROLE_KEY='+makeJwt({ref:'hub-inspection',role:'service_role'}));
"
```

---

## Restaurar el dump de producción en local

Si se necesita un refresh de los datos de producción:

```bash
# 1. Hacer dump desde el contenedor Postgres local (que actúa como puente)
docker exec supabase_db_hub-inspection pg_dump \
  "postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres" \
  --no-owner --no-privileges --schema=public \
  -F p -f /tmp/prod_dump.sql

# 2. Copiar al host
docker cp supabase_db_hub-inspection:/tmp/prod_dump.sql backups/prod_dump.sql

# 3. Limpiar schema public local
docker exec supabase_db_hub-inspection psql -U postgres -c \
  "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; \
   GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;"

# 4. Restaurar
docker cp backups/prod_dump.sql supabase_db_hub-inspection:/tmp/prod_dump.sql
docker exec supabase_db_hub-inspection psql -U postgres -d postgres -f /tmp/prod_dump.sql

# 5. Aplicar grants (ver scripts/_apply_grants.sql o ejecutar manualmente)
#    Los grants son necesarios porque --no-privileges los omite
```

> **Nota:** Los grants de `anon`, `authenticated` y `service_role` sobre las tablas
> se pierden al restaurar con `--no-privileges`. Hay que reaplicarlos manualmente.
> Ver el SQL de grants en el historial de comandos o pedirlo a Devin.

---

## Notas importantes

- **Auth local:** Los usuarios de `auth.users` NO se incluyen en el dump de `public` schema.
  Para login local, hay que crear usuarios via Supabase Studio o via la API de Auth.
  Los `profiles` sí se restauran (están en `public`), pero los usuarios en `auth.users`
  no existen localmente. Hay que registrar usuarios nuevos en local.

- **Storage:** Los archivos en R2 (fotos, PDFs, firmas) no se copian localmente.
  Las URLs de R2 siguen apuntando a Cloudflare. Si se necesitan archivos locales,
  configurar el storage de Supabase local por separado.

- **Mailpit:** Los emails enviados desde local se capturan en Mailpit
  (http://127.0.0.1:54324) en vez de enviarse realmente. Para enviar emails reales,
  descomentar `RESEND_API_KEY` y `RESEND_FROM_EMAIL` en `.env.local`.

- **RLS:** Las políticas RLS se restauran del dump. El comportamiento local es
  idéntico a producción. Para pruebas sin RLS, usar `SUPABASE_SERVICE_ROLE_KEY`.

- **Docker en Windows:** Supabase local requiere Docker Desktop corriendo.
  Si Docker no está activo, `supabase start` fallará.
