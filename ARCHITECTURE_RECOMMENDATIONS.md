# ARCHITECTURE RECOMMENDATIONS

## Claims Hub Platform — Arquitectura y Crecimiento Futuro

---

## Arquitectura Actual

### Stack Base (Sólido)

| Capa | Tecnología | Evaluación |
|------|-----------|------------|
| Frontend | Next.js 16 + App Router | Excelente. RSC, streaming, edge-ready |
| Estilos | Tailwind CSS v4 | Excelente. Utility-first, tree-shakeable |
| UI Components | shadcn/ui | Excelente. Basado en Radix, accesible |
| Estado Global | Zustand | Bueno. Ligero, TypeScript-friendly |
| Cache | TanStack Query | Excelente. Stale-while-revalidate, optimistic |
| Formularios | React Hook Form + Zod | Excelente. Performance + validación type-safe |
| Backend | Nhost (Hasura + PostgreSQL + Auth) | Bueno. GraphQL auto-generado, RLS |
| Auth | Nhost Auth v4 | Bueno. OAuth, MFA, webhooks |
| Storage | Nhost Storage | Adecuado. S3-compatible |
| Deploy | Vercel | Excelente. Edge, CI/CD nativo |

### Estructura de Features

```
src/
├── app/              # Next.js App Router
├── components/       # UI compartido (shadcn + custom)
├── hooks/            # Custom hooks
├── lib/              # Utilidades, configuraciones
├── services/         # GraphQL clients (Nhost)
├── server/           # Server Actions
├── types/            # TypeScript globals
└── features/         # (preparado para expansión)
```

---

## Recomendaciones de Arquitectura

### 1. Módulos de Negocio (Feature-Based)

Organizar el código por dominio de negocio:

```
src/features/
├── claims/           # Core Claims (existente)
├── inspections/      # Inspecciones remotas/presenciales (existente)
├── evidence/         # Evidencias y documentos (existente)
├── agenda/           # Calendario y scheduling (existente)
├── liquidation/      # Liquidación Center (fase 2)
├── vendor-network/   # Red de proveedores (fase 2)
├── customer-portal/  # Portal del cliente (fase 3)
├── mobile-sync/      # Offline sync para mobile (fase 3)
└── ai-services/      # Servicios de IA (fase 3)
```

### 2. Capa API / BFF

Considerar agregar una capa de Backend-for-Frontend:

```
src/api/
├── claims.ts         # Aggregator de claims + participants
├── inspections.ts    # Aggregator de inspecciones
├── reports.ts        # Generación de reportes
└── ai/               # Endpoints para IA
```

**Justificación**: Hasura GraphQL es excelente para CRUD, pero para operaciones complejas (aggregations, joins masivos, ML inference) puede ser limitado.

### 3. Event-Driven Architecture (Futuro)

Para workflows avanzados (SLAs, notificaciones, asignaciones automáticas):

```
Nhost Functions (serverless)
├── on-claim-created/     # Enviar notificaciones
├── on-inspection-completed/  # Actualizar estado, generar PDF
├── on-sla-breach/        # Alertar supervisor
└── on-fraud-flag/        # Escalar a auditoría
```

### 4. Caché de Catálogos

Los catálogos (claim_types, insurance_companies, etc.) cambian poco. Implementar:

- **TanQuery con staleTime largo** (ya implementado parcialmente)
- **SSR para catálogos** en páginas de dashboard

### 5. Real-time

Para chat de inspección y notificaciones:

- **Hasura Subscriptions** para chat en vivo (ya tiene tablas)
- **Nhost Functions + WebSockets** para notificaciones push
- **Server-Sent Events** para notificaciones del browser

---

## Escalabilidad

### Horizontal

- Nhost soporta sharding de PostgreSQL en tier enterprise
- Hasura caching con Redis (tier enterprise)
- CDN para assets estáticos (Vercel Edge)

### Vertical

- Next.js App Router permite partial prerendering
- Streaming de datos con Suspense
- Code splitting automático por ruta

---

## Seguridad

### Estado Actual (Bueno)

- RLS en PostgreSQL
- Hasura permissions por rol
- Auth con JWT de Nhost
- XSS/CSRF protegido por Next.js

### Recomendaciones Futuras

1. **Rate limiting** en API routes (ya tiene `/api/logs`)
2. **Content Security Policy** en headers
3. **Audit logging** completo (ya implementado en PostgreSQL)
4. **Data encryption at rest** (Nhost lo soporta en tiers superiores)
5. **API key management** para integraciones con aseguradoras

---

## Integraciones Futuras

| Sistema | Propósito | Prioridad |
|---------|----------|-----------|
| LiveKit | Videollamadas (ya implementado) | — |
| OpenRouter / Claude | Análisis de daños con IA | Medio |
| SendGrid / Resend | Emails transaccionales | Alto |
| Twilio | SMS para magic links | Medio |
| S3 / R2 | Storage de archivos masivos | Medio |
| Slack / Teams | Notificaciones internas | Bajo |

---

## Conclusión

La arquitectura actual es **sólida y escalable**. Las decisiones técnicas (Next.js 16, Nhost, Tailwind, shadcn) son modernas y soportan la visión de Claims Hub Platform. El crecimiento hacia nuevos módulos no requiere reescritura — solo extensión disciplinada.
