# Migración a Docker Local — Plan Completo

> Estado: **COMPLETADO** el 2026-07-28
>
> Este documento registra todo lo hecho para configurar el entorno local con
> Supabase en Docker, poblarlo con datos de producción, y dejar el flujo
> UAT → producción listo para trabajar.

---

## Objetivo

Tener un entorno local idéntico a producción para hacer pruebas (UAT) antes
de subir cambios a producción. El flujo es:

```
Local (Docker + Supabase local) → Rama UAT → Rama main → Producción (Vercel + Supabase hosted)
```

---

## Lo que ya está hecho

### 1. Supabase local con Docker

- **CLI instalado:** Supabase CLI v2.109.1
- **Docker:** Docker Desktop v29.6.1 con Docker Compose v5.2.0
- **Inicializado:** `supabase init` creó `supabase/config.toml`
- **Versión PostgreSQL:** 17.6 (mismo que producción)
- **Estado:** `supabase start` corriendo con 12 contenedores

URLs locales:

| Servicio | URL |
|---|---|
| App Next.js | http://localhost:3000 |
| Supabase API (REST/Auth) | http://127.0.0.1:54321 |
| Supabase Studio (admin visual) | http://127.0.0.1:54323 |
| Mailpit (emails capturados) | http://127.0.0.1:54324 |
| PostgreSQL directo | 127.0.0.1:54322 |

### 2. Datos de producción restaurados en local

- **Dump:** `backups/prod_dump.sql` (8.3 MB)
- **Método:** `pg_dump` desde el contenedor Postgres local conectándose a producción
- **Flags:** `--no-owner --no-privileges --schema=public`
- **Restaurado:** 108 tablas en schema `public`

Datos restaurados:

| Tabla | Filas |
|---|---|
| claims | 20 |
| profiles | 34 |
| companies | 1 (McLarens) |
| policies | 107 |
| action_template | 38 |
| audit_logs | 120 |
| claim_actions | 80 |
| email_templates | 3 |

### 3. Grants aplicados

El dump con `--no-privileges` no incluye los grants de los roles `anon`,
`authenticated` y `service_role`. Se aplicaron manualmente:

- `GRANT USAGE ON SCHEMA public` a los 3 roles
- `GRANT ALL` a `service_role` sobre tablas, secuencias y funciones
- `GRANT SELECT, INSERT, UPDATE, DELETE` a `anon` y `authenticated` sobre todas las tablas
- `GRANT EXECUTE` a `anon` y `authenticated` sobre todas las funciones
- `NOTIFY pgrst, 'reload schema'` para refrescar PostgREST

### 4. Usuario base creado

| Campo | Valor |
|---|---|
| Email | `cristian.buono-core@mclarens.com` |
| Password | `Paoloxvito099` |
| Rol | `internal` (super-rol, ve todos los siniestros) |
| Empresa | McLarens (`745762e5-52ef-c237-75ba-b33a509781a6`) |
| user_id | `dff83462-7fdc-44d0-b1e4-1aba81175882` (mismo que producción) |

Verificado:
- Login vía `signInWithPassword` — OK
- RLS como `internal` — ve 20 claims y 34 profiles
- Profile coincide con el `user_id` del dump

### 5. Variables de entorno

- **`.env.local`** — apunta a Supabase local (http://127.0.0.1:54321)
- **`.env.production`** — backup del `.env.local` original con valores de producción
- Variables de terceros (R2, OpenRouter, Mapbox, Gotenberg) se mantienen iguales

### 6. Rama UAT sincronizada

- `git checkout UAT`
- `git merge main` (fast-forward) — UAT ahora tiene todos los fixes de `company_id`
- `pnpm install` — dependencias OK
- `npx tsc --noEmit` — 0 errores
- `pnpm dev` — app corriendo en http://localhost:3000

---

## Cómo retomar el trabajo

### Si Docker y Supabase están corriendo

```bash
# Verificar que Supabase local está activo
supabase status

# Levantar la app
pnpm dev
# → http://localhost:3000
# → Login: cristian.buono-core@mclarens.com / Paoloxvito099
```

### Si Supabase local está detenido

```bash
# Iniciar Supabase local
supabase start

# Verificar
supabase status

# Levantar la app
pnpm dev
```

### Si Docker no está corriendo

1. Abrir Docker Desktop
2. Esperar a que el icono de Docker diga "Running"
3. Ejecutar `supabase start`

### Si se perdió la BD local y hay que restaurar de nuevo

```bash
# 1. El dump ya está en backups/prod_dump.sql
# 2. Limpiar schema public local
docker exec supabase_db_hub-inspection psql -U postgres -c \
  "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; \
   GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;"

# 3. Restaurar
docker cp backups/prod_dump.sql supabase_db_hub-inspection:/tmp/prod_dump.sql
docker exec supabase_db_hub-inspection psql -U postgres -d postgres -f /tmp/prod_dump.sql

# 4. Aplicar grants (ver sección "Grants" abajo)
# 5. Recrear usuario auth (ver sección "Usuario base" abajo)
```

### Si se necesita un dump fresco de producción

```bash
# Hacer dump desde el contenedor Postgres local (actúa como puente)
docker exec supabase_db_hub-inspection pg_dump \
  "postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres" \
  --no-owner --no-privileges --schema=public \
  -F p -f /tmp/prod_dump.sql

# Copiar al host
docker cp supabase_db_hub-inspection:/tmp/prod_dump.sql backups/prod_dump.sql
```

---

## SQL para re-aplicar grants (si se restaura el dump)

Guardar como archivo temporal y ejecutar con `psql`:

```sql
-- Grants para Supabase local
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
  END LOOP;
END $$;

DO $$
DECLARE f text;
BEGIN
  FOR f IN SELECT proname FROM pg_proc p
           JOIN pg_namespace n ON p.pronamespace=n.oid
           WHERE n.nspname='public' AND p.prokind='f' LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO authenticated', f);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA vault TO service_role;
GRANT USAGE ON SCHEMA graphql_public TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
```

---

## SQL para recrear el usuario base (si se restaura el dump)

El schema `auth.users` no se incluye en el dump de `public`. Si se restaura
el dump, hay que recrear el usuario. Guardar como archivo temporal y
ejecutar con `psql`:

```sql
-- Crear usuario auth local (mismo user_id que el profile del dump)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user
)
SELECT
  'dff83462-7fdc-44d0-b1e4-1aba81175882',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'cristian.buono-core@mclarens.com',
  crypt('Paoloxvito099', gen_salt('bf', 10)),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Cristian Buono Core","role":"internal","company_id":"745762e5-52ef-c237-75ba-b33a509781a6"}',
  false
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'dff83462-7fdc-44d0-b1e4-1aba81175882'
);

-- Si ya existe, actualizar password
UPDATE auth.users
SET encrypted_password = crypt('Paoloxvito099', gen_salt('bf', 10)),
    email_confirmed_at = now(),
    updated_at = now()
WHERE id = 'dff83462-7fdc-44d0-b1e4-1aba81175882';
```

---

## Flujo de trabajo: UAT → producción

### Paso 1: Trabajar en UAT (local)

```bash
git checkout UAT

# Hacer cambios en el código
# Probar en http://localhost:3000 contra Supabase local

# Commitear en UAT
git add .
git commit -m "fix(...): descripción del cambio"
```

### Paso 2: Cuando UAT está estable y probado → merge a main

```bash
git checkout main
git merge UAT --no-edit
```

### Paso 3: Deployar a producción

```bash
# Restaurar .env.local con valores de producción
Copy-Item .env.production .env.local -Force

# Push a origin/main (Vercel deploya automáticamente)
git push origin main
```

### Paso 4: Volver a modo local

```bash
# Restaurar .env.local con valores locales
# (ver docs/ENTORNO_LOCAL_UAT.md para los valores exactos)

# Volver a UAT
git checkout UAT
```

### Paso 5: Sincronizar UAT con main (si main avanzó por hotfixes)

```bash
git checkout UAT
git merge main --no-edit
git push origin UAT
```

---

## Archivos importantes creados

| Archivo | Propósito |
|---|---|
| `supabase/config.toml` | Configuración de Supabase local (generado por `supabase init`) |
| `.env.local` | Variables de entorno apuntando a Supabase local |
| `.env.production` | Backup del `.env.local` original con valores de producción |
| `backups/prod_dump.sql` | Dump de la BD de producción (8.3 MB) |
| `docs/ENTORNO_LOCAL_UAT.md` | Guía de comandos y flujo de trabajo |
| `docs/MIGRACION_A_DOCKER_LOCAL.md` | Este documento (plan completo) |

---

## Notas importantes

### Auth local
- Los usuarios de `auth.users` NO se incluyen en el dump de `public` schema.
- El usuario base (`cristian.buono-core@mclarens.com`) se creó manualmente
  con el mismo `user_id` que el profile del dump, para que todas las
  foreign keys (`user_clients`, `claim_actions`, `audit_logs`) funcionen.
- Si se restaura el dump de nuevo, hay que recrear el usuario auth.

### Storage
- Los archivos en R2 (fotos, PDFs, firmas) no se copian localmente.
- Las URLs de R2 siguen apuntando a Cloudflare (accesibles desde local).
- Si se necesita storage local, configurar el storage de Supabase local por separado.

### Emails
- Los emails enviados desde local se capturan en Mailpit
  (http://127.0.0.1:54324) en vez de enviarse realmente.
- Para enviar emails reales, descomentar `RESEND_API_KEY` y
  `RESEND_FROM_EMAIL` en `.env.local`.

### RLS
- Las políticas RLS se restauran del dump. El comportamiento local es
  idéntico a producción.
- Para pruebas sin RLS, usar `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS).

### Docker en Windows
- Supabase local requiere Docker Desktop corriendo.
- Si Docker no está activo, `supabase start` fallará.
- Los contenedores se detienen con `supabase stop` y se reinician con `supabase start`.
- Los datos persisten entre reinicios (volumen de Docker).

### JWT secret local
- El JWT secret por defecto de Supabase local es:
  `super-secret-jwt-token-with-at-least-32-characters-long`
- Las keys JWT (`NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`)
  se generan con ese secret. Si se cambia el secret, hay que regenerar las keys.

---

## Estado final

- [x] Supabase local con Docker corriendo
- [x] Datos de producción restaurados (108 tablas)
- [x] Grants aplicados (anon, authenticated, service_role)
- [x] Usuario base creado y verificado (login + RLS OK)
- [x] `.env.local` apuntando a local, `.env.production` como backup
- [x] Rama UAT sincronizada con main
- [x] `pnpm install` y `tsc --noEmit` sin errores
- [x] App corriendo en http://localhost:3000
- [x] Documentación creada (`docs/ENTORNO_LOCAL_UAT.md` y este archivo)
