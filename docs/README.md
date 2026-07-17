# Claims Hub Platform — Documentación

> Plataforma de gestión de siniestros, inspecciones y liquidación de seguros.
> Next.js 16 + Supabase + TypeScript.

---

## Documentación Obligatoria

| Archivo | Descripción | Cuándo leerlo |
|---------|-------------|---------------|
| **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** | Reglas de diseño UI/UX obligatorias | **ANTES de tocar cualquier .tsx** |
| **[../AGENTS.md](../AGENTS.md)** | Reglas del proyecto, stack, arquitectura, decisiones técnicas | Al iniciar cualquier tarea |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Arquitectura del proyecto, estructura de carpetas, módulos | Al entender el proyecto |
| **[MIGRATIONS.md](./MIGRATIONS.md)** | Historial de migraciones de base de datos (000-158) | Al tocar la BD |
| **[CHANGELOG.md](./CHANGELOG.md)** | Historial de cambios y features implementadas | Al revisar qué se ha hecho |

---

## Stack Tecnológico

- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript (estricto)
- **Estilos:** Tailwind CSS v4 + clases semánticas (`app-*`, `modal-*`, `pg-btn-*`)
- **UI:** shadcn/ui + base-ui (Select, Dialog, Popover, DropdownMenu)
- **Formularios:** React Hook Form + Zod
- **Estado:** TanStack Query (React Query)
- **Backend:** Supabase (PostgreSQL + PostgREST + Auth + Storage)
- **Iconos:** lucide-react
- **Toasts:** sonner
- **Package manager:** pnpm
- **Deploy:** Vercel

---

## Módulos de la Aplicación

### 1. Dashboard (`/dashboard`)
- Página principal con KPIs y estadísticas
- Topbar con stats en tiempo real
- Navegación lateral con dock magnification

### 2. Siniestros (`/dashboard/claims`)
- **Lista** (`page.tsx`): grilla con filtros (buscar, estado, compañía, línea)
- **Detalle** (`[id]/page.tsx`): tabs del siniestro
- **Edición** (`[id]/edit-claim-form.tsx`): formulario completo de edición
- **Gestiones** (`[id]/gestiones/[actionId]/page.tsx`): gestión individual
- **Pantallas de gestión** (`[id]/gestion-screens/`):
  - `DynamicScreen.tsx` — pantalla genérica dinámica
  - `CoberturasScreen.tsx` — ingreso de coberturas (COB)
  - `ReservaScreen.tsx` — reserva (RES)
  - `CoordinacionScreen.tsx` — coordinación de inspección (COI)
  - `SolicitudDocumentosScreen.tsx` — solicitud de documentos
  - `EmailScreen.tsx` / `EmailViewScreen.tsx` — envío y vista de emails
  - `LiquidacionScreen.tsx` — informe de liquidación
  - `GenericaScreen.tsx` — pantalla genérica
- **Workflow view** (`[id]/workflow-view.tsx`): visualización del workflow
- **Documentos** (`[id]/claim-documents-tab.tsx`): pestaña de documentos
- **Audit log** (`[id]/audit-log-section.tsx`): historial de auditoría

### 3. Inspecciones (`/dashboard/inspecciones`)
- **Lista** (`page.tsx`): grilla con filtros
- **Detalle** (`[id]/page.tsx`): tabs de la inspección
- **Acta** (`[id]/acta-form.tsx`): formulario del acta con field_config dinámico
  - 6 pasos: Datos Generales, Riesgo Siniestrado, Materialidad, Seguridad, Declaración, Terceros
  - Campos dinámicos según clasificación + destino del bien (field_config desde BD)
- **Tabs**: chat, checklist, damages, evidences, report, signatures, sketches

### 4. Catálogos (`/dashboard/catalogos`)
- **antiguedades** — antigüedades de construcción
- **asesores** — asesores/comercializadores
- **causas** — causas de siniestro
- **clasificacion-bien** — clasificaciones del bien (con field_config)
- **clasificacion-danos** — clasificaciones de daño
- **coberturas** — catálogo de coberturas
- **companias** — compañías aseguradoras
- **corredores** — corredores de seguros
- **destinos-vivienda** — destinos de vivienda (con field_config)
- **eventos** — eventos/países
- **gestiones** — templates de gestiones
- **inspeccion** — catálogos de inspección
- **lineas-negocio** — líneas de negocio
- **pantallas** — pantallas de gestión (gestion_screens)
- **parentescos** — parentescos
- **polizas** — pólizas
- **productos** — productos de seguro
- **tipos-documentos** — tipos de documento
- **tipos-polizas** — tipos de póliza
- **tipos-siniestros** — tipos de siniestro
- **ubicaciones** — regiones/ciudades/comunas
- **workflows** — configuración de workflows

### 5. Usuarios (`/dashboard/users`)
- Lista de usuarios con roles principales y secundarios
- Asignación de clientes (companies)
- Perfiles secundarios (adjuster, inspector, assistant, auditor, dispatcher)

### 6. Permisos (`/dashboard/permisos`)
- Permisos por tipo de usuario (can_view, can_edit, can_create, can_delete)

### 7. Empresas (`/dashboard/companies`)
- CRUD de empresas/compañías

### 8. Agenda (`/dashboard/agenda`)
- Calendario de inspecciones y gestiones

### 9. Configuración (`/dashboard/configuracion`)
- Configuración general del sistema

### 10. Operaciones (`/dashboard/operaciones`)
- Vista de operaciones

### 11. Informes (`/dashboard/informes`)
- Reportes y estadísticas

### 12. Propuestas (`/dashboard/propuestas`)
- Propuestas de liquidación

### 13. Mis Casos (`/dashboard/mis-casos`)
- Casos asignados al usuario actual

---

## Estructura de Carpetas

```
src/
├── app/                    # Rutas Next.js App Router
│   ├── dashboard/          # Páginas del dashboard
│   │   ├── catalogos/      # Catálogos (CRUD)
│   │   ├── claims/         # Siniestros
│   │   ├── inspecciones/   # Inspecciones
│   │   ├── users/          # Usuarios
│   │   ├── companies/      # Empresas
│   │   ├── agenda/         # Agenda
│   │   ├── permisos/       # Permisos
│   │   └── ...
│   ├── styles/             # CSS modular
│   │   ├── buttons.css     # pg-btn-platinum
│   │   ├── forms.css       # app-input, app-field-label
│   │   ├── modals.css      # modal-md, modal-header, modal-footer
│   │   ├── components.css  # app-panel, app-data-table, app-toolbar
│   │   ├── dashboard.css   # layout dashboard
│   │   └── animations.css  # animaciones
│   ├── globals.css         # Variables globales
│   └── ui-style-skins.css  # Skins/temas
├── components/
│   └── ui/                 # Componentes UI (shadcn/ui + custom)
│       ├── select.tsx      # Select con Portal + positionMethod fixed
│       ├── dialog.tsx      # Modal
│       ├── field-config-editor.tsx  # Matriz de campos (Eye/EyeOff)
│       ├── button.tsx      # Botón base
│       ├── input.tsx       # Input base
│       ├── pagination.tsx  # Paginación
│       ├── sortable-th.tsx # Header ordenable
│       ├── status-badge.tsx# Badge de estado
│       ├── toggle-chip.tsx # Toggle visual (no checkbox)
│       └── ...
├── hooks/                  # Custom hooks
│   ├── use-auth.ts         # Autenticación
│   ├── use-permissions.ts  # Permisos (canCreate, canEdit, canDelete)
│   ├── use-pagination.ts   # Paginación
│   ├── use-table-sort.ts   # Ordenamiento de tablas
│   ├── use-lookup-catalog.ts # Catálogos lookup
│   └── ...
├── services/               # Lógica de acceso a datos (Supabase)
│   ├── catalogs.ts         # Catálogos (CRUD)
│   ├── claims.ts           # Siniestros
│   ├── claim-actions.ts    # Gestiones del siniestro
│   ├── inspections.ts      # Inspecciones
│   ├── policies.ts         # Pólizas
│   ├── users.ts            # Usuarios
│   ├── permissions.ts      # Permisos
│   └── ...
├── lib/                    # Utilidades
│   ├── supabase/           # Cliente Supabase
│   ├── validations.ts      # Schemas Zod
│   ├── utils.ts            # cn() y utilidades
│   └── ...
├── types/                  # Tipos TypeScript
│   └── index.ts            # Todos los tipos del dominio
└── migrations/             # Migraciones SQL (000-158)
```

---

## Componentes UI Clave

### Select (combobox)
- **Archivo:** `src/components/ui/select.tsx`
- **Características:** Portal + positionMethod="fixed" + z-9999
- **Regla:** Siempre abajo, pegado al trigger (sideOffset=0)

### Dialog (modal)
- **Archivo:** `src/components/ui/dialog.tsx`
- **Características:** z-50, sin isolate en overlay

### FieldConfigEditor (matriz de campos)
- **Archivo:** `src/components/ui/field-config-editor.tsx`
- **Características:** Iconos Eye/EyeOff (sin checkboxes), labels personalizables
- **Uso:** Clasificación del Bien + Destinos de Vivienda

### ToggleChip (toggle visual)
- **Archivo:** `src/components/ui/toggle-chip.tsx`
- **Características:** Reemplaza checkboxes con chips visuales

---

## Migraciones de Base de Datos

Ver [MIGRATIONS.md](./MIGRATIONS.md) para el historial completo.

### Migraciones clave
- **000-019**: Schema inicial, tablas, triggers, catálogos base
- **090-099**: Gestión screens, form builder
- **100-120**: Coberturas, reservas, pólizas, documentos
- **121-140**: Rejection, audit, workflow configs, cascade triggers
- **141-150**: is_active, dependencies, cascade v2, sync workflow
- **135-148**: Sistema de workflows automáticos
- **149**: Auto-asignación de responsables
- **150**: Snapshot parent data
- **151**: Perfiles secundarios de usuarios
- **152-153**: Limpieza de roles y triggers
- **154-155**: Auto inspection session + magic link
- **156-158**: Inspector fallback, third parties, field_config

---

## Reglas Críticas (Resumen)

1. **LEER `docs/DESIGN_SYSTEM.md` antes de tocar cualquier `.tsx`**
2. **Botones:** `pg-btn-platinum`, texto de 1 palabra
3. **Inputs:** `app-input`, labels `app-field-label`
4. **Selects:** Portal + fixed + z-9999, siempre abajo
5. **NO checkboxes:** usar Eye/EyeOff o ToggleChip
6. **NO isolate** en overlays/positioners
7. **Iconos:** lucide-react únicamente
8. **field_config:** todo dinámico desde BD, nada hardcoded
9. **Permisos:** canCreate/canEdit/canDelete en todas las acciones
10. **Idioma:** español (Chile)
11. **tsc + eslint:** 0 errores, 0 warnings, SIEMPRE
