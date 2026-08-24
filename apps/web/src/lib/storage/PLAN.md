# Plan: Estructura de Carpetas en Cloudflare R2

## Formato del Número de Liquidación

El número de liquidación se genera automáticamente en la BD:
- Formato: `L-NNNNNNNNN` (L + 10 dígitos, ej: `L-000000001`)
- Secuencia global: `claims_liquidation_seq`
- Trigger `trg_claims_liquidation_number` lo genera al insertar un claim

---

## Reglas de Codificación (todas configurables y únicas)

### Línea de Negocios (1 letra, configurable y única en `business_lines.code_prefix`)
| Letra | Línea |
|-------|-------|
| H | Hogar |
| C | Comercial |
| R | Responsabilidad Civil |
| V | Vida |
| ... | configurable |

Si la gestión no tiene línea de negocios (aplica a todas), se omite el prefijo.

### Característica / Gestión (3 letras, configurable y único en `action_features.code`)
| Código | Característica |
|--------|---------------|
| INS | Inspección |
| ILI | Informe de Liquidación |
| PCA | Propuesta de Carta de Aceptación |
| CIN | Coordinación de Inspección |
| SOL | Solicitud de Documentos |
| RES | Reserva |
| RIM | Recepción de Impugnación |
| ... | configurable |

### Código compuesto de gestión = Línea + Característica
- `HILI` = Hogar + Informe de Liquidación
- `CILI` = Comercial + Informe de Liquidación
- `HINS` = Hogar + Inspección
- `PCA` = Sin línea (aplica a todas) + Propuesta de Carta de Aceptación

---

## 4 Tipos de Gestiones

| Tipo | Template | Workflow | Pantalla | Documentos | Ejemplo |
|------|----------|----------|----------|------------|---------|
| **Con template + workflow** | Sí | 0-3 niveles | No | Generados desde template | ILI, PCA, SOL |
| **Con pantalla, sin template** | No | 0-3 niveles | Sí | Subidos manualmente | INS, CIN |
| **Híbrida** | Sí | 0-3 niveles | Sí | Generados desde template + subidos | RES (reserva) |
| **Gestión muerta** | No | 0 niveles | No | Solo se recibe/sube | RIM (recepción impugnación) |

### Detalle por tipo:

**1. Con template + workflow** (ej: Informe de Liquidación)
- Tiene plantilla .docx que se rellena con datos del siniestro
- Workflow de revisión: 0-3 niveles (emisor → revisor → aprobador)
- No tiene pantalla especial, solo documentos
- Genera un documento al ejecutarse

**2. Con pantalla, sin template** (ej: Inspección)
- Tiene flujo especial con pantalla propia (evidencias, daños, firmas, croquis, checklists)
- NO tiene template .docx
- Puede tener niveles de revisión (la inspección tiene 1 nivel: solo emisión)
- Los documentos se suben manualmente (fotos, croquis, etc.)
- Cuando el inspector emite, la acción queda realizada

**3. Híbrida** (ej: Reserva)
- Tiene pantalla propia + template .docx
- Genera un reporte automático desde el template
- Tiene workflow de revisión completo
- También puede recibir documentos subidos manualmente

**4. Gestión muerta** (ej: Recepción de Impugnación)
- Sin workflow (0 niveles)
- Sin template
- Sin pantalla especial
- Solo recibe un documento que el cliente/envía para registro
- Nadie revisa, no sale información, solo se archiva

---

## Estructura Física

### 1. Configuración (plantillas globales)

```
config/
  actions/
    {CODIGO_COMPUESTO}/
      {CODIGO_COMPUESTO}-NNNNN.ext          — template renombrado al código
```

Solo los tipos 1 (con template + workflow) y 3 (híbrida) tienen plantillas aquí.
Los tipos 2 (pantalla sin template) y 4 (gestión muerta) NO tienen carpeta de configuración.

### 2. Siniestros

```
claims/
  {L-NNNNNNNNN}/                               — ej: L-000000001
    documents/                              — documentos del siniestro (no de una gestión)
      {L-NNNNNNNNN}-DOC-NNNNNN.ext             — ej: L-000000001-DOC-000001.pdf
    actions/
      {L-NNNNNNNNN}-{CODIGO_COMPUESTO}-NNNN/   — ej: L-000000001-HINS-0001
        {L-NNNNNNNNN}-{CODIGO_COMPUESTO}-NNNN.ext  — documento generado desde template (tipos 1 y 3)
        documents/                          — documentos extra subidos manualmente
          {L-NNNNNNNNN}-{CODIGO_COMPUESTO}-NNNN-DOC-NNNN.ext
        images/                            — fotos de la gestión (tipos 2 y 3)
          {L-NNNNNNNNN}-{CODIGO_COMPUESTO}-NNNN-EVI-NNNN.ext   — evidencias
          {L-NNNNNNNNN}-{CODIGO_COMPUESTO}-NNNN-DAN-NNNN.ext   — daños
          {L-NNNNNNNNN}-{CODIGO_COMPUESTO}-NNNN-FIR-NNNN.ext   — firmas
```

### 3. Empresas

```
companies/
  {company_id}/
    logos/
      {filename}
```

---

## Ejemplos Completos por Tipo de Gestión

### Tipo 1: Informe de Liquidación de Hogar (con template + workflow)

**Configuración (templates):**
```
config/actions/HILI/
  HILI-00001.docx                            — template informe hogar
  HILI-00002.docx                            — template informe hogar (variante 2)
```

**Siniestro L-000000001:**
```
claims/L-000000001/
  actions/
    L-000000001-HILI-0001/                     — informe liquidación hogar #1
      L-000000001-HILI-0001.docx               — documento generado desde template
```

### Tipo 2: Inspección de Hogar (con pantalla, sin template)

**Configuración:**
No tiene carpeta de configuración (no hay template).

**Siniestro L-000000001:**
```
claims/L-000000001/
  actions/
    L-000000001-HINS-0001/                     — inspección hogar #1
      documents/
        L-000000001-HINS-0001-DOC-0001.pdf      — croquis/dibujo de la casa
      images/
        L-000000001-HINS-0001-EVI-0001.jpg      — evidencia foto 1
        L-000000001-HINS-0001-EVI-0002.jpg      — evidencia foto 2
        L-000000001-HINS-0001-DAN-0001.jpg      — daño foto 1
        L-000000001-HINS-0001-FIR-0001.png      — firma del inspector
        L-000000001-HINS-0001-FIR-0002.png      — firma del asegurado
```

### Tipo 3: Reserva de Hogar (híbrida: pantalla + template + workflow)

**Configuración (template):**
```
config/actions/HRES/
  HRES-00001.docx                            — template reporte de reserva
```

**Siniestro L-000000001:**
```
claims/L-000000001/
  actions/
    L-000000001-HRES-0001/                     — reserva hogar #1
      L-000000001-HRES-0001.docx               — reporte automático generado desde template
      documents/
        L-000000001-HRES-0001-DOC-0001.pdf      — documento extra de respaldo
      images/
        L-000000001-HRES-0001-EVI-0001.jpg      — foto de evidencia
```

### Tipo 4: Recepción de Impugnación (gestión muerta)

**Configuración:**
No tiene carpeta de configuración (no hay template).

**Siniestro L-000000001:**
```
claims/L-000000001/
  actions/
    L-000000001-RIM-0001/                      — recepción impugnación #1
      documents/
        L-000000001-RIM-0001-DOC-0001.pdf       — documento recibido del cliente
```

### Documentos del siniestro (no de una gestión)

**Siniestro L-000000001:**
```
claims/L-000000001/
  documents/
    L-000000001-DOC-000001.pdf                  — póliza
    L-000000001-DOC-000002.pdf                  — denuncia del siniestro
    L-000000001-DOC-000003.jpg                  — foto general del siniestro
```

Estos documentos se **vinculan** a gestiones vía BD (sin duplicar el archivo).
Ej: la póliza (DOC-000001) se vincula a la gestión L-000000001-HSOL-0001
porque se pidió como parte de la solicitud de documentos.

---

## Siniestro Completo (ejemplo con todos los tipos)

```
claims/L-000000001/
  documents/
    L-000000001-DOC-000001.pdf                  — póliza
    L-000000001-DOC-000002.pdf                  — denuncia
  actions/
    L-000000001-CIN-0001/                       — coordinación inspección (tipo 2: pantalla)
      documents/
        L-000000001-CIN-0001-DOC-0001.pdf        — oficio de coordinación
    L-000000001-HINS-0001/                      — inspección hogar (tipo 2: pantalla)
      documents/
        L-000000001-HINS-0001-DOC-0001.pdf       — croquis
      images/
        L-000000001-HINS-0001-EVI-0001.jpg       — evidencia 1
        L-000000001-HINS-0001-EVI-0002.jpg       — evidencia 2
        L-000000001-HINS-0001-DAN-0001.jpg       — daño 1
        L-000000001-HINS-0001-FIR-0001.png       — firma inspector
        L-000000001-HINS-0001-FIR-0002.png       — firma asegurado
    L-000000001-HILI-0001/                      — informe liquidación hogar (tipo 1: template+workflow)
      L-000000001-HILI-0001.docx                — informe generado
    L-000000001-HRES-0001/                      — reserva hogar (tipo 3: híbrida)
      L-000000001-HRES-0001.docx                — reporte automático
      images/
        L-000000001-HRES-0001-EVI-0001.jpg       — foto evidencia
    L-000000001-PCA-0001/                       — carta aceptación (tipo 1: template+workflow)
      L-000000001-PCA-0001.docx                 — carta generada
    L-000000001-RIM-0001/                       — recepción impugnación (tipo 4: gestión muerta)
      documents/
        L-000000001-RIM-0001-DOC-0001.pdf        — documento recibido

config/
  actions/
    HILI/
      HILI-00001.docx                          — template informe liquidación hogar
      HILI-00002.docx                          — template variante 2
    CILI/
      CILI-00001.docx                          — template informe liquidación comercial
    PCA/
      PCA-00001.docx                           — template carta de aceptación
    HRES/
      HRES-00001.docx                          — template reporte de reserva
    HSOL/
      HSOL-00001.docx                          — template solicitud documentos hogar
```

Nota: CIN, HINS y RIM NO aparecen en configuración porque no tienen template.

---

## Correlativos

| Entidad | Formato | Scope | Ejemplo |
|---------|---------|-------|---------|
| Liquidación | `L-NNNNNNNNN` | Global (secuencia BD) | L-000000001 |
| Doc siniestro | `DOC-NNNNNN` | Por siniestro | DOC-000001 |
| Template | `NNNNN` | Por código compuesto de gestión | 00001 |
| Instancia de gestión | `NNNN` | Por siniestro + código compuesto | 0001 |
| Doc extra gestión | `DOC-NNNN` | Por instancia de gestión | DOC-0001 |
| Evidencia | `EVI-NNNN` | Por instancia de gestión | EVI-0001 |
| Daño | `DAN-NNNN` | Por instancia de gestión | DAN-0001 |
| Firma | `FIR-NNNN` | Por instancia de gestión | FIR-0001 |

---

## Trazabilidad de Templates (Log)

### Tabla: `template_usage_log`

Cuando se vincula un template a una gestión, se registra:

| Campo | Descripción |
|-------|-------------|
| id | UUID |
| document_template_id | FK al template usado |
| claim_id | FK al siniestro |
| claim_action_id | FK a la instancia de gestión |
| used_by | UUID del usuario que lo usó |
| used_at | Timestamp |
| template_hash | Hash del archivo .docx en ese momento (para detectar modificaciones) |
| template_version | Versión del template al momento de uso |

### Tabla: `template_modification_log`

Cuando se modifica un template, se registra:

| Campo | Descripción |
|-------|-------------|
| id | UUID |
| document_template_id | FK al template modificado |
| modified_by | UUID del usuario |
| modified_at | Timestamp |
| old_file_url | URL del archivo anterior en R2 |
| new_file_url | URL del archivo nuevo en R2 |
| old_hash | Hash anterior |
| new_hash | Hash nuevo |
| change_description | Descripción del cambio |

### Regla:
```
Los templates se pueden modificar, pero NUNCA se sobreescribe el archivo anterior.
Cada modificación sube un nuevo archivo a R2 (nueva versión) y el anterior
se conserva para trazabilidad. Si sale un informe mal, podemos verificar
qué versión del template se usó y quién lo modificó.
```

---

## Filosofía de Nombres de Archivo

- **El nombre del archivo ES el código.** Renombramos al subir.
- El nombre original se guarda en la BD (`original_filename`) solo como referencia.
- Si se pierde la BD, los archivos se pueden localizar e identificar por su nombre.
- Todos los códigos están en el nombre: liquidación + gestión + tipo + correlativo.

---

## Implementación (pasos)

1. ✅ `lib/storage/r2-client.ts` — cliente S3 configurado para R2
2. ⬜ `lib/storage/paths.ts` — funciones generadoras de paths (actualizar con esta estructura)
3. ⬜ API route `/api/storage/upload` — subir archivo a R2 con path estructurado
4. ⬜ API route `/api/storage/download` — generar URL firmada o pública
5. ⬜ API route `/api/storage/delete` — eliminar archivo
6. ⬜ Migración: tabla `claim_documents` + `claim_document_gestions` (vinculación)
7. ⬜ Migración: tabla `template_usage_log` + `template_modification_log`
8. ⬜ Migración: agregar `code_prefix` a `business_lines` (H, C, R, V...)
9. ⬜ Migración: agregar `code` a `action_features` (INS, ILI, PCA...)
10. ⬜ Actualizar upload de plantillas para usar R2 con `gestionTemplatePath()`
11. ⬜ Actualizar upload de inspección (evidencias, firmas, croquis) para usar R2
12. ⬜ Documentar configuración de R2 en AGENTS.md
