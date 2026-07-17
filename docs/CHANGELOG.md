# Changelog — Claims Hub Platform

## [Última versión] — 2026-07-17

### Agregado
- **Migración 159: Catálogos de daños** — 3 tablas nuevas:
  - `damage_spaces` (22 espacios): Cocina, Baño, Dormitorio, Living, Garage, Oficina, etc.
  - `content_good_types` (16 tipos): Electrodomésticos, Electrónica, Móviles, Muebles, Ropa, Joyas, Maquinaria, etc.
  - `building_damage_categories` (13 categorías): Muros, Pisos, Cielos, Cubierta, Estructura, Eléctricas, etc.
  - 3 columnas nuevas en `inspection_damages`: `space_id`, `content_good_type_id`, `building_damage_category_id`
- **Migración 160: Terceros extendidos** — 5 columnas nuevas en `third_parties`:
  - `company_name`, `has_insurance`, `insurance_company`, `claim_number`, `notes`
  - Tercero responsable/culpable: datos para demanda (compañía + siniestro o demanda particular)
  - Tercero afectado: mismo esquema de daños que el asegurado (vía `third_party_id`)
- **Daños separados Constructivo vs Contenido**:
  - Tiles visuales con iconos de color (azul/violeta) para elegir tipo
  - Formulario dinámico según tipo (espacios+categorias vs tipos de bien+producto)
  - Tablas separadas con totales independientes
  - Selector de tercero afectado en ambos formularios
  - Badges de severidad con dark mode
  - Botón eliminar en color rose
- **Magic Link Sender** — 3 formas de enviar + copiar:
  - WhatsApp (wa.me): link pre-llenado, sin backend
  - WhatsApp Cloud API: envío directo via Meta API (1000/mes gratis)
  - Email (Resend): email HTML con botón de acceso (3000/mes gratis)
  - API route `/api/send-magic-link` con ambas integraciones
- **VoiceTextarea** — editor de texto enriquecido:
  - Negrilla (Ctrl+B), Cursiva (Ctrl+I), Listas, Corrección ortográfica
  - Transcripción por voz (Web Speech API, es-CL)
  - Usado en Relato de los Hechos y Observaciones del Inspector
- **Ordenamiento natural** en todos los catálogos (`naturalCompare`):
  - "1 Año" < "2 Años" < "10 años" (no alfabético)
  - `fetchAllSorted` reemplaza `order: name` de la BD
- **DropdownMenu y Popover**: `positionMethod="fixed"`, `z-9999`, `sideOffset=0`, sin isolate

### Corregido
- **Select simplificado**: sin patrón `__none`, placeholder nativo de base-ui
- **Acta-form**: ToggleChips con Label arriba (alineados con demás campos)
- **Otros Seguros**: movido a sección Parte Policial, Observaciones como panel aparte
- **Select nativo**: reemplazado por componente Select en paso 6 (terceros)

---

## [2026-07-07]

### Agregado
- **field_config dinámico**: Configuración de campos del acta por clasificación/destino del bien,
  guardada en BD (JSONB). Matriz visual con iconos Eye/EyeOff (sin checkboxes).
- **FieldConfigEditor**: Componente para editar field_config con labels personalizables.
- **Migraciones 156-158**: inspector fallback, third parties relacional, field_config catalogs.
- **Documentación**: docs/DESIGN_SYSTEM.md, docs/README.md, docs/ARCHITECTURE.md, docs/MIGRATIONS.md.

### Corregido
- **Select dropdown**: Agregado `SelectPrimitive.Portal` para escapar de modals con stacking context.
  Quitado `isolate` de overlays y positioners. `positionMethod="fixed"` + `z-9999`.
- **Select dropdown**: `sideOffset=0` (pegado al trigger), `collisionAvoidance` restaurado.
- **Botones estandarizados**: Todos los botones usan `pg-btn-platinum`. Eliminados
  `btn-danger`, `btn-neutral`, `btn-cancel`, `btn-close`, `btn-skip`, `btn-save`,
  `btn-create`, `liquid-button`, `liquid-button-outline`.
- **Filtros unificados**: claims e inspecciones usan el mismo formato que polizas
  (`app-input`, layout consistente).
- **Turbopack "Maximum call stack size exceeded"**: Causado por JSX con múltiples
  `className` en el mismo elemento (mass replacements fallidos). Revertido y
  aplicado manualmente archivo por archivo.

---

## Migraciones 154-155 — Auto Inspection Session + Magic Link

### Agregado
- **Migración 154**: Auto-creación de `inspection_session` cuando se emite COI.
  El trigger cascade crea INS + sesión de inspección automáticamente.
- **Migración 155**: Campo `inspector_id` en claims + magic link para inspecciones remotas.
  Genera token UUID con expiración de 24h para acceso sin login.

---

## Migraciones 152-153 — Limpieza de Roles y Triggers

### Agregado
- **Migración 152**: Eliminado rol `client_operator` (no se usa).
- **Migración 153**: Limpieza de triggers duplicados y roles obsoletos.

---

## Migración 151 — Perfiles Secundarios

### Agregado
- **Tabla `user_secondary_roles`**: Permite que un usuario tenga roles secundarios
  (adjuster, inspector, assistant, auditor, dispatcher) asociados a empresas.
- **Funciones SQL**: `get_users_by_role_for_company`, `get_users_by_roles_for_company`
  para obtener usuarios por rol (principal + secundario).
- **UI**: Sección "Perfiles Secundarios" en la página de usuarios.

---

## Migración 149-150 — Auto-asignación + Snapshot

### Agregado
- **Migración 149**: Auto-asignación de responsables al crear gestiones via workflow.
  Asigna `issuer_id`, `reviewer_id`, `approver_id` según `default_*_role` del template.
- **Migración 150**: Snapshot de datos del padre al crear gestión hija.

---

## Migraciones 135-148 — Sistema de Workflows

### Agregado
- **Migración 135-137**: `workflow_configs` + `workflow_steps` + unique constraints.
- **Migración 138**: RLS en tablas de workflow.
- **Migración 139**: `template_dependencies` para dependencias entre templates.
- **Migración 140-143**: Triggers cascade (v1 y v2) para crear gestiones hijas.
- **Migración 144-146**: Sync workflow + status + triggers online.
- **Migración 147**: Fix audit trigger + fix workflow triggers.
- **Migración 148**: No crear padre retroactivo si el hijo ya existe.

### Concepto
Cada combinación de país + línea + evento + estado tiene un workflow que define
qué gestiones se crean automáticamente y en qué orden. El workflow tiene
status: draft (editable), online (crea gestiones), suspended (pausado).

---

## Migraciones 100-134 — Coberturas, Reservas, Pólizas

### Agregado
- **Migración 100-104**: Informe de liquidación, coberturas y reservas, policy_coverages.
- **Migración 105-107**: Pólizas con múltiples líneas de negocio, backfill.
- **Migración 108-109**: Review levels entity, general fields toplevel.
- **Migración 110-111**: Screen layouts, document requests.
- **Migración 112-113**: Policy multiple business lines, coverage catalog.
- **Migración 114-116**: Coverage catalog country, document url, is_automatic.
- **Migración 117**: Claim documents + assistant role.
- **Migración 121-124**: Rejection fields, claim_action_history, profile extra fields, default roles.
- **Migración 125-134**: Fix claim action code format, FKs, inspection link, correlativo, reactivate, fixed screen, sync.

---

## Migraciones 090-099 — Gestión Screens

### Agregado
- **Migración 090-095**: Inspection action template, gestión screen types, relación screens.
- **Migración 096-099**: Gestión screens fields, form builder, simple system fields, new schema.

### Concepto
Las pantallas de gestión son dinámicas: se configuran en BD con campos,
tipos, layouts. `DynamicScreen.tsx` las renderiza según configuración.

---

## Migraciones 000-089 — Schema Inicial

### Agregado
- **Migración 000-01**: Schema inicial, tablas principales.
- **Migración 02**: Triggers de auditoría.
- **Migración 03-06**: Company fields, policies, countries, grants.
- **Migración 07-08**: Extend sessions/claims, inspection forms.
- **Migración 09-10**: Extend damages, remove legacy fields.
- **Migración 11-13**: Acta fields, catalogs, advisors.
- **Migración 14-19**: Audit triggers, regions/cities/communes, client catalogs, import claims, FKs.
- **Migración 89**: Field permissions.

---

## Componentes UI — Historial

### Select (combobox)
- **Commit bbf28a5**: Agregado `positionMethod="fixed"` para escapar de overflow.
- **Commit 9c79e23**: Agregado `SelectPrimitive.Portal` + quitado `isolate`.
- **Último**: `sideOffset=0`, `z-9999`, `collisionAvoidance` con `fallbackAxisSide: "none"`.

### FieldConfigEditor
- **Commit 7bf4825**: Creado componente con checkboxes (incorrecto).
- **Commit 9c79e23**: Rediseñado con iconos Eye/EyeOff (sin checkboxes), labels personalizables.

### Botones
- **Estandarización**: Todos los botones a `pg-btn-platinum`.
- **Eliminados**: btn-danger, btn-neutral, btn-cancel, btn-close, btn-skip, btn-save,
  btn-create, liquid-button, liquid-button-outline.
- **Texto**: 1 palabra máximo (Guardar, Cerrar, Cancelar, Crear, Nueva, Editar).

### Filtros de grilla
- **Unificación**: claims, inspecciones y polizas usan el mismo formato.
- `app-input` en vez de `liquid-search`.
- Layout consistente con `app-toolbar`.
