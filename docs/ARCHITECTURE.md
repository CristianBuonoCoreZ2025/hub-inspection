# Arquitectura — Claims Hub Platform

## Visión General

Plataforma SaaS multi-tenant para gestión de siniestros de seguros, inspecciones
y liquidación. Construida con Next.js 16 (App Router) + Supabase.

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│  Next.js 16 (App Router) + TypeScript + Tailwind v4  │
│  shadcn/ui + base-ui + TanStack Query                │
├─────────────────────────────────────────────────────┤
│                    Backend                            │
│  Supabase (PostgreSQL + PostgREST + Auth + Storage)  │
│  Row Level Security en todas las tablas              │
│  Triggers SQL para workflows automáticos             │
├─────────────────────────────────────────────────────┤
│                  Deploy                               │
│  Vercel (frontend) + Supabase (backend)              │
└─────────────────────────────────────────────────────┘
```

## Flujo de Datos

```
Usuario → Next.js Client Component
  → TanStack Query (cache)
    → services/*.ts (lógica de acceso)
      → @/lib/supabase/db.ts (fetchAll, fetchById, insertRow, updateRow)
        → Supabase PostgREST API
          → PostgreSQL (con RLS)
```

## Multi-Tenant

- Toda tabla tiene `company_id` o `tenant_id`
- RLS en TODAS las tablas desde el inicio
- `SUPABASE_SERVICE_ROLE_KEY` solo en server actions, nunca en cliente
- Auth via `@supabase/ssr` con cookies en middleware

## Sistema de Workflows

```
workflow_configs (país + línea + evento + estado → config)
  └── workflow_steps (cada step = una gestión)
        · level 1 = raíz (se crea al entrar al estado)
        · level 2+ = dependiente (se crea al cerrar su padre)
        · is_automatic = el workflow lo crea solo
        · is_required = se recrea si se rechaza
```

### Triggers SQL
1. **execute_workflow_on_status_change** — crea gestiones nivel 1 al cambiar estado
2. **cascade_on_issue** — crea gestiones hijas al emitir una gestión
3. **recreate_on_reject** — recrea gestiones is_required rechazadas

## Cadena de Gestiones

```
COB (Coberturas) → RES (Reserva) → PCA (Ajuste)
NSA (Notificación) → RTA (Recepción Antecedentes)
COI (Coordinación) → INS (Inspección)
```

## Inspecciones

- Las inspecciones SOLO se crean via workflow (gestión COI → INS)
- El módulo de Inspecciones es solo lectura/resolución
- El acta tiene campos dinámicos según field_config (BD)

## Configuración Dinámica (field_config)

```
property_classifications.field_config (JSONB)
housing_destinations.field_config (JSONB)

JSON: { show: [], hide: [], labels: {} }

Merge en frontend:
1. Base siempre visibles: age_years, owner_name, worker_resident_count
2. + classification.show
3. + destination.show
4. - classification.hide
5. - destination.hide
6. Label: classification.labels > destination.labels > default
```

## Registro de Daños

### Separación inicial
Al registrar un daño, primero se elige entre:
1. **Daño Constructivo** (edificio/estructura)
2. **Daño de Contenido** (artículos/bienes)

### Daño Constructivo → organizado por ESPACIO/RECINTO
- Catálogo `damage_spaces` (22 espacios): Cocina, Baño, Dormitorio, Living, Garage, etc.
- Catálogo `building_damage_categories` (13): Muros, Pisos, Cielos, Cubierta, Estructura, etc.
- Campos: Espacio, Categoría, Severidad, Descripción, Materialidad, Cantidad/Unidad, Monto

### Daño de Contenido → organizado por TIPO DE BIEN
- Catálogo `content_good_types` (16 tipos): Electrodomésticos, Electrónica, Móviles, Muebles, Ropa, Joyas, Maquinaria, etc.
- Campos: Tipo de Bien, Producto, Marca/Modelo, Fecha Compra, Severidad, Cantidad, Monto
- Espacio opcional (solo si se puede ubicar, ej: TV en Living)

### Terceros
- **Responsable/Culpable**: datos para demanda
  - `has_insurance`: si tiene seguro → `insurance_company` + `claim_number` (demanda a su compañía)
  - Si no tiene seguro → demanda particular
  - `company_name`: si es empresa
- **Afectado**: mismo esquema de daños que el asegurado
  - Sus daños se asocian vía `third_party_id` en `inspection_damages`
  - Selector de tercero afectado en el formulario de daños

### Ordenamiento natural
Todos los catálogos usan `naturalCompare` (extrae números y los ordena como números):
"1 Año" < "2 Años" < "10 años" (no alfabético)

## Roles y Permisos

### Roles principales
- `internal` — interno (acceso a todo)
- `adjuster` — liquidador
- `inspector` — inspector
- `assistant` — asistente
- `auditor` — auditor
- `dispatcher` — despachador
- `client_operator` — operativo del cliente

### Roles secundarios
- Permite que un usuario aparezca en combos de asignación adicionales
- No controlan acceso a páginas
- `internal` nunca puede ser secundario

### Permisos
- `user_type_permissions`: can_view, can_edit, can_create, can_delete por sección
- Hook `usePermissions()` expone canCreate, canEdit, canDelete

## Estructura de Archivos CSS

```
src/app/
├── globals.css              # Variables CSS, reset, base
├── ui-style-skins.css       # Skins/temas visuales
└── styles/
    ├── buttons.css          # .pg-btn-platinum y variantes
    ├── forms.css            # .app-input, .app-field-label
    ├── modals.css           # .modal-md, .modal-header, .modal-footer
    ├── components.css       # .app-panel, .app-data-table, .app-toolbar
    ├── dashboard.css        # Layout del dashboard
    └── animations.css       # Animaciones de entrada/salida
```

## Convenciones de Naming

### Clases CSS semánticas
- `app-*` — componentes de página (app-page, app-panel, app-input, app-toolbar)
- `modal-*` — componentes de modal (modal-md, modal-header, modal-footer, modal-field)
- `pg-btn-*` — botones (pg-btn-platinum)
- `btn-icon`, `btn-icon-sm` — botones de icono en grillas

### Archivos
- Páginas: `page.tsx` (App Router)
- Layouts: `layout.tsx`
- Componentes de página: `[componente].tsx` en la misma carpeta
- Servicios: `src/services/[dominio].ts`
- Hooks: `src/hooks/use-[nombre].ts`
- Tipos: `src/types/index.ts` (todo en un archivo)

## Decisiones Técnicas Clave

1. **Select con Portal:** El dropdown se renderiza en `<body>` via `SelectPrimitive.Portal`
   para escapar de modals con stacking context. `positionMethod="fixed"` + `z-9999`.

2. **Sin checkboxes:** El usuario prohibió checkboxes. Se usan iconos Eye/EyeOff
   y ToggleChip para toggles visuales.

3. **field_config en BD:** La configuración de campos del acta es dinámica,
   guardada en JSONB en la base de datos. Nada hardcoded.

4. **Autoguardado:** Las pantallas de gestión no tienen botón "Guardar".
   Todo se guarda con debounce 500ms.

5. **Workflow automático:** Las gestiones se crean automáticamente según
   el workflow configurado. No se crean manualmente.

6. **Inspecciones via workflow:** Las inspecciones solo nacen de la gestión
   COI → INS. El módulo de inspecciones es solo lectura/resolución.
