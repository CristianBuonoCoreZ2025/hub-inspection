# PLAN MAESTRO — Claims Hub Platform

> Plan único y ordenado del proyecto. Reemplaza todos los planes anteriores.
> Última actualización: 2026-01-30

---

## Estado del Proyecto

**Migración a Supabase:** ✅ COMPLETADA
- Backend migrado de Nhost/Hasura a Supabase
- Auth, Storage, RLS, PostgREST todos funcionando
- 24/24 queries PostgREST verificadas

**Sistema de Gestiones:** ✅ COMPLETADO
- Constructor visual de pantallas dinámicas
- Workflow configurable (emitir/revisar/aprobar/rechazar)
- Auto-asignación inteligente de responsables
- Inspecciones integradas como claim_actions estándar

**Sistema de Inspecciones:** ✅ FUNCIONAL
- Inspección presencial y remota (magic link)
- 7 tabs: Resumen, Acta, Daños, Evidencias, Croquis, Firmas, Informe
- Wizard de acta con 6 pasos
- Sync real-time inspector ↔ cliente (polling 2s)
- Videollamada LiveKit integrada

---

## Arquitectura: Dos Tipos de Pantallas

### Decisión Definitiva

El sistema tiene **dos tipos de pantallas** que coexisten:

#### 1. Pantallas Dinámicas (Gestion Screens)
- **Propósito:** Formularios configurables para gestiones de siniestros
- **Configuración:** `form_schema` JSONB + constructor visual drag-and-drop
- **Tipos de campo:** text, textarea, number, date, select, checkbox, table, section
- **Entidades:** 13 simples (read-only del claim), 7 de gestión, 10 complejas (componentes React)
- **Layout:** Secciones verticales apiladas (sin tabs, sin wizard)
- **Uso:** Email, coberturas, reservas, documentos, liquidación, etc.
- **Ubicación:** `src/app/dashboard/claims/[id]/gestion-screens/DynamicScreen.tsx`

#### 2. Pantallas Fijas (Inspection Screens)
- **Propósito:** Aplicación colaborativa en tiempo real para inspecciones
- **Configuración:** Hardcoded por diseño (proceso regulado)
- **Componentes:** 7 tabs + wizard de 6 pasos (acta)
- **Especializados:** Canvas de firmas, upload de evidencias, chat real-time, videollamada LiveKit, CRUD de daños, croquis
- **Sync:** Inspector controla tabs, cliente sigue via magic link (polling 2s)
- **Ubicación:** `src/app/dashboard/inspecciones/[id]/` + `src/app/inspection/[token]/`

### Regla
```
Las pantallas dinámicas son para FORMULARIOS configurables.
Las pantallas fijas son para APLICACIONES especializadas con componentes
que no se pueden expresar en un form_schema JSONB (videollamada, canvas,
chat, upload, wizard, sync real-time).
NUNCA intentar meter inspección dentro de pantallas dinámicas.
NUNCA intentar hacer configurables los tabs/wizard de inspección.
```

---

## Fase 1: Estabilización Post-Migración ✅ COMPLETADA

### 1.1 Migración Nhost → Supabase ✅
- [x] Exportar BD de Nhost (pg_dump)
- [x] Importar a Supabase
- [x] Migrar Auth (createBrowserClient, createServerClient, middleware)
- [x] Crear capa de datos unificada (`src/lib/supabase/db.ts`)
- [x] Migrar 32 services (GraphQL → PostgREST)
- [x] Migrar Storage (Nhost → Cloudflare R2 + Supabase Storage)
- [x] RLS policies en todas las tablas
- [x] PostgREST embedding con FK hints en todas las queries

### 1.2 Fix PostgREST Embeddings ✅
- [x] Migraciones 126-128: FKs faltantes (action_template, claim_actions, etc.)
- [x] Corregir sintaxis `alias:table!fk_constraint_name(...)` en 24 queries
- [x] Auditar todas las rutas API, services y pages
- [x] Script de test exhaustivo (24/24 queries OK)

### 1.3 Inspecciones como Gestiones Estándar ✅
- [x] Migración 129: `claim_action_id` en `inspection_sessions`
- [x] Trigger `sync_inspection_claim_action()` sincroniza status automáticamente
- [x] `createInspectionSession` crea `claim_action` con code estándar
- [x] Listado de gestiones del siniestro muestra inspecciones como claim_actions normales
- [x] `inspection_number` usa `claim_action.code` (ej: `L-000000141-INS-001`)

---

## Fase 2: Mejoras del Edit Form ⏳ PENDIENTE

### 2.1 Geo de participantes como selects cascading (ALTO)
- [ ] Reemplazar 12 text inputs por selects cascading country→region→city→commune
- [ ] Los participantes guardan geo como texto (nombres), los selects usan `name` como value

### 2.2 Cascading Tipo Siniestro → Línea → Producto (ALTO)
- [ ] Agregar `onValueChange` a claimTypeId (limpia businessLineId y insuranceProductId)
- [ ] Agregar `onValueChange` a businessLineId (limpia insuranceProductId, filtra productos)
- [ ] Disable insuranceProductId si no hay businessLineId

### 2.3 Filtrado por país de catálogos (ALTO)
- [ ] Filtrar insurance_companies, brokers, advisors, business_lines, claim_causes por país
- [ ] Al cambiar countryId, resetear campos dependientes

### 2.4 Linking de participantes (MEDIO)
- [ ] Botones "Copiar de Asegurado" / "Desligar Asegurado" para contratante y beneficiario
- [ ] Estado `contractorLinked`, `beneficiaryLinked`, `claimAddressLinked`
- [ ] Al ligar: copiar campos del asegurado y bloquear inputs
- [ ] Al desligar: desbloquear

### 2.5 Autocomplete por RUT (MEDIO)
- [ ] Debounce 600ms para cada participante (insured, contractor, beneficiary)
- [ ] Buscar `findParticipantByRut(rut, country)`
- [ ] Mostrar banner de sugerencia con botón "Usar datos existentes"

### 2.6 Paneles colapsables (BAJO)
- [ ] Contratante y beneficiario expandibles/colapsables
- [ ] Por defecto: expandido si tiene datos, colapsado si no

---

## Fase 3: Mejoras del Módulo de Inspección ⏳ EN PROGRESO

### 3.1 Acta-form simplificado (ALTO)
- [ ] Reemplazar 15+ text inputs por selects con catálogos
- [ ] Pre-poblar campos desde datos del siniestro
- [ ] Reducir campos redundantes (datos que ya están en el claim)

### 3.2 Evidencias con categorización (MEDIO)
- [ ] Categorización manual de evidencias (no solo tipo de archivo)
- [ ] Categorías: exterior, interior, daños, documentos, otros

### 3.3 Canvas de dibujo para croquis (MEDIO)
- [ ] Canvas HTML5 con herramientas de dibujo (no solo upload de imágenes)
- [ ] Lápiz, líneas, rectángulos, texto, colores
- [ ] Exportar como imagen PNG

### 3.4 PDF real del reporte (MEDIO)
- [ ] Generar PDF del informe de inspección (no print de ventana)
- [ ] Usar librería jsPDF o similar
- [ ] Incluir todas las secciones del acta, daños, evidencias

### 3.5 Firma optimizada (BAJO)
- [ ] Canvas de firma con smoothing de líneas
- [ ] Soporte touch optimizado para mobile
- [ ] Exportar como imagen transparente PNG

---

## Fase 4: Magic Link Mirror ⏳ PENDIENTE

### 4.1 Pestañas completas en magic link
- [ ] Resumen, Acta, Daños, Evidencias, Croquis, Firmas, Chat
- [ ] Pestaña "Informe" NO se muestra al cliente
- [ ] Componentes read-only que replican el dashboard del inspector

### 4.2 Chat del cliente
- [ ] API route `POST /api/inspection/chat` para envío de mensajes del cliente
- [ ] Componente ChatPanel interactivo (no solo read-only)

### 4.3 Firma del cliente
- [ ] API route `POST /api/inspection/sign` para firma del asegurado
- [ ] Canvas de firma interactivo en el magic link

### 4.4 Presigned URLs
- [ ] Evidencias, firmas y croquis con URLs firmadas temporales
- [ ] Expiración configurable (ej: 1 hora)

---

## Fase 5: Documentos del Siniestro ✅ COMPLETADO

### 5.1 Pestaña Documentos ✅
- [x] Migración 117: extender tabla `claim_documents`
- [x] Servicio `claim-documents-physical.ts` para CRUD
- [x] Componente `claim-documents-tab.tsx` con 3 secciones:
  - Documentos físicos del siniestro
  - Documentos físicos de la póliza asociada
  - Documentos online de la póliza
- [x] Integración en la página del siniestro

---

## Fase 6: Mejoras Futuras (Backlog)

### 6.1 IA (OpenRouter)
- [ ] Homologación automática de siniestros
- [ ] OCR de documentos
- [ ] Sugerencias de coberturas

### 6.2 Operaciones
- [ ] Carga masiva de siniestros (CSV)
- [ ] Carga masiva de catálogos (CSV)
- [ ] Inhabilitar/reabrir siniestros

### 6.3 Reportes
- [ ] Dashboard de métricas
- [ ] Exportación de datos
- [ ] Auditoría completa

### 6.4 Notificaciones
- [ ] Email notifications (SendGrid/Resend)
- [ ] Push notifications
- [ ] Webhooks

---

## Migraciones Aplicadas

| # | Nombre | Estado | Descripción |
|---|--------|--------|-------------|
| 113 | gestion_linea_negocio_y_codificacion | ✅ | Línea de negocio + codificación |
| 116 | claim_actions_is_automatic | ✅ | Campo is_automatic en claim_actions |
| 117 | add_assistant_role | ✅ | Rol assistant + campos de rechazo |
| 121 | rejection_fields | ✅ | Campos de rechazo en claim_actions |
| 122 | claim_action_history | ✅ | Tabla claim_action_history |
| 123 | profile_extra_fields | ✅ | Campos extra en profiles |
| 124 | default_roles | ✅ | Roles por defecto |
| 125 | fix_claim_action_code_format | ✅ | Fix formato código claim_action |
| 126 | atcs_claim_status_fk | ✅ | FK action_template_claim_status + action_type |
| 127 | missing_fks | ✅ | FKs faltantes en claim_actions y action_features |
| 128 | action_template_line_business_fk | ✅ | FK action_template.line_business_id |
| 129 | inspection_claim_action_link | ✅ | Link inspection_sessions ↔ claim_actions |

---

## Documentación de Referencia

| Documento | Ubicación | Propósito |
|-----------|-----------|-----------|
| Reglas del proyecto | `AGENTS.md` | Decisiones técnicas, convenciones, reglas |
| Diseño de gestiones | `docs/PLAN_GESTIONES_PANTALLAS.md` | Arquitectura del sistema de pantallas dinámicas |
| Estructura de storage | `src/lib/storage/PLAN.md` | Estructura de carpetas en Cloudflare R2 |

> Los planes individuales (`PLAN_*.md` en la raíz) han sido consolidados en este documento.
