# Claims Hub Platform

Plataforma SaaS empresarial para la gestión integral del ciclo de vida de siniestros (Claims Lifecycle Management).

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

## Módulos Principales

- **Base SaaS:** Auth, Multi-tenant, Usuarios, Empresas, Onboarding
- **Siniestros (Claims):** CRUD completo, workflow de estados, historial de cambios (audit log)
- **Catálogos Maestros:** Causas, compañías, corredores, asesores, líneas de negocio, productos
- **Carga Masiva:** Importación de siniestros y catálogos vía Excel
- **Inspecciones Remotas:** Sesiones de inspección, acta de inspección (wizard 6 pasos), checklist, daños, evidencias, croquis, firmas digitales, informes PDF
- **Agenda:** Vista semanal de inspecciones programadas
- **Chat:** Mensajería persistente por sesión de inspección

## Comandos del Proyecto

```bash
pnpm dev          # Iniciar desarrollo
pnpm build        # Build de producción
pnpm lint         # Linting
pnpm db:push      # Ejecutar migraciones SQL en PostgreSQL
```

## Configuración de Variables de Entorno

Crea `.env.local` con:

```env
NEXT_PUBLIC_NHOST_SUBDOMAIN=tu-subdomain
NEXT_PUBLIC_NHOST_REGION=eu-central-1
NEXT_PUBLIC_NHOST_AUTH_URL=https://auth.tu-proyecto.nhost.run
NEXT_PUBLIC_NHOST_GRAPHQL_URL=https://graphql.tu-proyecto.nhost.run/v1
NEXT_PUBLIC_NHOST_STORAGE_URL=https://storage.tu-proyecto.nhost.run
DATABASE_URL="postgres://postgres:password@host:port/database"
```

## Arquitectura

Estructura **feature-based** bajo `src/features/` y `src/app/`. Ver `AGENTS.md` para convenciones completas de código, seguridad, estilos y decisiones técnicas.

## Decisiones Técnicas Clave

- Migraciones SQL manuales versionadas (`migrations/`)
- Triggers PostgreSQL para auditoría automática (`audit_logs`)
- Workflow de estados del siniestro automático vía inspección
- Upload de archivos a Nhost Storage
- Sistema de estilos semántico con paleta de botones y modales canónicos

---

Documentación técnica detallada en [`AGENTS.md`](./AGENTS.md).
