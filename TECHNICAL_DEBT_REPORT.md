# TECHNICAL DEBT REPORT

## Claims Hub Platform — Análisis de Deuda Técnica

---

## Hallazgos

### 1. Migraciones SQL Comentadas como Historial

**Archivos**: `migrations/*.sql` (40+ archivos)

**Problema**: Comentarios de encabezado en todas las migraciones hacen referencia al nombre antiguo "Hub Inspections". No afectan funcionalidad, pero dificultan la búsqueda contextual.

**Impacto**: Bajo
**Recomendación**: Mantener como histórico. Documentar en `DATABASE_REBRANDING_RECOMMENDATIONS.md`.

---

### 2. Claves de Almacenamiento Local con Nombre Antiguo

**Archivos**:
- `src/lib/request-logger.ts` — `STORAGE_KEY = 'hubinspection-diag-log-enabled'`
- `src/lib/ui-style-client-store.ts` — `UI_STYLE_KEY = "hubinspection-ui-style"`

**Problema**: Si un usuario tiene datos guardados con la clave antigua, cambiar la clave haría que se pierdan las preferencias.

**Impacto**: Medio
**Recomendación**: Crear un mecanismo de migración:
```typescript
const LEGACY_KEY = 'hubinspection-ui-style';
const NEW_KEY = 'claimshub-ui-style';
// Al iniciar, leer legacy y migrar a new
```

---

### 3. Nombre del Proyecto en package.json

**Archivo**: `package.json`

**Problema**: `"name": "hub-inspection"` es el identificador npm. Cambiarlo afecta lockfiles y posibles scripts.

**Impacto**: Medio
**Recomendación**: Cambiar a `"claims-hub"`. Verificar que `pnpm install` siga funcionando.

---

### 4. Queries GraphQL sin Variables Tipadas

**Archivos**: `src/services/*.ts`

**Problema**: Algunas queries usan string interpolation para construir filtros (`where: { _eq: "${id}" }`). Esto es vulnerable a inyección si no se sanitiza.

**Impacto**: Alto
**Recomendación**: Usar siempre variables GraphQL:
```graphql
query GetClaims($companyId: uuid!) {
  claims(where: { company_id: { _eq: $companyId } }) { ... }
}
```

**Estado**: Parcialmente corregido en claims más recientes.

---

### 5. Magic Links con Token en URL

**Archivo**: `src/services/inspections.ts`

**Problema**: Los magic links exponen el token en la URL del navegador.

**Impacto**: Medio
**Recomendación**: Implementar expiración corta (15 min) y one-time use. Considerar enviar por SMS en lugar de URL pública.

---

### 6. Carga de Catálogos por Nombre (no por ID)

**Archivo**: `src/app/dashboard/claims/page.tsx`

**Problema**: Los selects de país/region/ciudad/comuna usan `name` como value, lo que requiere lookup por nombre en vez de ID.

**Impacto**: Medio
**Recomendación**: Usar IDs como value y mantener un mapa de nombres para display. Evita problemas con nombres duplicados o cambios.

---

### 7. CSS Custom con !important Masivo

**Archivos**: `src/app/styles/modals.css`, `buttons.css`, `forms.css`

**Problema**: Uso extensivo de `!important` para "inmunizar" estilos de skins. Dificulta debugging y overrides.

**Impacto**: Bajo
**Recomendación**: Considerar CSS layers (`@layer`) en Tailwind v4 para manejo de especificidad sin `!important`.

---

### 8. Componentes sin Tests

**Archivo**: Todo el proyecto

**Problema**: No hay suite de tests unitarios ni de integración.

**Impacto**: Alto
**Recomendación**: Implementar:
- Vitest para unit tests
- Playwright para E2E (flujos críticos: login, crear siniestro, iniciar inspección)
- MSW para mock de GraphQL en tests

---

### 9. TypeScript Strictness

**Archivo**: `tsconfig.json`

**Problema**: Algunos componentes usan `any` o `unknown` sin narrowing adecuado (especialmente en servicios GraphQL).

**Impacto**: Medio
**Recomendación**: Aumentar strictness gradualmente:
- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`

---

### 10. Dependencias Obsoletas o Sin Uso

**Archivo**: `package.json`

**Problema**: `xlsx` está presente pero el módulo de carga masiva es incompleto.

**Impacto**: Bajo
**Recomendación**: Revisar bundle con `pnpm build --analyze` y eliminar dead code.

---

## Resumen de Prioridades

| # | Deuda | Prioridad | Esfuerzo Estimado |
|---|-------|-----------|-------------------|
| 1 | Tests automatizados | Alto | 2 semanas |
| 2 | GraphQL variables tipadas | Alto | 3 días |
| 3 | TypeScript strict | Medio | 1 semana |
| 4 | Storage keys legacy | Medio | 1 día |
| 5 | CSS !important | Bajo | 3 días |
| 6 | xlsx dependency review | Bajo | 1 día |

---

## Recomendación

Atacar deuda técnica en sprints dedicados (1 por mes). No bloquear features de negocio, pero reservar 20% de capacidad del equipo para reducir deuda.
