# Plan de Inspección y Agendamiento — Hub Inspections

> Documento de flujo de trabajo (workflow) propuesto. Este documento es editable: si el flujo no refleja correctamente la operación real, modificarlo antes de construir el código.

---

## 1. Concepto Central

Un **siniestro (claim)** es el origen. De un siniestro se desprenden **sesiones de inspección**. Cada sesión de inspección contiene:

- El **Acta de Inspección** (datos del riesgo, materialidad, seguridad, declaración del asegurado, terceros)
- El **registro de daños** (edificio y contenido)
- Las **evidencias multimedia** (fotos, videos, documentos)
- El **croquis** de áreas afectadas
- Las **firmas digitales** (inspector + asegurado)
- Las **observaciones finales** del inspector
- El **informe PDF** generado

> **Regla del flujo:** No existe inspección sin siniestro. No se agenda una inspección sin un siniestro asociado. No se genera informe sin daños registrados.

---

## 2. Diagrama de Flujo Principal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUJO DE INSPECCIÓN                                │
└─────────────────────────────────────────────────────────────────────────────┘

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

---

## 3. Estados de una Sesión de Inspección

| Estado | Descripción | Transiciones posibles |
|--------|-------------|----------------------|
| `pending` | Sesión creada, sin fecha asignada | → `scheduled` (agendar) |
| `scheduled` | Fecha asignada, aparece en Agenda | → `active` (iniciar) / → `cancelled` (cancelar) |
| `active` | Inspector en terreno, completando Acta | → `completed` (finalizar) / → `cancelled` (cancelar) |
| `completed` | Acta, daños, evidencias y firmas listos | → (generar informe) |
| `cancelled` | Inspección cancelada | → (no hay retorno) |

> **Nota:** El estado `completed` de la sesión de inspección NO es lo mismo que el estado `signed` del siniestro. Un siniestro puede tener múltiples sesiones de inspección.

---

## 4. Flujo de Agendamiento (Agenda / Calendar)

```
AGENDA — Vista Calendario
│
├─ Mostrar inspecciones SCHEDULED + ACTIVE en el calendario
├─ Filtros:
│   ├─ Por inspector (dropdown de perfiles con rol inspector)
│   ├─ Por estado (todos, scheduled, active, completed, cancelled)
│   └─ Por rango de fechas
├─ Acciones por evento:
│   ├─ Click → Ver detalle de la sesión
│   ├─ Reagendar → Cambiar `scheduled_at`
│   ├─ Cancelar → Estado → cancelled
│   └─ Iniciar → Estado → active (si es el día)
└─ Crear nueva inspección → Redirige a siniestros para crear sesión
```

> **Regla:** No se crea una inspección desde la Agenda directamente. La Agenda es solo una **vista del calendario** de las inspecciones ya creadas desde los siniestros.

---

## 5. Flujo del Acta de Inspección (Wizard paso a paso)

Cuando una sesión está en estado `active`, el inspector completa el Acta en este orden:

### Paso 1: Datos Generales de la Sesión
- `inspection_date` — Fecha en que se realizó la inspección
- `inspection_time` — Hora de la inspección
- `interviewed_name` — Nombre del entrevistado
- `interviewed_email` — Email del entrevistado
- `interviewed_relationship` — Relación con el asegurado
- `police_report_number` — Número de parte policial
- `police_report_name` — Nombre del denunciante
- `police_report_rut` — RUT del denunciante
- `firefighters_company` — Compañía de bomberos
- `other_insurances` — ¿Tiene otros seguros? (checkbox)
- `other_insurance_company` — Nombre de la compañía
- `inspector_observations` — Observaciones finales del inspector

### Paso 2: Descripción del Riesgo Siniestrado (property_risk)
- `risk_type` — Tipo de riesgo (habitacional, comercial, etc.)
- `risk_class` — Clase de riesgo
- `property_type` — Tipo de inmueble (casa, departamento, bodega, oficina)
- `apartment_number` — Número de departamento
- `floor_count` — N° de pisos
- `age_years` — Antigüedad (años)
- `built_surface` — Superficie construida (m²)
- `room_count` — Cantidad de espacios (dormitorios, baños, oficinas, bodegas)
- `bathroom_count` — Cantidad de baños
- `office_count` — Oficinas
- `warehouse_count` — Bodegas
- `is_habitable` — ¿Habitado? (sí/no)
- `owner_name` — Nombre del propietario
- `branch_count` — Sucursales
- `worker_resident_count` — Trabajadores / habitantes
- `business_line` — Rubro de la empresa

### Paso 3: Materialidad del Inmueble (property_materiality)
- `walls` — Muros
- `roof` — Cubierta / Techumbre
- `interior_flooring` — Pavimentos interiores
- `interior_ceilings` — Cielos interiores
- `interior_finishes` — Terminaciones interiores
- `exterior_finishes` — Terminaciones exteriores
- `perimeter_closure` — Cierre perimetral
- `others` — Otros

### Paso 4: Medidas de Asegurabilidad (security_measures)
Checklist SI / NO con detalle para cada item:
- Protecciones generales
- Chapas / cerraduras de seguridad
- Guardias de seguridad
- Alarmas
- Cámaras
- Otras medidas

### Paso 5: Declaración del Asegurado (insured_statement)
- `statement` — Relato de los hechos
- `entry_exit_point` — Punto de entrada/salida
- `alarm_activation` — Activación de alarma
- `stolen_items_estimate` — Estimación de objetos sustraídos
- `vehicle_use` — Uso de vehículos
- `incident_duration` — Duración del incidente

### Paso 6: Datos de Terceros (third_parties)
Tabla editable con:
- `party_type`: afectado / responsable
- `full_name`, `rut`, `address`, `commune`, `phone`, `email`

---

## 6. Flujo de Registro de Daños

Después del Acta, se registran los daños en una tabla. Cada fila es un daño:

| Campo | Descripción |
|-------|-------------|
| `damage_type` | Edificio / Contenido |
| `dependency` | Dependencia afectada (ej: "Edificio comunidad Lyon") |
| `sector` | Sector específico (ej: "Dpto 606") |
| `category` | Categoría del daño |
| `subcategory` | Subcategoría |
| `description` | Descripción del daño |
| `materiality_type` | Tipo-Materialidad |
| `unit` | Unidad de medida |
| `quantity` | Cantidad |
| `severity` | Baja / Media / Alta / Total |
| `estimated_amount` | Monto estimado |

### Daño de Contenido (campos adicionales):
- `product` — Nombre del producto
- `brand_model` — Marca/Modelo
- `purchase_date` — Fecha de compra

---

## 7. Flujo de Evidencias

Durante la inspección (estado `active`), el inspector sube evidencias:

- **Fotos** — Fotos de los daños, del inmueble, etc.
- **Videos** — Recorridos, testimonios
- **Documentos** — Parte policial, facturas, pólizas
- **PDF** — Documentos escaneados

> **Regla:** Las evidencias se suben DURANTE la sesión `active`. Se pueden visualizar en cualquier momento posterior.

---

## 8. Flujo de Croquis

El inspector sube croquis / planos de las áreas afectadas:
- Upload de imagen (plano)
- Label descriptivo (ej: "Sala de Calderas", "Dormitorio")

---

## 9. Flujo de Firmas Digitales

Al finalizar la inspección:
1. **Firma del Inspector** — Canvas de firma + nombre + RUT
2. **Firma del Asegurado** — Canvas de firma + nombre + RUT

> **Regla:** Ambas firmas son requisito para generar el informe PDF.

---

## 10. Flujo de Informe PDF

Cuando la sesión está `completed` y ambas firmas existen:
1. Generar PDF consolidando:
   - Datos del siniestro (tomados del claim)
   - Datos del Acta de Inspección
   - Tabla de daños
   - Fotos de evidencias
   - Croquis
   - Firmas
   - Observaciones del inspector
2. Guardar en `inspection_reports`
3. Permitir descargar / compartir

---

## 11. Pantallas del Frontend (Orden de construcción)

### 11.1 Página de Inspecciones (`/dashboard/inspecciones`)
- Lista de todas las sesiones de inspección
- Filtros: por estado, por siniestro, por inspector
- Acciones: Ver, Iniciar, Completar, Cancelar
- Estado del Acta: completado / incompleto
- Estado de firmas: firmado / pendiente

### 11.2 Página de Detalle de Sesión (`/dashboard/inspecciones/[id]`)
**Sidebar o pestañas:**
1. **Resumen** — Datos del siniestro + estado de la sesión + acciones principales
2. **Acta de Inspección** — Wizard de 5 pasos (Datos Generales, Riesgo, Materialidad, Seguridad, Declaración, Terceros)
3. **Daños** — Tabla editable de daños
4. **Evidencias** — Galería + upload
5. **Croquis** — Upload + visualización
6. **Firmas** — Canvas de firma para inspector y asegurado
7. **Informe** — Generar / descargar PDF

### 11.3 Página de Agenda (`/dashboard/agenda`)
- Vista calendario (semanal/mensual)
- Eventos: inspecciones `scheduled` y `active`
- Click en evento → popup con acciones (Ver, Reagendar, Cancelar, Iniciar)
- Filtros por inspector

### 11.4 Integración en Siniestros
- Desde `/dashboard/claims`, cada siniestro debe tener:
  - Botón "Crear Inspección" → crea sesión `pending`
  - Lista de inspecciones asociadas al siniestro
  - Estado de cada inspección (badge)

---

## 12. Reglas del Workflow (Modificables)

1. **Regla de creación:** Una sesión de inspección solo se crea desde un siniestro existente.
2. **Regla de agenda:** Solo sesiones en estado `scheduled` o `active` aparecen en la Agenda.
3. **Regla de inicio:** Una sesión `scheduled` solo puede pasar a `active` manualmente (botón "Iniciar Inspección").
4. **Regla de Acta:** El Acta solo se edita cuando la sesión está `active`.
5. **Regla de firmas:** Sin ambas firmas (inspector + asegurado) NO se puede generar el informe PDF.
6. **Regla de múltiples sesiones:** Un siniestro puede tener múltiples sesiones de inspección (ej: inspección inicial + reinspección).
7. **Regla de cancelación:** Una sesión `cancelled` no se puede reactivar. Se debe crear una nueva.
8. **Regla de inspector:** Al crear la sesión, se debe asignar un inspector (perfil con rol `inspector`).

---

## 13. Orden de Implementación Propuesto

> Este orden es una sugerencia. Si el usuario prefiere otro orden, modificar este documento antes de construir.

1. **Página de Inspecciones** — Lista de sesiones con estados y filtros
2. **Página de Detalle de Sesión (Resumen)** — Ver datos del siniestro + cambiar estado de sesión
3. **Wizard del Acta de Inspección** — 5 formularios del Acta
4. **Registro de Daños** — Tabla editable
5. **Evidencias** — Upload + galería
6. **Croquis** — Upload + visualización
7. **Firmas Digitales** — Canvas
8. **Informe PDF** — Generación + descarga
9. **Agenda** — Vista calendario
10. **Integración con Siniestros** — Crear inspección desde siniestro + listar inspecciones del siniestro

---

## 14. Decisiones Pendientes del Usuario

> Antes de construir, el usuario debe confirmar o corregir estos puntos:

1. ¿Un siniestro puede tener **más de una** sesión de inspección simultánea? (ej: reinspección)
2. ¿El Acta debe completarse **en un solo paso** o puede guardarse **parcialmente**?
3. ¿Las evidencias se suben **solo desde la sesión** o también desde el siniestro directamente?
4. ¿El informe PDF se genera **automáticamente** al completar todo o con un **botón explícito**?
5. ¿La Agenda debe ser una **vista independiente** o un **modal dentro de Inspecciones**?
6. ¿Se necesita **chat en tiempo real** durante la inspección? (tabla `inspection_chat_messages` ya existe)

---

## 16. Cambios Aplicados (2026-06-18)

### Modal de Siniestros optimizado
- `modal-lg` ampliado de 720px a 860px
- Nuevo grid `modal-grid-3` para campos cortos (3 columnas)
- Formulario reorganizado: numeros/fechas en 3 columnas, textos largos full width
- Eliminados campos exclusivos de McLarens (`mclarens_one_number`, `internal_number`)

### Página de Inspecciones (`/dashboard/inspecciones`)
- Tabla con estados (pending, scheduled, active, completed, cancelled)
- Filtros por estado y busqueda
- Acciones segun estado: Agendar, Iniciar, Completar, Cancelar
- Modal "Nueva Inspeccion" con selector de siniestro disponible

### Página de Detalle de Sesion (`/dashboard/inspecciones/[id]`)
- 7 pestañas: Resumen, Acta, Daños, Evidencias, Croquis, Firmas, Informe
- Tab Resumen: datos completos del siniestro, asegurado, contacto, estado de sesion
- Botones de accion segun estado en el header
- **Tab Acta:** Wizard de 6 pasos funcional (Datos Generales, Riesgo, Materialidad, Seguridad, Declaracion, Terceros)
- Tabs Daños-Evidencias-Croquis-Firmas-Informe: placeholders listos para construir

### Página de Agenda (`/dashboard/agenda`)
- Vista semanal (Lunes a Domingo)
- Navegacion: semana anterior/siguiente, boton "Hoy"
- Filtro por inspector
- Eventos como tarjetas con estado, hora, numero de siniestro, asegurado, direccion

### Integracion con Siniestros
- Boton "Inspeccionar" en cada fila de la tabla de siniestros
- Crea sesion `pending` y redirige al detalle de la inspeccion

---

## 15. Notas para el Desarrollador (Devin)

> Si este documento indica hacer algo que el usuario no quiere, DETENERSE y pedir confirmacion.

- Siempre usar `React Hook Form + Zod` para formularios.
- Siempre usar `TanStack Query` para datos.
- Siempre usar los componentes de UI existentes (modales, tablas, botones semanticos).
- Los servicios GraphQL ya existen en `src/services/inspections.ts` — no reescribirlos.
- El backend ya tiene todas las tablas y permisos — solo construir frontend.
- Respetar los 3 tamanos de modal: `modal-sm` (480px), `modal-md` (640px), `modal-lg` (860px).
- Usar `app-panel` para paneles y `glass-panel` para tarjetas elevadas.
