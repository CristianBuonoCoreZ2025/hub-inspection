# Plan: Módulo de Inspección — Rediseño Completo

## Estado Actual: PARCIALMENTE FUNCIONAL, UX DEFICIENTE

### Problemas detectados
1. **Sin distinción presencial vs remota** — no hay magic link, no hay screen share
2. **Agenda rota** — filtra por `claim_id` en vez de inspector asignado
3. **Acta-form con 49 campos, 15+ son text inputs que deberían ser selects**
4. **Campos redundantes** — muchos datos del acta ya están en el siniestro
5. **Croquis sin canvas de dibujo** — solo subida de imágenes
6. **Evidencias sin categorización** — solo tipo de archivo (photo/video/doc)
7. **Items "Evidencias" e "Informes" en sidebar** — redirigen a inspecciones, confunden
8. **Reporte sin PDF real** — solo print de ventana
9. **Firma del croquis pesima con mouse** — canvas básico sin optimización

---

## Flujo de Inspección Rediseñado (basado en mejores prácticas)

### Referencias investigadas
- **Blitzz / Matterport / CCC**: inspección remota via link, sin app del cliente
- **Hancock Claims**: scheduling software con colaboración virtual en tiempo real
- **US Tech Automations**: 70%+ campos estructurados → 41% más útil para underwriters
- **Wednesday / Atlas**: formularios mínimos, pre-poblar desde claim, mobile-first
- **Zuko**: radio buttons para <6 opciones, dropdowns buscables para listas largas

### Flujo unificado

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CREAR INSPECCIÓN (desde siniestro)                       │
│    └─ Modal pregunta: ¿Presencial o Remota?                 │
│       ├─ Presencial: fecha, hora, inspector asignado        │
│       └─ Remota: fecha, hora, inspector + generar magic link│
│          └─ Magic link se envía al asegurado por email      │
│          └─ Cliente accede sin login, ve sesión en vivo     │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. AGENDAR                                                  │
│    └─ Estado: pending → scheduled                           │
│    └─ Aparece en agenda con tipo (presencial/remota)        │
│    └─ Recordatorio automático al inspector y asegurado      │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. INICIAR INSPECCIÓN                                       │
│    ├─ Presencial: inspector va al lugar                     │
│    └─ Remota: inspector y cliente entran a sesión virtual   │
│       ├─ Inspector: /dashboard/inspecciones/[id] (full app) │
│       └─ Cliente: /inspection/[token] (vista simplificada)  │
│          ├─ Ve acta en tiempo real (compartida)             │
│          ├─ Ve croquis que dibuja el inspector              │
│          ├─ Ve evidencias que sube el inspector             │
│          ├─ Chat con inspector                              │
│          └─ Firma al final                                  │
│    └─ Estado: scheduled → active                            │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. DESARROLLAR INSPECCIÓN (tabs)                            │
│    1. Acta — form simple con selects, pre-llenado del claim │
│    2. Daños — con categorías y vinculación a evidencias     │
│    3. Evidencias — con categorías manuales (fachada, daño)  │
│    4. Croquis — canvas de dibujo + subida de planos         │
│    5. Firmas — insured + inspector                          │
│    6. Chat — si remota, para comunicarse con cliente        │
│    (Checklist y Reporte se fusionan al final)               │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. COMPLETAR                                                │
│    └─ Generar PDF del acta + daños + evidencias + firmas    │
│    └─ Estado: active → completed                            │
│    └─ Claim pasa a "in_review"                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Cambios por Categoría

### A. Base de Datos (Migración 56)

```sql
-- 1. inspection_sessions: agregar tipo de inspección
ALTER TABLE inspection_sessions ADD COLUMN IF NOT EXISTS inspection_type text NOT NULL DEFAULT 'onsite';
ALTER TABLE inspection_sessions DROP CONSTRAINT IF EXISTS inspection_sessions_type_check;
ALTER TABLE inspection_sessions ADD CONSTRAINT inspection_sessions_type_check
  CHECK (inspection_type IN ('onsite','remote'));

-- 2. Catálogo de materialidades (lookup_catalog)
INSERT INTO lookup_catalog (category, code, label, sort_order) VALUES
  ('materiality_walls', 'concrete', 'Hormigón Armado', 1),
  ('materiality_walls', 'brick', 'Albañilería', 2),
  ('materiality_walls', 'adobe', 'Adobe', 3),
  ('materiality_walls', 'wood', 'Madera', 4),
  ('materiality_walls', 'steel', 'Estructura Metálica', 5),
  ('materiality_walls', 'mixed', 'Mixta', 6),
  ('materiality_walls', 'other', 'Otra', 99),
  ('materiality_roof', 'concrete_slab', 'Loseta Hormigón', 1),
  ('materiality_roof', 'metal_sheet', 'Plancha Metálica', 2),
  ('materiality_roof', 'tile', 'Teja', 3),
  ('materiality_roof', 'wood', 'Madera', 4),
  ('materiality_roof', 'membrane', 'Membrana Asfáltica', 5),
  ('materiality_roof', 'other', 'Otra', 99),
  ('materiality_flooring', 'tile', 'Cerámica/Porcelanato', 1),
  ('materiality_flooring', 'wood', 'Madera', 2),
  ('materiality_flooring', 'carpet', 'Alfombra', 3),
  ('materiality_flooring', 'vinyl', 'Vinílico', 4),
  ('materiality_flooring', 'concrete', 'Hormigón', 5),
  ('materiality_flooring', 'floating', 'Piso Flotante', 6),
  ('materiality_flooring', 'other', 'Otro', 99),
  ('materiality_ceiling', 'gypsum', 'Yeso', 1),
  ('materiality_ceiling', 'wood', 'Madera', 2),
  ('materiality_ceiling', 'metal_frame', 'Estructura Metálica', 3),
  ('materiality_ceiling', 'concrete', 'Hormigón', 4),
  ('materiality_ceiling', 'other', 'Otro', 99),
  ('materiality_interior_finish', 'paint', 'Pintura', 1),
  ('materiality_interior_finish', 'wallpaper', 'Cortina de Papel', 2),
  ('materiality_interior_finish', 'ceramic', 'Cerámica', 3),
  ('materiality_interior_finish', 'wood_panel', 'Panel Madera', 4),
  ('materiality_interior_finish', 'other', 'Otra', 99),
  ('materiality_exterior_finish', 'paint', 'Pintura', 1),
  ('materiality_exterior_finish', 'mortar', 'Estuco/Mortero', 2),
  ('materiality_exterior_finish', 'stone', 'Piedra', 3),
  ('materiality_exterior_finish', 'metal_panel', 'Panel Metálico', 4),
  ('materiality_exterior_finish', 'other', 'Otra', 99),
  ('materiality_closure', 'concrete_wall', 'Muro Hormigón', 1),
  ('materiality_closure', 'brick_wall', 'Muro Albañilería', 2),
  ('materiality_closure', 'metal_fence', 'Reja Metálica', 3),
  ('materiality_closure', 'wood_fence', 'Cerca Madera', 4),
  ('materiality_closure', 'none', 'Sin Cierre', 5),
  ('materiality_closure', 'other', 'Otro', 99),
  ('risk_type', 'house', 'Casa', 1),
  ('risk_type', 'apartment', 'Departamento', 2),
  ('risk_type', 'commercial', 'Local Comercial', 3),
  ('risk_type', 'warehouse', 'Bodega/Industrial', 4),
  ('risk_type', 'office', 'Oficina', 5),
  ('risk_type', 'building', 'Edificio', 6),
  ('risk_type', 'other', 'Otro', 99),
  ('risk_class', 'residential', 'Residencial', 1),
  ('risk_class', 'commercial', 'Comercial', 2),
  ('risk_class', 'industrial', 'Industrial', 3),
  ('risk_class', 'mixed', 'Mixto', 4),
  ('property_type', 'single_family', 'Unifamiliar', 1),
  ('property_type', 'multi_family', 'Multifamiliar', 2),
  ('property_type', 'condo', 'Condominio', 3),
  ('property_type', 'commercial_local', 'Local Comercial', 4),
  ('property_type', 'warehouse', 'Bodega', 5),
  ('property_type', 'office_building', 'Edificio de Oficinas', 6),
  ('property_type', 'other', 'Otro', 99),
  ('interviewed_relationship', 'owner', 'Propietario', 1),
  ('interviewed_relationship', 'tenant', 'Arrendatario', 2),
  ('interviewed_relationship', 'administrator', 'Administrador', 3),
  ('interviewed_relationship', 'family', 'Familiar', 4),
  ('interviewed_relationship', 'employee', 'Empleado', 5),
  ('interviewed_relationship', 'other', 'Otro', 99),
  ('evidence_category', 'facade', 'Fachada', 1),
  ('evidence_category', 'interior', 'Interior', 2),
  ('evidence_category', 'damage', 'Daño', 3),
  ('evidence_category', 'structural', 'Estructural', 4),
  ('evidence_category', 'detail', 'Detalle', 5),
  ('evidence_category', 'context', 'Contexto/Entorno', 6),
  ('evidence_category', 'document', 'Documento', 7),
  ('evidence_category', 'other', 'Otra', 99)
ON CONFLICT DO NOTHING;

-- 3. inspection_evidences: agregar categoría manual
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS category text;

-- 4. Index para magic link lookup
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_magic_link
  ON inspection_sessions(magic_link_token) WHERE magic_link_token IS NOT NULL;
```

### B. Sidebar — quitar items redundantes

Quitar del array `mainLinks`:
- `Evidencias` → ya está como tab dentro de inspección
- `Informes` → ya está como tab dentro de inspección

### C. Agenda — fix bug crítico

**Bug**: línea 92 filtra por `s.claim_id === inspectorFilter`
**Fix**: filtrar por `s.claim?.inspector_id === inspectorFilter`

Mejoras adicionales:
- Badge de tipo (Presencial/Remota) en cada evento
- Click en evento → abre la inspección
- Vista mensual además de semanal

### D. Acta-form — simplificar con catálogos

**Principio**: "Mínimo campos requeridos, pre-llenar desde claim, selects con catálogos"

#### Campos a PRE-LENAR desde el siniestro (no pedir de nuevo):
- ~~Nombre asegurado~~ → viene de `claims_participants`
- ~~Dirección~~ → viene de `claim.claim_address`
- ~~Comuna/Región~~ → viene de `claim`
- ~~RUT asegurado~~ → viene de `claims_participants`
- ~~Email/Telefono~~ → viene de `claims_participants`
- ~~Compañía de seguros~~ → viene de `claim.insurance_company`
- ~~N° póliza~~ → viene de `claim.policy_number`
- ~~Fecha siniestro~~ → viene de `claim.claim_date`

#### Campos a CONVERTIR de text → select:

| Campo | Catálogo | Tabla/lookup |
|-------|----------|--------------|
| interviewed_relationship | Parentescos | `relationships` o `lookup_catalog('interviewed_relationship')` |
| risk_type | Tipos de riesgo | `lookup_catalog('risk_type')` |
| risk_class | Clases de riesgo | `lookup_catalog('risk_class')` |
| property_type | Tipos de inmueble | `lookup_catalog('property_type')` |
| business_line | Líneas de negocio | `business_lines` (ya existe) |
| walls | Materialidad muros | `lookup_catalog('materiality_walls')` |
| roof | Materialidad cubierta | `lookup_catalog('materiality_roof')` |
| interior_flooring | Materialidad pisos | `lookup_catalog('materiality_flooring')` |
| interior_ceilings | Materialidad cielos | `lookup_catalog('materiality_ceiling')` |
| interior_finishes | Terminaciones int. | `lookup_catalog('materiality_interior_finish')` |
| exterior_finishes | Terminaciones ext. | `lookup_catalog('materiality_exterior_finish')` |
| perimeter_closure | Cierre perimetral | `lookup_catalog('materiality_closure')` |
| commune (terceros) | Comunas | `communes` (ya existe) |

#### Campos que se mantienen como text (datos únicos del caso):
- N° departamento/oficina, N° pisos, antigüedad, superficie, cantidades
- Nombre propietario (si diferente del asegurado)
- Parte policial: N°, nombre, RUT denunciante
- Compañía bomberos (texto libre, muy variable)
- Relato de hechos, punto ingreso/salida, observaciones

### E. Creación de inspección — presencial vs remota

**Modal de creación** pregunta tipo:
- **Presencial**: fecha, hora, inspector (select de users con rol inspector)
- **Remota**: fecha, hora, inspector + email del asegurado (para enviar magic link)
  - Al crear: genera `magic_link_token` (UUID), `magic_link_expires_at` (+24h)
  - Muestra link copiable: `${APP_URL}/inspection/[token]`
  - Botón "Enviar por email" (opcional, futuro)

### F. Página pública `/inspection/[token]`

Vista simplificada para el asegurado en inspección remota:
- **Sin login** — solo necesita el token
- **Ve en tiempo real**: acta, croquis, evidencias que el inspector completa
- **Chat** con el inspector
- **Firma** al final
- **No puede editar** nada excepto el chat y su firma

### G. Croquis — canvas de dibujo

Reemplazar subida-only por canvas con:
- **Herramientas**: lápiz, línea, rectángulo, círculo, texto, color, grosor
- **Fondo**: opcional subir plano/foto como base
- **Optimización mouse**: smoothing, puntos bezier (no líneas rectas entre puntos)
- **Guardar**: exportar canvas como PNG a Nhost Storage
- **Múltiples croquis**: lista de croquis por sesión

### H. Evidencias — categorización

- Agregar `category` (select con `lookup_catalog('evidence_category')`)
- Categorías: Fachada, Interior, Daño, Estructural, Detalle, Contexto, Documento
- Vista por categoría (agrupar evidencias)
- Vincular evidencia a un daño específico (opcional)

### I. Reporte — PDF real

- Usar `react-pdf` o `@react-pdf/renderer` para generar PDF
- Incluir: header con datos del siniestro, acta resumida, tabla de daños, galería de evidencias, croquis, firmas
- Guardar PDF en Nhost Storage, actualizar `inspection_reports.report_url`

### J. Tabs — consolidar

**Tabs finales** (de 9 a 6):
1. **Acta** (incluye datos generales, riesgo, materialidad, seguridad, declaración)
2. **Daños** (con vinculación a evidencias)
3. **Evidencias** (con categorías)
4. **Croquis** (canvas de dibujo)
5. **Firmas** (insured + inspector)
6. **Chat** (solo visible si remota)

**Tabs eliminados**:
- ~~Resumen~~ → info ya está en header
- ~~Checklist~~ → fusionar en acta como sección
- ~~Reporte~~ → botón "Generar PDF" en header, no tab separado

---

## Orden de Implementación

### Fase 1: Fundamentos (este commit)
1. ~~Plan MD~~ ✅
2. Migración 56: inspection_type + catálogos + evidence.category
3. Quitar Evidencias/Informes del sidebar
4. Fix bug agenda (filtro inspector)
5. Crear hook `useLookupCatalog` para selects
6. Acta-form: convertir 13 text inputs a selects
7. Pre-llenar campos desde claim
8. Creación: modal presencial vs remota + magic link
9. Build + commit

### Fase 2: Experiencia remota (siguiente commit)
1. Página pública `/inspection/[token]`
2. Vista simplificada para asegurado
3. Realtime (cambios del inspector visibles para cliente)

### Fase 3: UX avanzado (futuro)
1. Canvas de dibujo para croquis
2. PDF real del reporte
3. Categorización de evidencias
4. Consolidación de tabs
