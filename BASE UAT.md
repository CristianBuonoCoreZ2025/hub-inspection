# Base de Datos UAT — Guía de Configuración

> Entorno de pruebas con datos de producción para inspecciones UAT.

## Objetivo

Tener un proyecto de **Supabase UAT** que contenga una copia de los datos de producción para probar mejoras sin afectar el entorno productivo. Conectarlo a un proyecto de **Vercel** con su propia URL estable.

## 1. Crear el proyecto UAT en Supabase

1. Abrir el dashboard de Supabase.
2. Crear un nuevo proyecto con un nombre claro, por ejemplo `inspecciones-uat`.
3. Guardar el password de la base de datos durante la creación.
4. Una vez creado, ir a **Project Settings → Database → Connection string** y copiar la URI.

## 2. Copiar datos de producción a UAT

### Opción recomendada: `pg_dump` + `psql`

Obtener las connection strings de ambos proyectos:

```txt
PROD=postgresql://postgres:<pass-prod>@db.<ref-prod>.supabase.co:5432/postgres
UAT=postgresql://postgres:<pass-uat>@db.<ref-uat>.supabase.co:5432/postgres
```

#### Copiar estructura + datos

```bash
pg_dump "$PROD" --clean --if-exists --no-owner --no-privileges > uat_backup.sql
psql "$UAT" < uat_backup.sql
```

En PowerShell:

```powershell
$prod = "postgresql://postgres:PASS_PROD@db.REF_PROD.supabase.co:5432/postgres"
$uat = "postgresql://postgres:PASS_UAT@db.REF_UAT.supabase.co:5432/postgres"

pg_dump $prod --clean --if-exists --no-owner --no-privileges > C:\backups\uat_backup.sql
psql $uat -f C:\backups\uat_backup.sql
```

#### Copiar solo datos (si la estructura ya existe)

```bash
pg_dump "$PROD" --data-only --no-owner --no-privileges > uat_data.sql
psql "$UAT" < uat_data.sql
```

#### Usar formato custom con `pg_restore`

```bash
pg_dump -Fc "$PROD" --clean --if-exists --no-owner --no-privileges > uat_backup.dump
pg_restore -d "$UAT" --clean --if-exists --no-owner --no-privileges uat_backup.dump
```

### Opción alternativa: Supabase CLI

```bash
supabase login
supabase db dump --db-url "$PROD" -f uat_backup.sql
psql "$UAT" < uat_backup.sql
```

El CLI es útil si ya está configurado, pero para copiar de un proyecto a otro el par `pg_dump` / `psql` suele ser más directo.

## 3. Sincronización periódica con GitHub Actions

Crear `.github/workflows/sync-uat.yml` para refrescar UAT automáticamente:

```yaml
name: Sync UAT Database

on:
  workflow_dispatch:
  schedule:
    - cron: '0 3 * * *'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Dump production data
        env:
          PROD_CONNECTION_STRING: ${{ secrets.PROD_CONNECTION_STRING }}
          UAT_CONNECTION_STRING: ${{ secrets.UAT_CONNECTION_STRING }}
        run: |
          pg_dump "$PROD_CONNECTION_STRING" --data-only --no-owner --no-privileges > uat_data.sql
          psql "$UAT_CONNECTION_STRING" < uat_data.sql
```

> Guardar las connection strings como secrets en GitHub. No incluir credenciales en el repositorio.

## 4. Conectar Vercel a la base UAT

### Un solo repositorio con ramas

Recomendación: usar **un único repositorio de GitHub**.

- Rama `main` → producción en Vercel.
- Rama `uat` → entorno UAT en Vercel.
- Feature branches → Preview Deployments de Vercel.

### Configurar dos proyectos Vercel

1. Crear `proyecto-prod` en Vercel:
   - Production Branch: `main`
   - Variables de entorno: URL y keys de Supabase producción.

2. Crear `proyecto-uat` en Vercel:
   - Production Branch: `uat`
   - Variables de entorno: URL y keys de Supabase UAT.

Ambos proyectos se conectan al mismo repositorio, pero despliegan ramas distintas.

### Variables de entorno necesarias

En cada proyecto Vercel, configurar:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_PASSWORD
```

> La `SUPABASE_SERVICE_ROLE_KEY` solo debe estar en server actions, API routes y variables de servidor. Nunca exponerla en el cliente.

## 5. Consideraciones importantes

### Row Level Security (RLS)

Las políticas RLS se copian con `pg_dump` completo. Verificar que funcionen correctamente en UAT.

### Storage

`pg_dump` no copia archivos de Supabase Storage (imágenes, PDFs, croquis, etc.). Si son necesarios para pruebas, migrar el bucket por separado usando:

- El cliente de Supabase Storage.
- Scripts de copia entre buckets.
- `supabase storage` si está disponible.

### Auth users

Los usuarios de autenticación no se migran con `pg_dump`. Para UAT se pueden:

- Recrear manualmente los usuarios de prueba.
- Migrar usuarios por la API de Supabase Auth.

### Edge Functions

Las Edge Functions no se copian automáticamente. Desplegarlas en el proyecto UAT si el código las usa.

### Datos sensibles

Si más personas tendrán acceso a UAT, considerar anonimizar datos personales antes de copiarlos.

## 6. Flujo de trabajo recomendado

1. Desarrollar la mejora en una feature branch.
2. Hacer push: Vercel genera una URL de preview conectada a UAT.
3. Probar la mejora con datos reales en UAT.
4. Si está correcta, hacer merge a `main`.
5. Vercel despliega automáticamente a producción.

## Notas

- No es necesario tener dos repositorios de GitHub.
- No usar la base local para UAT; el entorno UAT debe estar en Supabase para probar en condiciones reales.
- Si el plan de Supabase lo permite, la copia puede hacerse por medio de backups diarios descargables desde el dashboard, aunque el enfoque con `pg_dump` ofrece mayor control.
