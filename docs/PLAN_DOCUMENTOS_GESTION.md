# Plan: Sistema de Documentos de Gestión con Workflow de Revisión

## Concepto clave

El **documento de ofimática (Word/Excel/PowerPoint) es el documento de trabajo** que pasa por todos los niveles de revisión (emisor → revisor → aprobador). Cada nivel puede modificarlo y se versiona. **El PDF es el documento final publicable** que se genera al final del proceso.

**Lo que vale es el PDF final.** Hasta que no exista el PDF, la acción no está cerrada.

**El workflow avanza con la emisión del documento de ofimática**, no con el PDF. Las acciones dependientes se crean cuando el documento se emite (pasa a issued/reviewed/approved según el nivel final).

## Regla fundamental: todos los formatos de ofimática son equivalentes

**Word, Excel y PowerPoint son tratados exactamente igual.** No hay diferencia en el flujo:

- Misma pantalla genérica que recibe documentos
- Mismas fuentes: plantilla del sistema o subida por el usuario
- Mismo flujo de revisión por niveles (emisor → revisor → aprobador)
- Mismo versionado por nivel
- Mismo bloqueo al descargar para editar offline
- Mismo editor online (OnlyOffice soporta los 3 formatos)
- Mismo botón "Convertir a PDF" al final
- Mismo comportamiento con despacho
- Mismo cierre de la acción al generar el PDF

**El formato (docx, xlsx, pptx) es solo un atributo del archivo.** El flujo no cambia según el formato. El usuario puede elegir cualquier formato de ofimática y el sistema lo procesa igual.

### Plantillas del sistema
- Las plantillas pueden ser .docx, .xlsx o .pptx
- Al renderizar, el sistema detecta el formato y usa la librería correspondiente:
  - .docx → docxtemplater
  - .xlsx → xlsx-template
  - .pptx → node-pptx-templater
- Los placeholders funcionan igual en los 3 formatos (`[PLACEHOLDER]` o `<placeholder>`)

### Subida por el usuario
- El usuario puede subir .docx, .xlsx o .pptx
- El sistema detecta el formato y lo trata igual
- No hay diferencia en el flujo según el formato subido

---

## Flujo detallado

### Niveles de revisión y documento

Cada nivel (emisor, revisor, aprobador) trabaja sobre el **Word/Excel/PowerPoint**:

1. **Emisor** crea/modifica el Word → lo emite
2. **Revisor** puede:
   - **Aprobar** → pasa al siguiente nivel (aprobador)
   - **Rechazar** → vuelve al emisor con el Word anterior
   - **Modificar** → crea nueva versión del Word, luego aprueba/rechaza
3. **Aprobador** puede:
   - **Aprobar** → el Word queda aprobado
   - **Rechazar** → vuelve al revisor
   - **Modificar** → crea nueva versión del Word, luego aprueba/rechaza

### Caso 1: Un solo nivel (solo emisión)

1. Emisor genera/sube Word/Excel/PPT
2. Emisor emite → el documento queda emitido
3. **Cualquier rol puede hacer ajustes finales** al documento (emisor, revisor, aprobador, asistente) — cada ajuste crea una nueva versión
4. El botón **"Convertir a PDF"** aparece según el flag `is_dispatch_applicable`:
   - **Si NO tiene el flag (default):** el botón aparece en **todos los estados donde la gestión funciona** según el workflow. Cualquier usuario con permisos puede apretarlo.
   - **Si tiene el flag:** el botón aparece **ÚNICAMENTE** en estado **"despacho"**, y solo lo pueden apretar los despachadores
5. Usuario apreta el botón → se genera el PDF → la acción queda **cerrada y publicada**

### Caso 2: Con revisión y aprobación

1. Emisor genera/sube Word/Excel/PPT
2. Emisor emite → pasa al revisor
3. Revisor revisa el documento:
   - Si rechaza → vuelve al emisor con el documento anterior (el emisor tiene que rehacer el proceso)
   - Si aprueba → pasa al aprobador (queda registro de qué versión aprobó el revisor)
   - Si modifica → se crea nueva versión del documento, luego aprueba
4. Aprobador revisa:
   - Si rechaza → vuelve al revisor
   - Si aprueba → el documento queda aprobado
   - Si modifica → se crea nueva versión, luego aprueba
5. Después de la aprobación, **cualquier rol puede hacer ajustes finales** (emisor, revisor, aprobador, asistente) — cada ajuste crea una nueva versión
6. El botón **"Convertir a PDF"** aparece según el flag `is_dispatch_applicable`:
   - **Sin el flag (default):** aparece en **todos los estados donde la gestión funciona** según el workflow
   - **Con el flag:** aparece **ÚNICAMENTE** en estado **"despacho"**, solo despachadores
7. Usuario apreta el botón → se genera el PDF → acción **cerrada y publicada**

### Botón "Convertir a PDF"

**Aparece en todos los estados donde esa gestión funciona** (según el workflow del siniestro). No está limitado a un solo estado.

**Siempre es manual — NUNCA automático.** El usuario siempre tiene que apretar el botón. Esto es porque a veces el botón lo apreta el asistente para revisar que todo esté correcto antes de generar el PDF definitivo.

**El flag `is_dispatch_applicable` es un flag especial para el botón PDF:**

- **`is_dispatch_applicable = false` (default):** El botón "Convertir a PDF" aparece en **todos los estados donde la gestión está activa** según el workflow. Cualquier usuario con permisos puede apretarlo.
- **`is_dispatch_applicable = true`:** El botón "Convertir a PDF" aparece **ÚNICAMENTE** en estado **"despacho"**, y solo los despachadores pueden apretarlo. En el resto de los estados donde la gestión funciona, el botón no aparece. Hasta que el siniestro no llegue a despacho, la acción sigue como borrador (no publicable).

### Ajustes finales al documento

**Cualquier rol puede hacer ajustes finales al documento** (Word/Excel/PPT) en cualquier momento antes de que se genere el PDF, siempre y cuando se cree el versionado:

- **Emisor** puede ajustar el documento
- **Revisor** puede ajustar el documento
- **Aprobador** puede ajustar el documento
- **Asistente** puede ajustar el documento
- **Despachador** puede ajustar el documento (cuando tiene check de despacho)

Cada ajuste crea una nueva versión del documento con registro de:
- Quién lo modificó (usuario + rol en ese momento)
- Fecha y hora
- Archivo en R2

**El versionado es obligatorio** — no se puede modificar un documento sin crear una nueva versión. Esto asegura la trazabilidad de quién hizo qué cambio y cuándo.

### Estados del documento

```
[Sin documento] → [Word/Excel/PPT borrador] → [emitido] → [revisado] → [aprobado] → [PDF publicado]
       ↑                ↑                       ↑            ↑            ↑              ↑
       └────────────────┴───────────────────────┴────────────┴────────────┘            │
            (editable en cada nivel, con versionado)                       (acción cerrada)
                                                                              
              Botón "Convertir a PDF" aparece después del último nivel ──→ manual
```

### Estados del documento

```
[Sin documento] → [Word borrador] → [Word emitido] → [Word revisado] → [Word aprobado] → [PDF publicado]
       ↑                ↑                ↑                ↑                ↑
       └────────────────┴────────────────┴────────────────┘
            (editable en cada nivel, con versionado)
```

### Versionado

Cada modificación en cualquier nivel crea una nueva versión del Word:
- v1: Emisor genera desde plantilla
- v2: Revisor modifica
- v3: Aprobador modifica
- v4 (PDF): Conversión final

Cada versión registra:
- Quién la creó (emisor, revisor, aprobador, despachador, sistema)
- En qué nivel del workflow estaba
- Fecha y hora
- Archivo en R2

### Workflow de acciones dependientes

**El workflow avanza con la EMISIÓN del Word**, no con el PDF.

- Si IFL tiene acciones dependientes, se crean cuando IFL se **emite** (pasa a issued/reviewed/approved según el nivel final)
- El PDF es independiente del workflow — es el documento final publicable pero no dispara nuevas acciones
- Esto permite que el flujo del siniestro siga mientras el PDF se genera en despacho

### Cierre de la acción

La acción IFL queda **totalmente cerrada** solo cuando:
1. El Word pasó por todos los niveles de revisión
2. Se generó el PDF final

Si `is_dispatch_applicable = true`:
- El botón "Convertir a PDF" aparece **ÚNICAMENTE** cuando el siniestro está en estado **"despacho"**
- Solo los despachadores pueden apretarlo
- En el resto de los estados donde la gestión funciona, el botón no aparece
- Al generar el PDF, la acción pasa a "cerrada/publicada"

Si `is_dispatch_applicable = false` (default):
- El botón "Convertir a PDF" aparece en **todos los estados donde la gestión funciona** según el workflow
- Cualquier usuario con permisos puede apretarlo (el asistente puede revisar primero que todo esté correcto)
- Al generar el PDF, la acción pasa a "cerrada/publicada"

**Ajustes finales:** En cualquier momento antes de generar el PDF, cualquier rol (emisor, revisor, aprobador, asistente, despachador) puede hacer ajustes al documento. Cada ajuste crea una nueva versión con registro de quién lo hizo y cuándo.

---

## Fuentes del documento (3 opciones)

1. **Plantilla del sistema** — renderiza Word/Excel/PowerPoint con datos del siniestro
2. **Subir Word/Excel/PowerPoint** — documento editable de trabajo
3. **Subir PDF** — **NO permitido manualmente**. El PDF SOLO se genera desde el Word mediante el botón "Convertir a PDF"

## Edición del documento Word

### Offline (descarga + re-subir)
- Al descargar, el documento se **bloquea** para ese usuario
- Nadie más puede descargarlo ni editarlo online
- Al re-subir, se **desbloquea** y se crea una nueva versión
- Un admin puede **forzar el desbloqueo**
- El lock expira automáticamente después de 24h

### Online (OnlyOffice)
- Editor integrado en popup
- Solo si el documento NO está locked por otro usuario
- Al guardar, se crea una nueva versión automáticamente
- Co-edición en tiempo real

---

## Arquitectura

### Base de datos

#### Tabla `claim_action_documents` (migración 180)

```sql
CREATE TABLE claim_action_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_action_id UUID NOT NULL REFERENCES claim_actions(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,

  version INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL CHECK (source IN ('template', 'upload_docx', 'upload_xlsx', 'upload_pptx', 'pdf_conversion')),
  document_template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,

  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT NOT NULL CHECK (file_type IN ('docx', 'xlsx', 'pptx', 'pdf')),

  -- En qué nivel del workflow se creó esta versión
  workflow_level TEXT CHECK (workflow_level IN ('issuer', 'reviewer', 'approver', 'dispatcher', 'system')),

  -- Lock para edición offline
  locked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  lock_expires_at TIMESTAMPTZ,

  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
```

#### Cambios en `claim_actions`
- `has_document BOOLEAN DEFAULT FALSE` — tiene Word/Excel/PowerPoint actual
- `has_pdf BOOLEAN DEFAULT FALSE` — tiene PDF final publicado
- `pdf_generated_at TIMESTAMPTZ` — cuándo se generó el PDF

### Backend

#### Servicios

1. **`src/services/claim-action-documents.ts`** (nuevo)
   - `getDocuments(actionId)` — lista versiones
   - `getCurrentDocument(actionId)` — documento actual
   - `getCurrentEditableDocument(actionId)` — Word/Excel/PPT actual (no PDF)
   - `getCurrentPdf(actionId)` — PDF actual
   - `createVersion(input)` — nueva versión
   - `lockDocument(docId, userId)` / `unlockDocument(docId)` / `forceUnlock(docId, adminId)`
   - `hasEditableDocument(actionId)` — verifica si hay Word/Excel/PPT
   - `hasPdf(actionId)` — verifica si hay PDF

2. **`src/services/document-render.ts`** (nuevo, unifica docx/xlsx/pptx)
   - `renderDocument(buffer, data, fileType)` — dispatcher
   - `renderDocx`, `renderXlsx`, `renderPptx`
   - `extractPlaceholders(buffer, fileType)`

3. **`src/services/pdf-conversion.ts`** (nuevo)
   - `convertToPdf(buffer, fileType)` — convierte Word/Excel/PPT a PDF
   - Usa LibreOffice headless (servicio separado) o un servicio cloud

#### API Routes

1. **`POST /api/claims/actions/[actionId]/generate-document`** (modificar)
   - Acepta `{ templateId }`
   - Detecta tipo (docx/xlsx/pptx)
   - Crea versión con `workflow_level` del usuario actual
   - Marca `has_document = TRUE`

2. **`POST /api/claims/actions/[actionId]/upload-document`** (nuevo)
   - Recibe archivo (docx/xlsx/pptx) — **NO acepta PDF**
   - Crea versión con `workflow_level` del usuario actual
   - Marca `has_document = TRUE`

3. **`POST /api/claims/actions/[actionId]/documents/[docId]/lock`** (nuevo)
4. **`POST /api/claims/actions/[actionId]/documents/[docId]/unlock`** (nuevo)
5. **`POST /api/claims/actions/[actionId]/documents/[docId]/force-unlock`** (nuevo)
6. **`GET /api/claims/actions/[actionId]/documents`** (nuevo)
7. **`POST /api/claims/actions/[actionId]/convert-to-pdf`** (nuevo)
   - Toma el Word/Excel/PPT actual
   - Lo convierte a PDF
   - Crea nueva versión con `file_type='pdf'`, `source='pdf_conversion'`
   - Marca `has_pdf = TRUE`, `pdf_generated_at = NOW()`
   - Cierra la acción (pasa a "closed/published")
   - **Valida permisos:** si `is_dispatch_applicable = true`, solo despachadores pueden usarlo y solo cuando el siniestro está en estado "despacho"

8. **`GET /api/claims/actions/[actionId]/onlyoffice-config`** (nuevo)
9. **`POST /api/claims/actions/[actionId]/onlyoffice-callback`** (nuevo)

### Frontend

#### Componentes

1. **`DocumentWorkspace`** (nuevo, reemplaza DocumentTemplatesView en DynamicScreen)
   - **Si no hay documento:** muestra 2 opciones (Plantilla / Subir Word)
   - **Si hay Word y está en nivel del usuario:** muestra documento actual + botones (Descargar, Editar Online, Subir Nueva Versión, Historial)
   - **Si hay Word y NO está en nivel del usuario:** muestra documento actual en solo lectura
   - **Si hay Word aprobado y `is_dispatch_applicable = false`:** el sistema convierte automáticamente
   - **Si hay Word aprobado y `is_dispatch_applicable = true`:** muestra botón "Convertir a PDF" (solo visible para despachadores en estado despacho)
   - **Si hay PDF:** muestra PDF como documento final, acción cerrada

2. **`DocumentVersionHistory`** (nuevo)
   - Lista versiones con: número, fuente, nivel (emisor/revisor/aprobador/despachador), usuario, fecha, tamaño
   - Botón Descargar en cada versión
   - Botón Restaurar (solo si la acción no está cerrada)

3. **`OnlyOfficeEditor`** (nuevo)
   - Modal con editor embebido
   - Al guardar, crea nueva versión

4. **`DocumentLockBadge`** (nuevo)
   - Indica quién tiene el lock
   - Botón "Forzar desbloqueo" para admins

#### Cambios en `page.tsx` (claim detail)
- El botón **Emitir** requiere `has_document = TRUE` (Word/Excel/PPT)
- **Cualquier rol puede hacer ajustes finales** al documento antes del PDF (emisor, revisor, aprobador, asistente, despachador) — cada ajuste crea una nueva versión
- El botón **"Convertir a PDF"** aparece según el flag `is_dispatch_applicable`:
  - Si `is_dispatch_applicable = false` (default): aparece en **todos los estados donde la gestión funciona** según el workflow
  - Si `is_dispatch_applicable = true`: aparece **ÚNICAMENTE** en estado **"despacho"**, solo despachadores
- **Nunca hay conversión automática** — siempre requiere que el usuario aprete el botón

### Conversión a PDF

#### Opción 1: LibreOffice headless (self-hosted, gratis)
- Servicio Docker separado con LibreOffice
- API: `POST /convert` recibe el Word, devuelve el PDF
- Desplegar en Railway/Render/Fly.io

#### Opción 2: CloudConvert API (freemium)
- 50 conversiones gratis por mes
- API simple: `POST https://api.cloudconvert.com/v2/convert`

#### Opción 3: Gotenberg (open source, self-hosted)
- Docker: `gotenberg/gotenberg:8`
- API: `POST /forms/libreoffice/convert` recibe el Word, devuelve PDF
- **Recomendado:** gratis, ilimitado, fácil de desplegar

---

## Orden de implementación

### Fase 1: BD + servicios base
1. Migración 180: tabla `claim_action_documents` + campos en `claim_actions`
2. Servicio `claim-action-documents.ts`
3. Servicio `document-render.ts` (unifica docx/xlsx/pptx)
4. Extender `document-templates.ts` con `file_type`

### Fase 2: API Routes
5. Modificar `generate-document` (templateId, detectar tipo, crear versión)
6. Crear `upload-document` (solo Word/Excel/PPT, no PDF)
7. Crear `lock` / `unlock` / `force-unlock`
8. Crear `documents` (lista de versiones)
9. Crear `convert-to-pdf` (con validación de despacho)

### Fase 3: Frontend (sin OnlyOffice ni conversión PDF)
10. Componente `DocumentWorkspace` (2 opciones: plantilla / subir Word)
11. Mostrar documento actual con botones (Descargar, Subir Nueva Versión, Historial)
12. Implementar lock al descargar
13. Componente `DocumentVersionHistory`
14. Componente `DocumentLockBadge`
15. Integrar con niveles de revisión (emitir requiere Word)

### Fase 4: Conversión a PDF
16. Desplegar Gotenberg (Docker) en Railway/Render
17. Servicio `pdf-conversion.ts`
18. API `convert-to-pdf`
19. Botón "Convertir a PDF" en la UI
20. Validación de despacho (flag + estado del siniestro + rol del usuario)
21. Cierre automático de la acción al generar PDF

### Fase 5: OnlyOffice
22. Desplegar OnlyOffice Document Server (Docker)
23. Variables de entorno
24. API `onlyoffice-config` + `onlyoffice-callback`
25. Componente `OnlyOfficeEditor`
26. Botón "Editar Online"

### Fase 6: Testing + commit
27. Probar flujo completo con siniestro L-000000141
28. Build + commit

---

## Variables de entorno (nuevas)
```
# OnlyOffice
ONLYOFFICE_URL=https://onlyoffice.tu-dominio.com
ONLYOFFICE_JWT_SECRET=<openssl-rand-hex-32>

# Conversión PDF (Gotenberg)
GOTENBERG_URL=https://gotenberg.tu-dominio.com

# Lock
DOCUMENT_LOCK_EXPIRY_HOURS=24
```

---

## Reglas de validación

### Subir documento
- Solo Word/Excel/PowerPoint (no PDF manual)
- Si la acción está cerrada (tiene PDF): no se puede subir
- Si el documento está locked por otro usuario: no se puede subir (primero tiene que desbloquearse)

### Emitir gestión
- Requiere `has_document = TRUE` (Word/Excel/PPT actual)
- Si no hay documento: botón Emitir bloqueado con tooltip "Debe subir o generar un documento antes de emitir"

### Convertir a PDF
- Requiere que el documento haya pasado por todos los niveles de revisión
- El botón aparece según el flag `is_dispatch_applicable`:
  - Si `is_dispatch_applicable = false` (default): aparece en **todos los estados donde la gestión funciona** según el workflow
  - Si `is_dispatch_applicable = true`: aparece **ÚNICAMENTE** en estado **"despacho"**, solo despachadores
- Cualquier rol puede hacer ajustes finales al documento antes de apretar el botón (cada ajuste crea versión)
- **Nunca es automático** — siempre requiere que el usuario aprete el botón
- Si `is_dispatch_applicable = true`:
  - Solo despachadores pueden usarlo
  - Solo cuando el siniestro está en estado "despacho"

### Cerrar acción
- La acción se cierra solo cuando `has_pdf = TRUE`
- Una vez cerrada, todos los documentos quedan de solo lectura
- No se pueden subir nuevas versiones ni editar

### Workflow de acciones dependientes
- Se activa con la EMISIÓN del Word (no con el PDF)
- Permite que el flujo del siniestro siga mientras el PDF se genera en despacho
