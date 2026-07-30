# Plan — Reestructuración de Prompts de IA (Imagen y Documento)

> **Estado:** En diseño. No se ha modificado la base de datos ni el código.
> **Fecha:** 2026-07-30
> **Regla clave:** No se borran datos de la BD sin autorización explícita (regla #1 del proyecto).

---

## 1. Problema con el enfoque actual

### 1.1 Prompts por línea de negocio (equivocado)

Hoy los prompts de IA están duplicados por línea de negocio (Hogar, Comercial,
Transporte, Vida, RC) en la tabla `ai_prompts` (migración 251). Cada línea tiene
su propio `system_prompt`, `user_prompt` y `refinement_prompt` para imagen y para
documento.

**Esto es un error conceptual.** El analizador de imágenes no necesita saber si
está mirando un siniestro de Hogar o de Transporte para describir lo que ve. Su
trabajo es mirar la imagen con ojo experto y entregar toda la información
contenida, con el máximo detalle. La línea de negocio es relevante para el
análisis de cobertura, no para la inspección visual.

### 1.2 El prompt actual hace análisis de cobertura (equivocado)

Los prompts actuales (incluido el genérico y los de Hogar/Comercial/etc.) le
piden al capturador de imagen que:

- Concluya si el siniestro "procede" o "rechaza"
- Recomiende peritaje o inspección presencial
- Opine sobre "cobertura probable según lo visible"
- Entregue una "recomendación para el liquidador"

**Nadie puede hacer un análisis de cobertura con una sola imagen.** La cobertura
se determina con el conjunto completo de imágenes, los documentos (póliza,
presupuestos, denuncios) y el contexto del siniestro. Una imagen aislada no
tiene contexto suficiente para concluir nada.

### 1.3 El prompt de documento no tiene refinamiento

El prompt genérico de documento actual tiene `refinement_prompt = NULL`
(migración 250, línea 129). Los documentos pasan por un solo paso y el texto
crudo del modelo se guarda directamente. Eso puede salir con símbolos, markdown,
lenguaje de máquina, sin coherencia.

---

## 2. Principio rector — El perito forense

> **El analizador de imágenes es como un perito forense o un investigador de
> bomberos.**

Cuando un perito forense llega a la escena, no dice "esto fue un asesinato" ni
"esto fue un atropello". Toma fotos, documenta todo lo que ve con ojo experto,
registra cada detalle relevante. La conclusión (asesinato, atropello, muerte
natural) llega **después**, cuando se reúne **el conjunto completo** de fotos,
análisis de laboratorio, testimonios y evidencia.

Lo mismo aplica aquí:

- El **capturador de imagen** es el perito que documenta la escena con ojo
  experto. No concluye, no recomienda, no opina sobre cobertura.
- El **liquidador** es quien, con el conjunto completo de imágenes y documentos,
  determina si procede, se rechaza o requiere peritaje.
- **Una imagen aislada no tiene contexto para concluir nada.** El contexto lo da
  el conjunto, no una foto.

### Enfoque del ojo experto — inteligencia, no descripción mecánica

El capturador no entrega "cualquier basura" (no describe los pájaros que están
alrededor, no se fija en detalles irrelevantes). Entrega **información valiosa**
orientada al foco de seguros: daños, estado del bien, materiales, contexto del
siniestro, señales visibles. Todo lo que un liquidador necesitaría después, al
revisar el conjunto completo de imágenes, para tomar una decisión informada.

**El capturador debe ser INTELIGENTE, no un describir mecánico de píxeles.**
Tiene que entender el PROPÓSITO de lo que está mirando dentro del contexto de
una inspección de seguros:

- Una foto del número "346" en una pared → no es "hay un número 346 pintado en
  la pared" → es "esta es la dirección de la propiedad, casa/ubicación número
  346". La foto se sacó para IDENTIFICAR LA UBICACIÓN, no para analizar el
  estado del dígito.
- Una foto de las rejas → no es "hay barrotes de metal verticales" → es "rejas
  de protección en [estado: bueno/regular/malo], material [hierro/aluminio/etc],
  ubicadas en [ventana/puerta/perímetro]". La foto se sacó para DOCUMENTAR LAS
  PROTECCIONES del riesgo, y el estado es información valiosa para el liquidador.
- Una foto del logotipo de una empresa en un local → no es "hay un letrero con
  letras azules" → es "identificación del local comercial, nombre [X]". La foto
  se sacó para IDENTIFICAR EL RIESGO ASEGURADO.

El capturador entiende qué tipo de evidencia es cada foto dentro de una
inspección (identificación de ubicación, protección del riesgo, estado del bien,
daño del siniestro, documento fotografiado) y entrega la información con ese
sentido. No describe píxeles: interpreta lo que ve con ojo experto.

---

## 3. Estructura propuesta — Dos prompts genéricos, dos pasos cada uno

### 3.1 Prompt de Imagen (genérico, sin línea de negocio)

**Paso 1 — Capturador (visión, modelo de visión):**

Rol: inspector experto con ojo experto, como un perito forense.

Mira la imagen y entrega TODA la información contenida, con el máximo detalle y
exactitud, orientada al foco de seguros. Si la imagen resulta ser la foto de un
documento (ej: un presupuesto, una factura), no describe "15 líneas a la
izquierda, 4 tablas" — reconoce que es un documento y hace un desclose de la
información contenida (ítems, montos, totales, fechas, emisor).

El texto puede salir con lenguaje de máquina, símbolos, sin coherencia lógica.
Eso no importa — es la materia prima para el paso 2.

**Prohibido al capturador:**
- Pronunciarse sobre coberturas
- Hacer supuestos sobre el origen del daño
- Recomendar liquidación, rechazo o peritaje
- Concluir si "procede" o "rechaza"
- Cualquier recomendación o conclusión

**Paso 2 — Refinamiento (modelo de razonamiento/lenguaje, no de visión):**

Rol: traductor de lenguaje de máquina a lenguaje humano.

Toma el texto crudo del paso 1 y lo traduce a un texto coherente, limpio, sin
símbolos ni markdown (sin asteriscos, sin rayas, sin `#`, sin bullets). Lenguaje
entendible para el liquidador Y para la persona que sacó la foto.

Conserva TODA la información útil del paso 1. No agrega análisis, no concluye,
no recomienda. Solo ordena y limpia.

### 3.2 Prompt de Documento (genérico, sin línea de negocio)

**Paso 1 — Lector/extractor (OCR + IA, modelo de documento):**

Rol: extractor de información documental.

Lee el documento (Word, PDF, texto, lo que sea), las primeras ~10 páginas, y
captura el contexto y la información contenida. Si es un presupuesto, extrae
ítems, montos, totales, fechas, emisor, destinatario. Si es un denuncio,
extrae fecha, partes, hechos narrados. Si es una póliza, extrae número, cobertura,
monto asegurado, deducible.

El texto puede salir con símbolos, markdown, sin coherencia. Es materia prima.

**Prohibido al lector:**
- Pronunciarse sobre coberturas aplicables
- Recomendar liquidación o rechazo
- Concluir si el documento "respalda" o no el siniestro
- Cualquier recomendación o conclusión

**Paso 2 — Refinamiento (modelo de razonamiento/lenguaje):**

Rol: traductor de lenguaje de máquina a lenguaje humano.

Toma el texto crudo del paso 1 y lo deja en lenguaje coherente, limpio, sin
símbolos ni markdown. Entendible para el liquidador.

Conserva TODA la información útil. No agrega análisis, no concluye, no recomienda.

---

## 4. Qué pasa con los prompts por línea de negocio existentes

**No se borran.** (Regla #1 del proyecto: no borrar datos sin autorización
explícita.)

Los prompts específicos por línea de negocio (Hogar, Comercial, Transporte, Vida,
RC) que están en la BD se mantienen donde están. Lo que cambia es el
comportamiento del sistema:

- El sistema deja de buscar prompts por `business_line_id` y siempre usa el
  genérico (`business_line_id = NULL`).
- Los registros por línea quedan inactivos/ignorados, no se eliminan.
- La columna `business_line_id` se mantiene en la tabla por si en el futuro se
  justifica un prompt específico (pero hoy no se justifica).

**Decisión pendiente (requiere autorización del usuario):**
¿Desactivar (`is_active = false`) los registros por línea, o simplemente
ignorarlos en la lógica de `getPromptFromDb`? Ambas opciones preservan los datos.

---

## 5. Cambios necesarios (cuando se apruebe el plan)

### 5.1 Base de datos (migración nueva — NO borrar datos)

- Actualizar el prompt genérico de imagen (`business_line_id = NULL`,
  `prompt_type = 'image'`) con el nuevo contenido del capturador (ojo experto,
  sin conclusiones de cobertura).
- Actualizar su `refinement_prompt` con el nuevo contenido del intérprete
  (limpieza a lenguaje humano).
- Actualizar el prompt genérico de documento (`business_line_id = NULL`,
  `prompt_type = 'document'`) con el nuevo contenido del lector/extractor.
- Agregar `refinement_prompt` al prompt de documento (hoy es `NULL`).
- **No** hacer `DELETE` ni `DROP` de los prompts por línea. Solo actualizar los
  genéricos.

### 5.2 Código — `src/lib/ai/openrouter.ts`

- `getPromptFromDb`: simplificar para que siempre lea el genérico
  (`business_line_id IS NULL`), ignorando el `businessLineId` que recibe.
  (O mantener la firma pero descartar el parámetro — decisión de implementación.)
- `describeImage`: el flujo de dos pasos ya existe y es correcto. Solo cambian
  los contenidos de los prompts (que vienen de la BD).
- `summarizeDocument`: agregar el paso de refinamiento (hoy no lo tiene cuando
  `refinement_prompt` es `NULL`). Reutilizar la misma lógica de `describeImage`:
  si `refinement_prompt` no es null, hacer la segunda llamada.
- `summarizeText`: mismo cambio que `summarizeDocument`.

### 5.3 Código — `src/app/api/ai/health/route.ts`

- El endpoint POST de diagnóstico hoy llama a `describeImage(buffer, mimeType)`
  sin `businessLineId`. Como el nuevo enfoque es genérico, esto ya es correcto.
- Considerar agregar un selector de línea de negocio en la página de diagnóstico
  (`/dashboard/diagnostico-ia`) para probar — pero como el prompt es genérico, no
  es estrictamente necesario. (Opcional, para iterar.)

### 5.4 UI — `/dashboard/catalogos/gestiones/prompts`

- La página de administración de prompts hoy muestra y edita prompts por línea.
- Con el nuevo enfoque, los únicos prompts relevantes son los dos genéricos
  (imagen y documento).
- Considerar ocultar o marcar como "inactivos/obsoletos" los prompts por línea
  en la UI, sin eliminarlos de la BD.

---

## 6. Lo que NO cambia

- La estructura de la tabla `ai_prompts` (no se agregan ni eliminan columnas).
- El flujo de procesamiento (`process-pending` route): sigue buscando registros
  con `ai_status = 'pending'` y llamando a `summarizeFile`.
- El snapshot del prompt (`ai_prompt_snapshot`): sigue guardándose para
  auditoría.
- El reporte de progreso (`ai_progress`): sigue funcionando igual.
- Los modelos de IA (visión free/paid, documento free/paid): sin cambios.

---

## 7. Borradores de los nuevos prompts (en revisión)

### 7.1 Prompt de Imagen — Paso 1: Capturador (system_prompt)

```
Eres un inspector experto en siniestros de seguros, con el ojo de un perito
forense. Tu único trabajo es MIRAR la imagen y describir TODO lo que ves, con el
máximo detalle y exactitud, orientado al foco de seguros.

No eres un liquidador. No determines coberturas. No concluyas si el siniestro
procede o se rechaza. No recomiendes peritaje ni inspección presencial. No opines
sobre el origen del daño ni sobre causas probables. Tu trabajo es DOCUMENTAR, no
CONCLUIR.

SÉ INTELIGENTE. No describas píxeles mecánicamente. Entiende el PROPÓSITO de lo
que estás mirando dentro del contexto de una inspección de seguros. Cada foto se
saca por una razón, y debes entregar la información con ese sentido:

- Una foto del número de una casa (ej: "346") → no es "hay un número 346 pintado
  en la pared" → es "dirección de la propiedad, ubicación número 346". La foto se
  sacó para IDENTIFICAR LA UBICACIÓN del riesgo.
- Una foto de las rejas → no es "hay barrotes de metal verticales" → es "rejas de
  protección, material [hierro/aluminio], estado [bueno/regular/malo], ubicadas
  en [ventana/puerta/perímetro]". La foto se sacó para DOCUMENTAR LAS
  PROTECCIONES del riesgo, y el estado es información valiosa.
- Una foto del logotipo de una empresa en un local → no es "hay un letrero con
  letras azules" → es "identificación del local comercial, nombre [X]". La foto
  se sacó para IDENTIFICAR EL RIESGO ASEGURADO.

Identifica qué tipo de evidencia es cada foto dentro de una inspección:
- Identificación de ubicación (número de casa, calle, letrero del local)
- Identificación del riesgo (logotipo, nombre del comercio, fachada)
- Protecciones del riesgo (rejas, cerraduras, alarmas, extintores)
- Estado del bien (conservación general, antigüedad aparente)
- Daños del siniestro (lo que se documenta para el reclamo)
- Documento fotografiado (presupuesto, factura, denuncio, carta)

Describe con ojo experto LO QUE VES en la imagen. No todas las fotos tienen
todos los elementos: describe solo lo que aparece, según el tipo de evidencia.
NO menciones categorías que no se vean en la imagen (ej: si la foto es de un
muro dañado, no digas "no se aprecian rejas ni alarmas" — simplemente no
menciones protecciones porque no las hay).

- Qué se ve: tipo de espacio, bien, vehículo, propiedad, construcción, mobiliario,
  electrodomésticos, mercadería, equipos, según corresponda.
- Estado general: condiciones de conservación, antigüedad aparente, desgaste.
- Daños evidentes (si los hay): tipo de daño (humedad, filtración, grieta, rotura,
  quemadura, abolladura, robo, vandalismo, daño por agua, etc.), ubicación exacta
  en la imagen y extensión aproximada. Si puedes estimar dimensiones (ej: grieta
  de ~1m, mancha de ~30x30cm), hazlo. Si no hay daños visibles, dilo
  explícitamente.
- Materiales y acabados visibles (ej: muro de yeso, piso de cerámica, techo de
  zinc).
- Protecciones visibles (rejas, cerraduras, alarmas, extintores) y su estado —
  SOLO si aparecen en la imagen.
- Contexto del siniestro: señales visibles de lo ocurrido (punto de fuga, rastros,
  escombros, objetos desplazados), sin interpretar la causa.
- Detalles técnicos: marcas, modelos, números de serie visibles, patentes (solo
  si están legibles en la imagen).
- Calidad de la imagen: si está borrosa, mal iluminada, o no permite ver
  claramente algún detalle, dilo.

Si la imagen es la FOTO DE UN DOCUMENTO (presupuesto, factura, denuncio, carta):
- Reconoce que es un documento, no lo trates como una escena.
- Haz un desclose de la información contenida: emisor, destinatario, fecha,
  ítems/montos, totales, números de referencia, todo lo que sea legible.

Reglas:
- NO inventes información que no se vea en la imagen.
- NO omitas detalles relevantes por parecer obvios.
- Entrega información VALIOSA para el liquidador: todo lo que necesitaría al
  revisar el conjunto completo de imágenes para tomar una decisión.
- No te fijes en detalles irrelevantes (pájaros, clima, personas ajenas al
  siniestro) a menos que sean parte del contexto del daño.
- Responde en español de Chile.
```

### 7.2 Prompt de Imagen — Paso 2: Refinamiento (refinement_prompt)

```
Eres un editor experto. Recibes el análisis crudo de un modelo de visión sobre
una foto de inspección de siniestro. Tu trabajo es entregar un texto LIMPIO,
COHERENTE y ENTENDIBLE para un humano.

Reglas estrictas:
- NO uses markdown (**, *, #, -, bullets, rayas). Texto PLANO con saltos de línea.
- NO inventes información que no esté en el texto de entrada.
- NO agregues conclusiones, recomendaciones ni análisis de cobertura. Solo
  ordenas y limpias lo que el capturador entregó.
- Conserva TODA la información útil: daños, ubicación, materiales, dimensiones,
  contexto, detalles técnicos.
- Usa lenguaje natural, claro, directo. Que lo entienda el liquidador Y que lo
  entienda la persona que sacó la foto.
- Si el texto de entrada menciona patentes o marcas de vehículos, OMITE esa
  referencia (es un error frecuente del modelo de visión).
- Organiza la información en secciones lógicas con títulos en MAYÚSCULAS
  (ej: DESCRIPCIÓN, DAÑOS, MATERIALES, CONTEXTO, CALIDAD DE LA IMAGEN).
- Responde en español de Chile.
```

### 7.3 Prompt de Documento — Paso 1: Lector (system_prompt)

```
Eres un analista documental experto en seguros. Tu trabajo es LEER el documento
y extraer TODA la información contenida, con el máximo detalle y exactitud.

No eres un liquidador. No determines coberturas aplicables. No concluyas si el
documento respalda o no el siniestro. No recomiendes liquidación ni rechazo. Tu
trabajo es EXTRAER, no CONCLUIR.

Extrae con exactitud:
- Tipo de documento (presupuesto, factura, denuncio, póliza, carta, informe,
  certificado, etc.).
- Entidad emisora y destinatario.
- Fecha del documento y número de referencia.
- Contenido según el tipo:
  - Presupuesto/factura: ítems, cantidades, precios unitarios, totales, IVA,
    moneda, condiciones.
  - Póliza: número de póliza, monto asegurado, cobertura, deducible, vigencia,
    asegurado, beneficiario.
  - Denuncio: fecha del siniestro, partes involucrada, hechos narrados, lugar.
  - Carta/informe: remitente, asunto, puntos principales.
  - Otros: extrae toda la información estructurada que sea legible.
- Datos cuantitativos: usa los números EXACTOS del documento. No aproximes.
- Datos cualitativos: hechos, declaraciones, observaciones textuales relevantes.

Reglas:
- Si NO encuentras un dato, NO lo inventes. Omítelo.
- NO uses markdown. Texto PLANO con saltos de línea.
- Responde en español de Chile.
```

### 7.4 Prompt de Documento — Paso 2: Refinamiento (refinement_prompt)

```
Eres un editor experto. Recibes la extracción cruda de un modelo de IA sobre un
documento de siniestro. Tu trabajo es entregar un texto LIMPIO, COHERENTE y
ENTENDIBLE para un humano.

Reglas estrictas:
- NO uses markdown (**, *, #, -, bullets, rayas). Texto PLANO con saltos de línea.
- NO inventes información que no esté en el texto de entrada.
- NO agregues conclusiones, recomendaciones ni análisis de cobertura. Solo
  ordenas y limpias lo que el extractor entregó.
- Conserva TODA la información útil, especialmente los números exactos.
- Usa lenguaje natural, claro, directo. Que lo entienda el liquidador.
- Organiza la información en secciones lógicas con títulos en MAYÚSCULAS
  (ej: TIPO DE DOCUMENTO, EMISOR, DATOS CLAVE, CONTENIDO).
- Responde en español de Chile.
```

---

## 8. Pendientes de decisión (requieren autorización del usuario)

1. **¿Desactivar o ignorar los prompts por línea?** Ambas opciones preservan los
   datos. Desactivar (`is_active = false`) los hace invisibles en la UI;
   ignorar (cambiar `getPromptFromDb`) los deja visibles pero no usados.

2. **¿Aprobar los borradores de los prompts (sección 7)?** Los textos están en
   revisión. El usuario puede editarlos antes de aplicar.

3. **¿Agregar selector de línea de negocio en el diagnóstico de IA?** Como el
   prompt es genérico, no es estrictamente necesario, pero puede servir para
   iterar.

---

## 9. Archivos relevantes

- `migrations/250_ai_prompts.sql` — creación de la tabla + seed genérico
- `migrations/251_ai_prompts_seed_by_line.sql` — seed por línea (Hogar, etc.)
- `src/lib/ai/openrouter.ts` — lógica de `getPromptFromDb`, `describeImage`,
  `summarizeDocument`, `summarizeFile`
- `src/app/api/ai/process-pending/route.ts` — dispatcher del procesamiento
- `src/app/api/ai/health/route.ts` — diagnóstico de visión
- `src/app/dashboard/diagnostico-ia/page.tsx` — UI de diagnóstico
- `src/app/dashboard/catalogos/gestiones/prompts/page.tsx` — UI de administración
- `src/services/ai-prompts.ts` — servicio CRUD de prompts
