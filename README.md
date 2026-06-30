# Claims Hub Platform

> Plataforma SaaS empresarial para la gestión integral del ciclo de vida de siniestros
> (Claims Lifecycle Management).

---

## Tabla de Contenidos

1. [Visión del Producto](#1-visión-del-producto)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitectura](#3-arquitectura)
4. [Módulos Principales](#4-módulos-principales)
5. [Flujo de Inspección](#5-flujo-de-inspección)
6. [Roadmap](#6-roadmap)
7. [Estado por Página](#7-estado-por-página)
8. [Convenciones de Código](#8-convenciones-de-código)
9. [Sistema de Estilos](#9-sistema-de-estilos)
10. [Base de Datos](#10-base-de-datos)
11. [Decisiones Técnicas Definitivas](#11-decisiones-técnicas-definitivas)
12. [Comandos del Proyecto](#12-comandos-del-proyecto)
13. [Deuda Técnica](#13-deuda-técnica)
14. [Documentación Relacionada](#14-documentación-relacionada)

---

## 1. Visión del Producto

**Claims Hub** — Claims Lifecycle Management Platform

Claims Hub Platform es la plataforma digital empresarial para la gestión integral del
ciclo de vida de un siniestro. Unifica apertura de casos, asignaciones, inspecciones
presenciales y remotas, videoinspecciones, gestión documental, evidencias, liquidación
y analítica avanzada en una sola solución SaaS multi-tenant.

### Propuesta de Valor

> "La plataforma digital para la gestión integral de siniestros."

- **Reducción de tiempos de resolución** — desde la apertura del caso hasta la liquidación
- **Automatización operacional** — workflows inteligentes, asignaciones automáticas, SLAs
- **Trazabilidad completa** — auditoría inmutable de cada acción sobre cada caso
- **Gestión centralizada** — un único hub para aseguradoras, liquidadores, ajustadores y clientes
- **Experiencia del cliente** — portales dedicados, comunicaciones integradas, seguimiento en tiempo real
- **Inteligencia artificial** — detección de fraudes, estimación de daños, OCR, analítica predictiva
- **Seguridad empresarial** — multi-tenant, RLS, compliance, cifrado end-to-end

### Público Objetivo

**Primario:**
- Aseguradoras — departamentos de siniestros, operaciones y compliance
- Empresas de liquidación — liquidadores, supervisores, ajustadores
- Corredores de seguros — gestión de cartera y seguimiento de casos

**Secundario:**
- Inspectores de campo — mobile app para inspecciones presenciales
- Clientes finales — portal para seguimiento de su caso y carga de documentos
- Auditores internos — reportería, trazabilidad y control de calidad

### Posicionamiento Comercial

Claims Hub Platform se posiciona como la alternativa moderna a los sistemas legacy de
gestión de siniestros. No es solo una herramienta de inspección — es el sistema operativo
del departamento de siniestros.

**Diferenciadores clave:**
- Workflow end-to-end (no solo inspección)
- Inspecciones remotas integradas nativamente
- Arquitectura multi-tenant SaaS moderna
- API-first para integraciones
- AI-ready desde el diseño

### Estrategia de Crecimiento

1. **Land & Expand** — entrar con inspecciones remotas, expandir a gestión completa de casos
2. **Vertical** — dominar seguros de hogar/incendio, expandir a autos, salud, agro
3. **Geográfico** — Chile → LATAM → Global
4. **Partner** — integraciones con core systems de aseguradoras (guidewire, duck creek)
5. **White-label** — capacidad de rebrand por empresa/aseguradora

### Métricas de Éxito

| Métrica | Meta |
|---------|------|
| Time to resolution | -40% |
| First contact resolution | 80% |
| Customer NPS | > 50 |
| Inspector utilization | +30% |
| Fraud detection rate | 15% |

---

## 2. Stack Tecnológico

| Capa | Tecnología | Evaluación |
|------|-----------|------------|
| Framework | Next.js 16 (App Router) | Excelente. RSC, streaming, edge-ready |
| Lenguaje | TypeScript (estricto) | — |
| Estilos | Tailwind CSS v4 | Excelente. Utility-first, tree-shakeable |
| UI Components | shadcn/ui | Excelente. Basado en Radix, accesible |
| Estado Global | Zustand | Bueno. Ligero, TypeScript-friendly |
| Cache | TanStack Query | Excelente. Stale-while-revalidate, optimistic |
| Formularios | React Hook Form + Zod | Excelente. Performance + validación type-safe |
| Backend | Nhost (Hasura + PostgreSQL + Auth) | Bueno. GraphQL auto-generado, RLS |
| Auth | Nhost Auth v4 | Bueno. OAuth, MFA, webhooks |
| Storage | Nhost Storage | Adecuado. S3-compatible |
| Deploy | Vercel | Excelente. Edge, CI/CD nativo |
| Gestor de paquetes | pnpm | — |

---

## 3. Arquitectura

### Estructura de Features

```
src/
├── app/              # Next.js App Router (rutas)
├── components/       # UI compartido (shadcn + custom)
├── hooks/            # Custom hooks
├── lib/              # Utilidades, configuraciones (nhost, etc.)
├── services/         # GraphQL clients (Nhost)
├── server/           # Server Actions
├── types/            # TypeScript globals
└── features/         # (preparado para expansión por dominio)
```

### Arquitectura Funcional

```
┌─────────────────────────────────────────────────────────────┐
│                    Claims Hub Platform                        │
├─────────────────────────────────────────────────────────────┤
│  Core Claims    │  Assessments  │  Evidence Center           │
│  ├─ Apertura    │  ├─ Remotas   │  ├─ Documentos            │
│  ├─ Workflow    │  ├─ Presencial│  ├─ Fotos/Videos            │
│  ├─ Asignaciones│  ├─ Videoinsp.│  ├─ Firmas                  │
│  ├─ Estados     │  ├─ Checklist │  └─ Croquis                 │
│  └─ Audit Log   │  └─ Informes  │                             │
├─────────────────────────────────────────────────────────────┤
│  Document Center│  Liquidation Center │  Vendor Network        │
│  ├─ Upload      │  ├─ Cálculos        │  ├─ Proveedores       │
│  ├─ Clasificación│ ├─ Reservas         │  ├─ Órdenes           │
│  ├─ Búsqueda    │  ├─ Pagos           │  └─ Facturación       │
│  └─ Templates   │  └─ Integración     │                         │
├─────────────────────────────────────────────────────────────┤
│  Customer Portal│  Mobile Field App  │  AI Services           │
│  ├─ Seguimiento │  ├─ Offline sync   │  ├─ OCR                │
│  ├─ Documentos  │  ├─ GPS capture    │  ├─ Clasif. daños      │
│  └─ Comunicación│  └─ Firma digital  │  └─ Fraude detection   │
├─────────────────────────────────────────────────────────────┤
│  Auth · Multi-tenant · RLS · Audit · Notifications · Reports │
└─────────────────────────────────────────────────────────────┘
```

### Recomendaciones de Crecimiento

1. **Feature-Based Modules** — organizar `src/features/` por dominio (claims, inspections, evidence, agenda, liquidation, vendor-network, customer-portal, mobile-sync, ai-services)
2. **Capa BFF** — agregar `src/api/` para aggregations complejos que Hasura no resuelve bien
3. **Event-Driven** — Nhost Functions serverless para workflows (on-claim-created, on-inspection-completed, on-sla-breach, on-fraud-flag)
4. **Caché de Catálogos** — TanQuery con staleTime largo + SSR para catálogos en dashboard
5. **Real-time** — Hasura Subscriptions para chat en vivo + SSE para notificaciones

### Seguridad

**Estado actual (bueno):**
- RLS en PostgreSQL
- Hasura permissions por rol
- Auth con JWT de Nhost
- XSS/CSRF protegido por Next.js

**Recomendaciones futuras:**
1. Rate limiting en API routes
2. Content Security Policy en headers
3. Audit logging completo (ya implementado en PostgreSQL)
4. Data encryption at rest (Nhost tiers superiores)
5. API key management para integraciones con aseguradoras

### Integraciones Futuras

| Sistema | Propósito | Prioridad |
|---------|----------|-----------|
| LiveKit | Videollamadas (ya implementado) | — |
| OpenRouter / Claude | Análisis de daños con IA | Medio |
| SendGrid / Resend | Emails transaccionales | Alto |
| Twilio | SMS para magic links | Medio |
| S3 / R2 | Storage de archivos masivos | Medio |
| Slack / Teams | Notificaciones internas | Bajo |

---

## 4. Módulos Principales

- **Base SaaS:** Auth, Multi-tenant, Usuarios, Empresas, Onboarding
- **Siniestros (Claims):** CRUD completo, workflow de estados, historial de cambios (audit log)
- **Catálogos Maestros:** Causas, compañías, corredores, asesores, líneas de negocio, productos
- **Carga Masiva:** Importación de siniestros y catálogos vía Excel
- **Inspecciones Remotas:** Sesiones de inspección, acta de inspección (wizard 6 pasos), checklist, daños, evidencias, croquis, firmas digitales, informes PDF
- **Agenda:** Vista semanal de inspecciones programadas
- **Chat:** Mensajería persistente por sesión de inspección

---

## 5. Flujo de Inspección

### Concepto Central

Un **siniestro (claim)** es el origen. De un siniestro se desprenden **sesiones de inspección**.
Cada sesión contiene: Acta de Inspección, registro de daños, evidencias multimedia, croquis,
firmas digitales, observaciones finales, e informe PDF.

> **Regla:** No existe inspección sin siniestro. No se agenda una inspección sin un siniestro
> asociado. No se genera informe sin daños registrados.

### Diagrama de Flujo

```
[ SINIESTRO CREADO ]
         │
         ▼
┌─────────────────────┐
│ Crear Sesión de     │  ← Desde la página del siniestro o desde Agenda
│ Inspección          │  ← Se asigna inspector desde aquí
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Estado: PENDING     │  ← Sesión recién creada, sin fecha asignada
│ Agendar inspección  │  ← Se define fecha/hora en `scheduled_at`
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Estado: SCHEDULED   │  ← Aparece en el calendario (Agenda)
│                     │  ← Se genera magic link para el asegurado
└──────────┬──────────┘
           │
           ▼ (cuando llega la fecha/inspector inicia)
┌─────────────────────┐
│ Estado: ACTIVE      │  ← Inicia la inspección en terreno
│ Completar Acta      │  ← 5 formularios del Acta de Inspección
└──────────┬──────────┘
           │
           ▼ (Acta completada)
┌─────────────────────┐
│ Registrar Daños     │  ← Tabla de daños (edificio + contenido)
│ Subir Evidencias    │  ← Fotos, videos, documentos
│ Subir Croquis       │  ← Planos de áreas afectadas
│ Firmas Digitales    │  ← Inspector + Asegurado
└──────────┬──────────┘
           │
           ▼ (todo registrado)
┌─────────────────────┐
│ Estado: COMPLETED   │  ← Inspección completada
│ Generar Informe PDF │  ← Consolidar todo en PDF descargable
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Informe Enviado/    │  ← Estado final del siniestro: signed
│ Cerrado             │
└─────────────────────┘

Estado alternativo: CANCELLED (desde PENDING o SCHEDULED)
```

### Estados de una Sesión de Inspección

| Estado | Descripción | Transiciones posibles |
|--------|-------------|----------------------|
| `pending` | Sesión creada, sin fecha asignada | → `scheduled` (agendar) |
| `scheduled` | Fecha asignada, aparece en Agenda | → `active` (iniciar) / → `cancelled` |
| `active` | Inspector en terreno, completando Acta | → `completed` / → `cancelled` |
| `completed` | Acta, daños, evidencias y firmas listos | → (generar informe) |
| `cancelled` | Inspección cancelada | → (no hay retorno) |

### Acta de Inspección (Wizard 6 pasos)

1. **Datos Generales** — fecha, hora, entrevistado, parte policial, otros seguros
2. **Riesgo Siniestrado** — tipo de riesgo, propiedad, antigüedad, superficie, habitaciones
3. **Materialidad** — muros, cubierta, pavimentos, cielos, terminaciones, cierre perimetral
4. **Medidas de Asegurabilidad** — protecciones, chapas, guardias, alarmas, cámaras
5. **Declaración del Asegurado** — relato, punto de entrada, alarma, objetos sustraídos
6. **Datos de Terceros** — tabla de afectados/responsables

### Reglas del Workflow

1. Una sesión de inspección solo se crea desde un siniestro existente
2. Solo sesiones `scheduled` o `active` aparecen en la Agenda
3. Una sesión `scheduled` solo pasa a `active` manualmente
4. El Acta solo se edita cuando la sesión está `active`
5. Sin ambas firmas (inspector + asegurado) NO se puede generar el informe PDF
6. Un siniestro puede tener múltiples sesiones de inspección (reinspección)
7. Una sesión `cancelled` no se puede reactivar; se debe crear una nueva
8. Al crear la sesión, se debe asignar un inspector (rol `inspector`)

---

## 6. Roadmap

### Fase 1: Core SaaS — COMPLETADO

- ✅ Landing Page
- ✅ Autenticación (Nhost Auth)
- ✅ Onboarding de empresa
- ✅ Multi-tenant (RLS + Hasura Permissions)
- ✅ Gestión de usuarios y roles
- ✅ Dashboard con métricas
- ✅ Sidebar y navegación
- ✅ Dark/Light mode + 5 pieles dinámicas
- ✅ Sistema de logging centralizado
- ✅ Panel de diagnóstico

### Fase 2: Core Claims — EN PROGRESO

- ✅ CRUD de siniestros con wizard de 3 pasos
- ✅ Estados del workflow (created → closed)
- ✅ Catálogos maestros (15 tipos)
- ✅ Participantes del siniestro (asegurado, contratista, beneficiario)
- ✅ Asignaciones (inspector, ajustador, auditor)
- ✅ Audit log automático
- ✅ Carga masiva vía Excel
- ✅ Página de detalle con tabs
- ✅ Edición completa en tabs del detalle
- 🔄 Liquidación Center (campos preparados, UI pendiente)

### Fase 3: Inspecciones Remotas — COMPLETADO

- ✅ Sesiones de inspección con LiveKit
- ✅ Acta de inspección (wizard 6 pasos)
- ✅ Checklist de daños
- ✅ Evidencias (fotos/videos)
- ✅ Croquis / sketches
- ✅ Firmas digitales
- ✅ Informe PDF
- ✅ Chat persistente por sesión
- ✅ Magic Link de acceso

### Fase 4: Agenda y Operaciones — COMPLETADO

- ✅ Vista semanal de inspecciones
- ✅ Carga masiva de siniestros
- ✅ Carga masiva de catálogos

### Fase 5: Avanzado — PLANIFICADO

**Q3 2026:**
- 📋 Liquidación Center — UI completa para liquidación
- 📋 Vendor Network — red de proveedores y órdenes de servicio
- 📋 Customer Portal — portal del cliente para seguimiento de caso
- 📋 Notificaciones por email/SMS

**Q4 2026:**
- 📋 Mobile Field App — inspecciones presenciales offline-first
- 📋 AI Services v1 — OCR de documentos, clasificación de daños
- 📋 Gestión de SLA con alertas
- 📋 Reportería avanzada con exportación

**2027:**
- 📋 Detección de fraude con ML
- 📋 Analítica predictiva
- 📋 Marketplace de servicios
- 📋 Integraciones con core systems de aseguradoras
- 📋 Expansión multi-país

---

## 7. Estado por Página

| Ruta | Estado | Conectado a DB |
|------|--------|----------------|
| `/dashboard` | Funcional (datos reales) | Sí |
| `/dashboard/claims` | ~100% (lista + filtros + exportar + workflow + audit log) | Sí |
| `/dashboard/claims/[id]` | Detalle con tabs + edición completa | Sí |
| `/dashboard/inspecciones` | Lista + detalle con tabs | Sí |
| `/dashboard/inspecciones/[id]` | 8 tabs funcionales (Acta, Checklist, Daños, Evidencias, Croquis, Firmas, Informe, Chat) | Sí |
| `/dashboard/agenda` | Vista semanal funcional | Sí |
| `/dashboard/catalogos/*` | 11 catálogos CRUD completo | Sí |
| `/dashboard/operaciones/carga-siniestros` | Carga masiva Excel | Sí |
| `/dashboard/operaciones/carga-catalogos` | Carga masiva Excel (6 catálogos) | Sí |
| `/dashboard/evidencias` | Redirige a /inspecciones | Sí |
| `/dashboard/informes` | Redirige a /inspecciones | Sí |
| `/dashboard/users` | Funcional | Sí |
| `/dashboard/companies` | Funcional | Sí |
| `/dashboard/configuracion` | Funcional | No (local) |

---

## 8. Convenciones de Código

- Usar **function components** en lugar de arrow functions para componentes React
- Usar `async/await` para operaciones asíncronas
- Preferir **Server Components** por defecto; usar `"use client"` solo cuando sea necesario
- Validar todos los inputs de usuario con **Zod**
- Usar **React Hook Form** para todos los formularios
- Mantener separación clara entre Server Actions y Client Components
- Usar `@nhost/nhost-js` para autenticación en Next.js (cookies via SessionStorage)
- No usar mocks ni funcionalidades simuladas — todo conectado a Nhost desde la primera versión

### Multi Tenant & Seguridad

- Todas las tablas deben tener `company_id` o `tenant_id`
- Implementar **Row Level Security (RLS)** en TODAS las tablas desde el inicio
- Nunca usar bypass de seguridad (`security definer` solo en funciones controladas)
- Usar `NHOST_ADMIN_SECRET` solo en server actions o Nhost Functions, nunca en cliente
- Auditoría completa: registrar quién crea/modifica/elimina registros

### Logging

```ts
import { logger } from "@/lib/logger";

// En catch blocks del frontend:
logger.error("Descripción del error", err, {
  component: "NombreComponente",
  action: "nombreAccion",
  metadata: { userId, extraData },
});
```

Todo error capturado en el frontend DEBE pasar por `logger.error()` con contexto.
Nunca usar `console.error()` directamente en producción.

---

## 9. Sistema de Estilos

### Tokens de Color

- Modo claro: fondo `#fafafa`, texto `#0a0a0a`, primario `#0a0a0a`, acento cálido `#fff7ed`
- Modo oscuro: fondo `#0c0c0e`, texto `#fafafa`, primario `#fafafa`
- Radio base: `0.75rem` (12px)
- Sombra de tarjeta: `0 1px 2px rgb(0 0 0 / 0.04), 0 4px 12px rgb(0 0 0 / 0.04)`

### Clases de Layout

```
.app-page          → max-w-6xl, flex flex-col gap-8
.app-page-header   → flex flex-col gap-1.5
.app-page-title    → text-lg/xl font-semibold
.app-page-lead     → text-[13px] text-muted-foreground
.app-panel         → rounded-xl border bg-card p-4 sm:p-6
.app-toolbar       → flex flex-col gap-3 sm:flex-row sm:justify-between
.glass-panel       → tarjeta con borde + sombra + fondo elevado
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

### Regla OBLIGATORIA de Botones

```
1. TEXTO: Siempre UNA sola palabra. NUNCA dos. NUNCA sin texto.
   Si se necesita contexto, usar un ícono, nunca texto extra.

   ✅ "Nuevo" "Editar" "Guardar" "Crear" "Cancelar" "Exportar"
   ✅ "Imprimir" "Eliminar" "Invitar" "Atrás" "Siguiente" "Cerrar"

   ❌ "Nuevo Siniestro" "Guardar Cambios" "Exportar CSV" "Crear Empresa"

2. COLORES: Solo dos clases de color para botones de acción.
   .btn-save  → azul  (Aceptar, Siguiente, Grabar, Crear, Guardar)
   .btn-cancel→ rosa  (Cancelar, Cerrar)
   NUNCA usar otros colores. NUNCA mezclar.

3. DIMENSIONES: Alto fijo 29px para todos. Ancho según contexto.
   .btn-sm  → w-[175px]  (pantallas de listado/catálogos)
   .btn-lg  → w-[225px]  (pantallas principales)
   Wizard footer → w-[122px] (Cancelar, Atrás, Siguiente, Crear)
```

### Regla de Combos (FormSelect) No Obligatorios

Todos los FormSelect que NO sean obligatorios (sin asterisco rojo `*`) DEBEN incluir
la prop `clearable` para permitir deseleccionar y volver al estado vacío.
Los FormSelect obligatorios (con `*`) NO deben tener `clearable`.

### Skins de Escritorio

5 pieles disponibles via `html[data-ui-style]`:
- `nordic-air` → DM Sans + Sora, radius 1rem
- `pastel-dream` → Quicksand + Manrope, radius 1.45rem
- `bubble-play` → Nunito + Fredoka, radius 1.85rem
- `kinetic-pop` → Space Grotesk + Syne, radius 0.45rem
- `neo-playful` → Bricolage + Unbounded, radius 1.15rem

### Regla General

```
Nunca usar colores hardcodeados (bg-blue-500). Siempre usar clases semánticas
(.btn-save, .btn-danger) o tokens CSS (var(--primary)).
Todos los modales DEBEN usar uno de los 3 tamaños canónicos.
Todas las tarjetas DEBEN usar glass-panel o app-panel.
```

---

## 10. Base de Datos

### Stack

- **PostgreSQL** (via Nhost)
- **Hasura** — GraphQL auto-generado sobre PostgreSQL
- **Migraciones** — SQL manuales versionadas en `migrations/`
- **Triggers** — auditoría automática (`audit_logs`), sincronización `status ↔ status_id`

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `companies` | Empresas/tenants |
| `profiles` | Perfiles de usuario |
| `claims` | Siniestros |
| `claims_participants` | Participantes del siniestro (asegurado, contratante, beneficiario) |
| `inspection_sessions` | Sesiones de inspección |
| `inspection_checklists` | Checklist de inspección |
| `inspection_damages` | Daños registrados |
| `inspection_evidences` | Evidencias multimedia |
| `inspection_signatures` | Firmas digitales |
| `inspection_reports` | Informes PDF |
| `inspection_chat_messages` | Chat por sesión |
| `audit_logs` | Auditoría automática |
| `magic_links` | Acceso mágico para inspecciones |

### Catálogos

| Tabla | Descripción |
|-------|-------------|
| `countries` / `regions` / `cities` / `communes` | Ubicación geográfica |
| `events` | Eventos catastróficos |
| `claim_types` | Tipos de siniestro |
| `claim_causes` | Causas de siniestro |
| `insurance_companies` | Compañías aseguradoras |
| `brokers` | Corredores |
| `advisors` | Asesores |
| `business_lines` | Líneas de negocio |
| `insurance_products` | Productos/ramos |
| `lookup_catalog` | Catálogo genérico (monedas, estados, tipos de construcción, etc.) |

### Sincronización `status ↔ status_id`

La tabla `claims` tiene dos campos para el estado:

- **`status`** (text) — código machine-readable: `created`, `in_review`, `signed`, `closed`, etc.
  Usado por la app para lógica de workflow (filtros, badges, transiciones).
- **`status_id`** (uuid FK) — referencia a `lookup_catalog` (category=`claim_status`).
  Usado para mostrar el nombre human-readable.

Un trigger bidireccional (`sync_claim_status`) los mantiene sincronizados:
- Si la app cambia `status` → el trigger busca y asigna el `status_id` correspondiente
- Si la app cambia `status_id` → el trigger busca y asigna el `status` correspondiente

> Ver migración 53 para detalles.

---

## 11. Decisiones Técnicas Definitivas

### 11.1 Migraciones SQL en Nhost / Hasura

Nhost no tiene CLI nativo para Windows. Se usa un script propio `scripts/db-push.ts`
con `node-postgres` (`pg`).

```
Toda migración nueva debe: (a) funcionar con pnpm db:push, y (b) poder ejecutarse
manualmente en Hasura SQL Editor.
```

### 11.2 No usar `CREATE POLICY IF NOT EXISTS`

PostgreSQL 14 (Nhost) no lo soporta. Usar:
```sql
DROP POLICY IF EXISTS "nombre_policy" ON tabla;
CREATE POLICY "nombre_policy" ON tabla ...;
```

### 11.3 No usar `TO authenticated` en Policies

`authenticated` no es un rol PostgreSQL nativo (es de Supabase). Usar `TO public`
y controlar acceso vía Hasura Permissions.

### 11.4 Flujo de Registro (Signup)

1. Signup puro: solo registrar en Nhost Auth, sin operaciones GraphQL
2. Si requiere verificación: mostrar pantalla de "Revisa tu correo"
3. Onboarding obligatorio: si el usuario no tiene `company_id`, redirigir a `/onboarding`
4. La empresa se crea DESPUÉS del login, no durante el registro
5. El trigger `handle_new_user` crea el `profile` automáticamente

### 11.5 Hasura: Track Tables Obligatorio

Después de cada migración que crea tablas nuevas, ir a Hasura Console → Data →
"Track All" para exponer las tablas en GraphQL.

### 11.6 SDK de Nhost v4

```ts
// Auth
const { body } = await nhost.auth.signInEmailPassword({ email, password });
if (body.session) { /* login OK */ }

// GraphQL
const { body } = await nhost.graphql.request({ query, variables });
if (body.errors) { throw new Error(...) }
return body.data;
```

Todas las llamadas al SDK Nhost v4 deben usar `.body` para acceder a los datos.

### 11.7 Onboarding de Empresa

Todo usuario autenticado DEBE tener una empresa asociada antes de acceder al dashboard.
El onboarding es una barrera obligatoria para usuarios sin `company_id`.

---

## 12. Comandos del Proyecto

```bash
pnpm dev          # Iniciar desarrollo
pnpm build        # Build de producción
pnpm lint         # Linting
pnpm db:push      # Ejecutar migraciones SQL en PostgreSQL
```

### Variables de Entorno (`.env.local`)

```env
NEXT_PUBLIC_NHOST_SUBDOMAIN=tu-subdomain
NEXT_PUBLIC_NHOST_REGION=eu-central-1
NEXT_PUBLIC_NHOST_AUTH_URL=https://auth.tu-proyecto.nhost.run
NEXT_PUBLIC_NHOST_GRAPHQL_URL=https://graphql.tu-proyecto.nhost.run/v1
NEXT_PUBLIC_NHOST_STORAGE_URL=https://storage.tu-proyecto.nhost.run
DATABASE_URL="postgres://postgres:password@host:port/database"
```

---

## 13. Deuda Técnica

| Item | Impacto | Recomendación |
|------|---------|---------------|
| Migraciones con nombre antiguo "Hub Inspections" | Bajo | Mantener como histórico |
| `localStorage` keys con nombre antiguo | Bajo | Migrar gradualmente |
| `assigned_adjuster_id` duplica `adjuster_id` | Bajo | Dropear en futuro |
| `broker_executive`, `internal_number` vacíos | Bajo | Dropear si no se usan |
| `type_id`, `service_type_id`, `billing_type_id`, `property_classification_id` sin datos | Bajo | Poblar o dropear |
| Participantes (`claims_participants`) con geo como texto | Medio | Considerar FKs geo si se normaliza |

---

## 14. Documentación Relacionada

- [`EXCEL_TO_DB_MAPPING.md`](./EXCEL_TO_DB_MAPPING.md) — Mapeo completo de columnas Excel → campos DB
- [`AGENTS.md`](./AGENTS.md) — Reglas del proyecto para agentes de desarrollo

---

*Documento vivo. Última actualización: Junio 2026.*
