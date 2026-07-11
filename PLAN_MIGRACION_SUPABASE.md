# Plan de Migración: Nhost → Supabase

## Motivación
Hasura (Nhost) presenta inestabilidad persistente (502/503 intermitentes) que afecta el desarrollo y la experiencia de usuario. Supabase ofrece una plataforma más estable con auto-detección de tablas (sin "tracking" manual) y un cliente REST auto-generado.

## Decisiones Tomadas
- **Data access:** Supabase client (REST) — `supabase.from('table').select()`
- **Alcance:** Migración completa (auth, data, storage, functions, RLS)
- **Estrategia:** Migrar todo de una vez, mantener Nhost como fallback hasta verificar

---

## Fase 1: Exportar Base de Datos de Nhost (1-2 horas)

### Pasos
1. Obtener `DATABASE_URL` de `.env.local` (ya existe)
2. Ejecutar `pg_dump` para exportar schema + datos:
```bash
pg_dump "$DATABASE_URL" \
  --schema=public \
  --schema=auth \
  --no-owner \
  --no-privileges \
  -F p \
  -f migrations/dump_nhost.sql
```
3. Separar en dos archivos:
   - `schema.sql` — solo estructura (CREATE TABLE, indexes, triggers, functions)
   - `data.sql` — solo datos (INSERT)

### Consideraciones
- Las tablas de `auth.users` de Nhost son compatibles con Supabase (ambos usan GoTrue)
- Los triggers (`handle_new_user`, `set_claim_action_code`, etc.) se mantienen
- Las funciones PostgreSQL (`gen_random_uuid()`, etc.) son compatibles
- **OJO:** Hasura metadata (permisos, tracking) NO se exporta — se reemplaza con RLS policies

---

## Fase 2: Importar a Supabase (1 hora)

### Pasos
1. Crear proyecto en https://supabase.com
2. Obtener URL y keys:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Ejecutar `schema.sql` en Supabase SQL Editor
4. Ejecutar `data.sql` en Supabase SQL Editor
5. Supabase auto-detecta todas las tablas (sin "tracking" manual)
6. Verificar que las relaciones (foreign keys) se detectan automáticamente

### Adaptaciones SQL
- `auth.users` ya existe en Supabase — solo importar datos, no la tabla
- Los triggers que referencian `auth.users` funcionan igual
- Cambiar `X-Hasura-Role` checks por RLS policies estándar

---

## Fase 3: Migrar Auth (medio día)

### Archivos a modificar
- `src/lib/nhost.ts` → `src/lib/supabase.ts`
- `src/hooks/use-auth.ts` — reescribir completamente
- `src/middleware.ts` — adaptar para Supabase session
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/signup/page.tsx`
- `src/app/onboarding/page.tsx`
- Cualquier archivo que use `nhost.auth.*`

### Nuevo cliente Supabase
```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
)

// Cliente admin (server-side only)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
```

### Mapeo de operaciones Auth
| Nhost | Supabase |
|---|---|
| `nhost.auth.signInEmailPassword()` | `supabase.auth.signInWithPassword()` |
| `nhost.auth.signUpEmailPassword()` | `supabase.auth.signUp()` |
| `nhost.auth.signOut()` | `supabase.auth.signOut()` |
| `nhost.auth.getSession()` | `supabase.auth.getSession()` |
| `nhost.auth.onAuthStateChanged()` | `supabase.auth.onAuthStateChange()` |
| `nhost.auth.getUser()` | `supabase.auth.getUser()` |

### Hook use-auth reescrito
```ts
// src/hooks/use-auth.ts
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadProfile(session.user.id)
      else setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ... loadProfile, login, logout, etc.
}
```

---

## Fase 4: Crear Cliente Supabase y Capa Base (2-3 horas)

### Instalar dependencias
```bash
pnpm add @supabase/supabase-js
pnpm remove @nhost/nhost-js  # después de migrar todo
```

### Variables de entorno (.env.local)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx
# Mantener DATABASE_URL para migraciones
DATABASE_URL=postgresql://...
```

### Helper de datos
```ts
// src/lib/supabase/data.ts
import { supabase } from './supabase'

export async function fetchOne<T>(table: string, id: string): Promise<T | null> {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data as T
}

export async function fetchMany<T>(table: string, filters?: Record<string, unknown>): Promise<T[]> {
  let query = supabase.from(table).select('*')
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as T[]
}
```

---

## Fase 5: Migrar Services (2-3 días)

### Patrón de migración por archivo

Cada archivo en `src/services/` sigue este patrón:

**Antes (Hasura GraphQL):**
```ts
import { graphqlRequest } from '@/lib/nhost/graphql'

export async function getClaimById(id: string) {
  const query = `
    query GetClaim($id: uuid!) {
      claims_by_pk(id: $id) {
        id claim_number ...
      }
    }
  `
  const data = await graphqlRequest<{ claims_by_pk: Claim }>(query, { id })
  return data.claims_by_pk
}
```

**Después (Supabase client):**
```ts
import { supabase } from '@/lib/supabase'

export async function getClaimById(id: string) {
  const { data, error } = await supabase
    .from('claims')
    .select(`
      id, claim_number, ...,
      policy!inner(id, policy_number, ...),
      claims_participants(id, full_name, ...)
    `)
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return data as Claim
}
```

### Mapeo de patrones GraphQL → Supabase
| Hasura GraphQL | Supabase client |
|---|---|
| `claims_by_pk(id: $id)` | `.from('claims').select().eq('id', id).single()` |
| `claims(where: {...})` | `.from('claims').select().eq('field', value)` |
| `claims(order_by: {field: asc})` | `.from('claims').select().order('field', { ascending: true })` |
| `claims(limit: 10)` | `.from('claims').select().limit(10)` |
| `insert_claims_one(object: {...})` | `.from('claims').insert({...}).select().single()` |
| `update_claims_by_pk(...)` | `.from('claims').update({...}).eq('id', id).select().single()` |
| `delete_claims_by_pk(...)` | `.from('claims').delete().eq('id', id)` |
| Relaciones anidadas | `.select('*, relation!inner(*)')` |
| Agregados (`_count`, `_sum`) | `.select('*', { count: 'exact' })` o RPC |

### Archivos a migrar (28 archivos con graphqlRequest, ~200 queries/mutations)
- `src/services/claim-actions.ts` — ~1032 líneas, 27 calls GraphQL
- `src/services/claims.ts` — ~839 líneas, 31 calls GraphQL
- `src/services/inspections.ts` — ~1007 líneas, 45 calls GraphQL
- `src/services/catalogs.ts` — ~949 líneas, 63 calls GraphQL
- `src/services/policies.ts` — ~717 líneas, 27 calls GraphQL
- `src/services/actions.ts` — ~705 líneas, 17 calls GraphQL
- `src/services/permissions.ts` — ~217 líneas, 4 calls GraphQL
- `src/services/persons.ts` — ~265 líneas, 6 calls GraphQL
- `src/services/policy-coverages.ts` — ~108 líneas, 4 calls GraphQL
- `src/services/user-clients.ts` — ~141 líneas, 8 calls GraphQL
- `src/services/users.ts` — ~180 líneas, 6 calls GraphQL
- `src/services/companies.ts` — ~100 líneas, 6 calls GraphQL
- `src/services/coverage-catalog.ts` — ~331 líneas, 11 calls GraphQL
- `src/services/claim-coverages.ts` — ~211 líneas, 6 calls GraphQL
- `src/services/claim-documents.ts` — ~251 líneas, 5 calls GraphQL
- `src/services/claim-documents-physical.ts` — ~76 líneas, 4 calls GraphQL
- `src/services/claim-reserves.ts` — ~245 líneas, 6 calls GraphQL
- `src/services/claim-action-history.ts` — ~105 líneas, 3 calls GraphQL
- `src/services/chat.ts` — ~68 líneas, 4 calls GraphQL
- `src/services/audit-logs.ts` — ~63 líneas, 3 calls GraphQL
- `src/services/document-templates.ts` — ~188 líneas, 5 calls GraphQL
- `src/services/document-data.ts` — ~250 líneas, 3 calls GraphQL (usa Storage)
- `src/services/field-permissions.ts` — ~113 líneas, 5 calls GraphQL
- `src/services/gestion-screens.ts` — ~230 líneas, 8 calls GraphQL
- `src/services/countries.ts` — ~25 líneas, 2 calls GraphQL
- `src/services/password-reset.ts` — ~61 líneas, **ya usa pg directamente** (sin cambios)

### Archivos core de Nhost a reemplazar (4 archivos)
- `src/lib/nhost/client.ts` → `src/lib/supabase/client.ts`
- `src/lib/nhost/server.ts` → `src/lib/supabase/server.ts`
- `src/lib/nhost/middleware.ts` → adaptar `src/middleware.ts`
- `src/lib/nhost/graphql.ts` → eliminar (reemplazado por supabase client)

### Auth
- `src/hooks/use-auth.ts` — reescribir (107 líneas)
- `src/services/users.ts` — cambiar `nhost.auth.signUpEmailPassword` por `supabase.auth.signUp`

### Server actions (`src/server/actions/`)
- `gestiones.ts` — usa `graphqlServerRequest` con admin secret → `supabaseAdmin`

---

## Fase 6: Migrar Storage (medio día)

### Mapeo
| Nhost Storage | Supabase Storage |
|---|---|
| `nhost.storage.upload(...)` | `supabase.storage.from('bucket').upload(path, file)` |
| `nhost.storage.getPublicUrl(...)` | `supabase.storage.from('bucket').getPublicUrl(path)` |
| `nhost.storage.delete(...)` | `supabase.storage.from('bucket').remove([path])` |

### Uso actual de Storage (mínimo)
- Solo `src/services/document-data.ts` usa Storage (presigned URLs)
- No hay uploads directos en el código actual
- Migración de Storage es trivial

### Buckets a crear en Supabase
- `documents` — documentos del siniestro
- `inspection-evidences` — fotos de inspección (futuro)
- `signatures` — firmas (futuro)

---

## Fase 7: Migrar Permisos a RLS (1 día)

### Problema actual
Hasura maneja permisos via metadata (no SQL). Estos NO se exportan con pg_dump.

### Solución
Reescribir todos los permisos como RLS policies de PostgreSQL:

```sql
-- Ejemplo: claims — usuarios solo ven claims de su empresa
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_claims" ON claims
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "users_insert_claims" ON claims
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
    )
  );
```

### Tablas que necesitan RLS
TODAS las tablas (según AGENTS.md). Las críticas:
- `claims`, `claim_actions`, `claim_coverages`, `claim_reserves`
- `inspection_sessions`, `inspection_evidences`, `inspection_reports`
- `profiles`, `companies`, `user_roles`
- `action_template`, `action_template_claim_status`
- `claim_document_requests`, `claim_document_request_items`

### Roles de Supabase
- `authenticated` — usuarios logueados (equivalente al rol `user` de Hasura)
- `anon` — usuarios no logueados
- `service_role` — admin (bypass RLS, equivalente a admin secret)

---

## Fase 8: Migrar Functions (opcional, medio día)

### Nhost Functions → Supabase Edge Functions
- Supabase usa Deno (TypeScript nativo)
- Mismo concepto: funciones serverless para webhooks, cron, etc.

### Si no tienes functions custom
Si no usas Nhost Functions (solo server actions de Next.js), este paso se puede saltar.

---

## Fase 9: Testing y Verificación (1 día)

### Checklist
- [ ] Login funciona (email/password)
- [ ] Signup + onboarding funciona
- [ ] Crear siniestro funciona
- [ ] Ver siniestro con todas sus tabs
- [ ] Crear gestión funciona
- [ ] Ingreso de coberturas funciona
- [ ] Reserva funciona (carga coberturas del ingreso)
- [ ] Ajuste funciona (carga reserva)
- [ ] Solicitud/Recepción de documentos funciona
- [ ] Coordinación de inspección funciona
- [ ] Inspección funciona
- [ ] Catálogos (gestiones, coberturas) funcionan
- [ ] Permisos por rol funcionan
- [ ] Storage (subir/descargar archivos) funciona
- [ ] RLS policies bloquean acceso cross-company

### Script de verificación
Crear `scripts/verify-supabase.cjs` que pruebe cada endpoint crítico.

---

## Timeline Estimado
| Fase | Tiempo | Dependencia |
|---|---|---|
| 1. Exportar BD | 1-2h | — |
| 2. Importar a Supabase | 1h | Fase 1 |
| 3. Migrar Auth | medio día | Fase 2 |
| 4. Cliente + capa base | 2-3h | Fase 3 |
| 5. Migrar services | 2-3 días | Fase 4 |
| 6. Migrar Storage | medio día | Fase 4 |
| 7. RLS policies | 1 día | Fase 2 |
| 8. Functions | medio día | Opcional |
| 9. Testing | 1 día | Todas |
| **Total** | **~5-7 días** | |

---

## Riesgos y Mitigaciones

1. **Datos de auth.users**: Los usuarios existentes necesitan migrar contraseñas. GoTrue (ambos) usa bcrypt, debería ser compatible.
2. **Queries complejas con relaciones anidadas**: Supabase client maneja `!inner` y `!left` joins, pero la sintaxis es diferente.
3. **Subscriptions/Realtime**: Si usas subscriptions de Hasura, migrar a Supabase Realtime.
4. **Admin secret**: Reemplazar `X-Hasura-Admin-Secret` con `SUPABASE_SERVICE_ROLE_KEY`.
5. **Triggers PostgreSQL**: Se mantienen igual (son PostgreSQL nativo).
6. **Funciones custom (`set_claim_action_code`, etc.)**: Se mantienen igual.

## Ventajas de Supabase sobre Nhost
- ✅ Auto-detección de tablas (sin "tracking" manual)
- ✅ Sin 502/503 intermitentes
- ✅ Dashboard más completo
- ✅ Mejor documentación y comunidad
- ✅ CLI nativo para Windows (`supabase CLI`)
- ✅ RLS nativo de PostgreSQL (más estándar que Hasura permissions)
- ✅ Free tier más generoso
