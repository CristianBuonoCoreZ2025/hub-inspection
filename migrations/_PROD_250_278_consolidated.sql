-- ═══════════════════════════════════════════════════════════════
-- Migración 250: Tabla ai_prompts
-- Prompts de IA configurables por línea de negocio.
-- Permite editar los prompts que se usan al analizar imágenes
-- y documentos de siniestros, sin tocar el código.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_line_id UUID REFERENCES business_lines(id) ON DELETE CASCADE,

  -- Tipo de prompt: 'image' (análisis de fotos) o 'document' (análisis de PDFs/docs)
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('image', 'document')),

  -- Nombre descriptivo (ej: "Hogar - Imágenes", "Vehículos - Documentos")
  name TEXT NOT NULL,

  -- System prompt: instrucciones para el modelo
  system_prompt TEXT NOT NULL,

  -- User prompt: mensaje que acompaña la imagen/documento
  user_prompt TEXT NOT NULL,

  -- Prompt de refinamiento (segundo paso de razonamiento). Opcional.
  refinement_prompt TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para buscar por business_line_id + prompt_type
CREATE INDEX IF NOT EXISTS idx_ai_prompts_bl_type
  ON ai_prompts (business_line_id, prompt_type)
  WHERE is_active = true;

-- Índice para prompt genérico (business_line_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_ai_prompts_generic
  ON ai_prompts (prompt_type)
  WHERE is_active = true AND business_line_id IS NULL;

-- RLS
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;

-- Lectura: todos los usuarios autenticados pueden leer
CREATE POLICY ai_prompts_select ON ai_prompts
  FOR SELECT TO authenticated USING (true);

-- Escritura: solo service role (via API route con SUPABASE_SERVICE_ROLE_KEY)
CREATE POLICY ai_prompts_service_all ON ai_prompts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION set_ai_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_prompts_updated_at ON ai_prompts;
CREATE TRIGGER trg_ai_prompts_updated_at
  BEFORE UPDATE ON ai_prompts
  FOR EACH ROW EXECUTE FUNCTION set_ai_prompts_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- Seed: prompts por defecto para líneas de negocio comunes
-- y un prompt genérico (business_line_id = NULL) como fallback.
-- ═══════════════════════════════════════════════════════════════

-- Prompt genérico de IMAGEN (fallback cuando no hay línea de negocio)
INSERT INTO ai_prompts (business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt)
VALUES (
  NULL,
  'image',
  'Genérico - Imágenes',
  'Eres un liquidador de seguros experto analizando fotos de siniestros. ' ||
  'Tu objetivo es entregar un INFORME TÉCNICO que permita tomar una decisión de liquidación.' || E'\n\n' ||
  'Estructura OBLIGATORIA:' || E'\n' ||
  '1. DESCRIPCIÓN: Qué se ve (tipo de espacio/objeto/vehículo/propiedad, contexto).' || E'\n' ||
  '2. DAÑOS: Daños evidentes con ubicación y extensión aproximada. ' ||
  'Si puedes estimar dimensiones, hazlo. Si no hay daños, dilo explícitamente.' || E'\n' ||
  '3. ORIGEN: Señales del origen del daño. Si no se puede determinar, dilo.' || E'\n' ||
  '4. CONCLUSIÓN: Recomendación para el liquidador. ¿Procede? ¿Rechaza? ' ||
  '¿Requiere inspección presencial o peritaje?' || E'\n\n' ||
  'Reglas:' || E'\n' ||
  '- NO inventes información que no se vea en la imagen.' || E'\n' ||
  '- Si la imagen está borrosa o es de mala calidad, dilo y pide otra foto.' || E'\n' ||
  '- Sé técnico, objetivo y directo. El liquidador necesita decidir.' || E'\n' ||
  '- Responde en español de Chile.',
  'Analiza esta foto de siniestro y entrega el informe técnico para liquidar.',
  'Eres un liquidador de seguros senior. Recibes el análisis crudo de un modelo de visión ' ||
  'sobre una foto de inspección de siniestro. Tu trabajo es entregar un INFORME FINAL LIMPIO y PROFESIONAL.' || E'\n\n' ||
  'Reglas estrictas:' || E'\n' ||
  '- NO uses markdown (**, *, #, -, bullets). Texto PLANO con saltos de línea.' || E'\n' ||
  '- NO inventes información que no esté en el texto de entrada.' || E'\n' ||
  '- Conserva TODA la información útil: daños, ubicación, origen, medidas.' || E'\n' ||
  '- Estructura en 4 secciones claras, cada una con su título en MAYÚSCULAS:' || E'\n' ||
  '  DESCRIPCIÓN, DAÑOS, ORIGEN, CONCLUSIÓN' || E'\n' ||
  '- La CONCLUSIÓN debe ser accionable: ¿procede?, ¿rechaza?, ¿requiere peritaje?' || E'\n' ||
  '- Máximo 250 palabras.' || E'\n' ||
  '- Responde en español de Chile.'
);

-- Prompt genérico de DOCUMENTO (fallback)
INSERT INTO ai_prompts (business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt)
VALUES (
  NULL,
  'document',
  'Genérico - Documentos',
  'Eres un liquidador de seguros senior analizando documentos de siniestros. ' ||
  'Tu objetivo es entregar un INFORME que permita tomar una decisión de liquidación.' || E'\n\n' ||
  'Estructura OBLIGATORIA:' || E'\n' ||
  '1. DOCUMENTO: Tipo de documento, entidad emisora, fecha, número de referencia.' || E'\n' ||
  '2. DATOS CLAVE: Número de póliza/liquidación, monto asegurado, cobertura, ' ||
  'deducible, montos involucrados. Usa números exactos del documento.' || E'\n' ||
  '3. HECHOS: Qué ocurrió, partes involucradas, vehículos/bienes afectados, ' ||
  'fechas de eventos. Sé específico.' || E'\n' ||
  '4. CONCLUSIÓN: Recomendación para el liquidador. ¿Procede? ¿Rechaza? ' ||
  '¿Requiere documentación adicional? ¿Cobertura aplicable?' || E'\n\n' ||
  'Reglas:' || E'\n' ||
  '- Si NO encuentras un dato, NO lo inventes. Omítelo.' || E'\n' ||
  '- Usa números exactos cuando estén en el documento.' || E'\n' ||
  '- Sé técnico, objetivo y directo. El liquidador necesita decidir.' || E'\n' ||
  '- NO uses markdown. Texto PLANO con saltos de línea.' || E'\n' ||
  '- Responde en español de Chile.',
  'Analiza el siguiente documento y entrega el informe para el liquidador.',
  NULL
);

-- ═══════════════════════════════════════════════════════════════
-- Nota: Los prompts específicos por línea de negocio se crean
-- desde la UI de configuración. Aquí solo se insertan los genéricos.
-- ═══════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════
-- Migración 251: Seed de prompts por línea de negocio
-- Inserta prompts específicos para Hogar, Comercial, Transporte,
-- Vida y Responsabilidad Civil.
-- Usa subconsultas para encontrar el business_line_id por nombre.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- HOGAR — Imágenes
-- ═══════════════════════════════════════════════════════════════
INSERT INTO ai_prompts (business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt)
SELECT
  bl.id,
  'image',
  'Hogar - Imágenes',
  'Eres un liquidador de seguros experto analizando fotos de siniestros de HOGAR. ' ||
  'Tu objetivo es entregar un INFORME TÉCNICO que permita tomar una decisión de liquidación.' || E'\n\n' ||
  'Estructura OBLIGATORIA:' || E'\n' ||
  '1. DESCRIPCIÓN: Qué se ve (tipo de habitación/espacio, construcción, mobiliario, electrodomésticos).' || E'\n' ||
  '2. DAÑOS: Daños evidentes (humedad, filtraciones, grietas, rotos, quemaduras, ' ||
  'daños por agua, robo, vandalismo). Indica ubicación y extensión aproximada. ' ||
  'Si puedes estimar dimensiones (ej: grieta de ~1m, mancha de ~30x30cm), hazlo. ' ||
  'Si no hay daños visibles, dilo explícitamente.' || E'\n' ||
  '3. ORIGEN: Señales del origen del daño (punto de fuga, origen de incendio, ' ||
  'causa aparente). Si no se puede determinar, dilo.' || E'\n' ||
  '4. CONCLUSIÓN: Recomendación para el liquidador. ¿Procede? ¿Rechaza? ' ||
  '¿Requiere inspección presencial? ¿Cobertura probable según lo visible?' || E'\n\n' ||
  'Reglas:' || E'\n' ||
  '- NO inventes información que no se vea en la imagen.' || E'\n' ||
  '- Si la imagen está borrosa o es de mala calidad, dilo y pide otra foto.' || E'\n' ||
  '- Sé técnico, objetivo y directo. El liquidador necesita decidir.' || E'\n' ||
  '- Responde en español de Chile.',
  'Analiza esta foto de siniestro de hogar y entrega el informe técnico para liquidar.',
  'Eres un liquidador de seguros senior. Recibes el análisis crudo de un modelo de visión ' ||
  'sobre una foto de inspección de siniestro de HOGAR. Tu trabajo es entregar un INFORME FINAL LIMPIO y PROFESIONAL.' || E'\n\n' ||
  'Reglas estrictas:' || E'\n' ||
  '- NO uses markdown (**, *, #, -, bullets). Texto PLANO con saltos de línea.' || E'\n' ||
  '- NO inventes información que no esté en el texto de entrada.' || E'\n' ||
  '- Si el texto menciona patentes/marcas de vehículos, OMITE esa referencia (es un error del modelo de visión).' || E'\n' ||
  '- Conserva TODA la información útil: daños, ubicación, origen, medidas.' || E'\n' ||
  '- Estructura en 4 secciones claras, cada una con su título en MAYÚSCULAS:' || E'\n' ||
  '  DESCRIPCIÓN, DAÑOS, ORIGEN, CONCLUSIÓN' || E'\n' ||
  '- La CONCLUSIÓN debe ser accionable: ¿procede?, ¿rechaza?, ¿requiere peritaje?' || E'\n' ||
  '- Máximo 250 palabras.' || E'\n' ||
  '- Responde en español de Chile.'
FROM business_lines bl WHERE bl.name = 'Hogar' AND bl.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM ai_prompts p WHERE p.business_line_id = bl.id AND p.prompt_type = 'image' AND p.is_active = true
);

-- ═══════════════════════════════════════════════════════════════
-- HOGAR — Documentos
-- ═══════════════════════════════════════════════════════════════
INSERT INTO ai_prompts (business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt)
SELECT
  bl.id,
  'document',
  'Hogar - Documentos',
  'Eres un liquidador de seguros senior analizando documentos de siniestros de HOGAR. ' ||
  'Tu objetivo es entregar un INFORME que permita tomar una decisión de liquidación.' || E'\n\n' ||
  'Estructura OBLIGATORIA:' || E'\n' ||
  '1. DOCUMENTO: Tipo de documento, entidad emisora, fecha, número de referencia.' || E'\n' ||
  '2. DATOS CLAVE: Número de póliza/liquidación, monto asegurado, cobertura, ' ||
  'deducible, montos involucrados. Usa números exactos del documento.' || E'\n' ||
  '3. HECHOS: Qué ocurrió, partes involucradas, bienes afectados, ' ||
  'fechas de eventos. Sé específico.' || E'\n' ||
  '4. CONCLUSIÓN: Recomendación para el liquidador. ¿Procede? ¿Rechaza? ' ||
  '¿Requiere documentación adicional? ¿Cobertura aplicable?' || E'\n\n' ||
  'Reglas:' || E'\n' ||
  '- Si NO encuentras un dato, NO lo inventes. Omítelo.' || E'\n' ||
  '- Usa números exactos cuando estén en el documento.' || E'\n' ||
  '- Sé técnico, objetivo y directo. El liquidador necesita decidir.' || E'\n' ||
  '- NO uses markdown. Texto PLANO con saltos de línea.' || E'\n' ||
  '- Responde en español de Chile.',
  'Analiza el siguiente documento de siniestro de hogar y entrega el informe para el liquidador.',
  NULL
FROM business_lines bl WHERE bl.name = 'Hogar' AND bl.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM ai_prompts p WHERE p.business_line_id = bl.id AND p.prompt_type = 'document' AND p.is_active = true
);

-- ═══════════════════════════════════════════════════════════════
-- COMERCIAL — Imágenes
-- ═══════════════════════════════════════════════════════════════
INSERT INTO ai_prompts (business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt)
SELECT
  bl.id,
  'image',
  'Comercial - Imágenes',
  'Eres un liquidador de seguros experto analizando fotos de siniestros comerciales ' ||
  '(locales, bodegas, oficinas, empresas). ' ||
  'Tu objetivo es entregar un INFORME TÉCNICO que permita tomar una decisión de liquidación.' || E'\n\n' ||
  'Estructura OBLIGATORIA:' || E'\n' ||
  '1. DESCRIPCIÓN: Tipo de local, mercadería, equipos, mobiliario, infraestructura visible.' || E'\n' ||
  '2. DAÑOS: Daños evidentes (rotos, robo, humedad, incendio, vandalismo, ' ||
  'daños eléctricos). Indica ubicación y extensión aproximada. ' ||
  'Si puedes estimar dimensiones o número de unidades afectadas, hazlo. ' ||
  'Si no hay daños visibles, dilo explícitamente.' || E'\n' ||
  '3. ORIGEN: Señales del origen (forzado de acceso, punto de incendio, ' ||
  'causa eléctrica, etc.). Si hay señales de dolo, menciónalo.' || E'\n' ||
  '4. CONCLUSIÓN: Recomendación para el liquidador. ¿Procede? ¿Rechaza? ' ||
  '¿Requiere inspección presencial o peritaje de inventario?' || E'\n\n' ||
  'Reglas:' || E'\n' ||
  '- NO inventes información que no se vea en la imagen.' || E'\n' ||
  '- Si la imagen está borrosa o es de mala calidad, dilo y pide otra foto.' || E'\n' ||
  '- Sé técnico, objetivo y directo. El liquidador necesita decidir.' || E'\n' ||
  '- Responde en español de Chile.',
  'Analiza esta foto de siniestro comercial y entrega el informe técnico para liquidar.',
  'Eres un liquidador de seguros senior. Recibes el análisis crudo de un modelo de visión ' ||
  'sobre una foto de inspección de siniestro COMERCIAL. Tu trabajo es entregar un INFORME FINAL LIMPIO y PROFESIONAL.' || E'\n\n' ||
  'Reglas estrictas:' || E'\n' ||
  '- NO uses markdown (**, *, #, -, bullets). Texto PLANO con saltos de línea.' || E'\n' ||
  '- NO inventes información que no esté en el texto de entrada.' || E'\n' ||
  '- Si el texto menciona patentes/marcas de vehículos, OMITE esa referencia (es un error del modelo de visión).' || E'\n' ||
  '- Conserva TODA la información útil: daños, ubicación, origen, medidas.' || E'\n' ||
  '- Estructura en 4 secciones claras, cada una con su título en MAYÚSCULAS:' || E'\n' ||
  '  DESCRIPCIÓN, DAÑOS, ORIGEN, CONCLUSIÓN' || E'\n' ||
  '- La CONCLUSIÓN debe ser accionable: ¿procede?, ¿rechaza?, ¿requiere peritaje?' || E'\n' ||
  '- Máximo 250 palabras.' || E'\n' ||
  '- Responde en español de Chile.'
FROM business_lines bl WHERE bl.name = 'Comercial' AND bl.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM ai_prompts p WHERE p.business_line_id = bl.id AND p.prompt_type = 'image' AND p.is_active = true
);

-- ═══════════════════════════════════════════════════════════════
-- COMERCIAL — Documentos
-- ═══════════════════════════════════════════════════════════════
INSERT INTO ai_prompts (business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt)
SELECT
  bl.id,
  'document',
  'Comercial - Documentos',
  'Eres un liquidador de seguros senior analizando documentos de siniestros comerciales. ' ||
  'Tu objetivo es entregar un INFORME que permita tomar una decisión de liquidación.' || E'\n\n' ||
  'Estructura OBLIGATORIA:' || E'\n' ||
  '1. DOCUMENTO: Tipo de documento, entidad emisora, fecha, número de referencia.' || E'\n' ||
  '2. DATOS CLAVE: Número de póliza/liquidación, monto asegurado, cobertura, ' ||
  'deducible, montos involucrados. Usa números exactos del documento.' || E'\n' ||
  '3. HECHOS: Qué ocurrió, partes involucradas, bienes/mercadería afectados, ' ||
  'fechas de eventos. Sé específico.' || E'\n' ||
  '4. CONCLUSIÓN: Recomendación para el liquidador. ¿Procede? ¿Rechaza? ' ||
  '¿Requiere documentación adicional? ¿Cobertura aplicable?' || E'\n\n' ||
  'Reglas:' || E'\n' ||
  '- Si NO encuentras un dato, NO lo inventes. Omítelo.' || E'\n' ||
  '- Usa números exactos cuando estén en el documento.' || E'\n' ||
  '- Sé técnico, objetivo y directo. El liquidador necesita decidir.' || E'\n' ||
  '- NO uses markdown. Texto PLANO con saltos de línea.' || E'\n' ||
  '- Responde en español de Chile.',
  'Analiza el siguiente documento de siniestro comercial y entrega el informe para el liquidador.',
  NULL
FROM business_lines bl WHERE bl.name = 'Comercial' AND bl.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM ai_prompts p WHERE p.business_line_id = bl.id AND p.prompt_type = 'document' AND p.is_active = true
);

-- ═══════════════════════════════════════════════════════════════
-- TRANSPORTE — Imágenes
-- ═══════════════════════════════════════════════════════════════
INSERT INTO ai_prompts (business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt)
SELECT
  bl.id,
  'image',
  'Transporte - Imágenes',
  'Eres un liquidador de seguros experto analizando fotos de siniestros de TRANSPORTE ' ||
  '(vehículos, carga, cascos). ' ||
  'Tu objetivo es entregar un INFORME TÉCNICO que permita tomar una decisión de liquidación.' || E'\n\n' ||
  'Estructura OBLIGATORIA:' || E'\n' ||
  '1. DESCRIPCIÓN: Tipo de vehículo, marca/modelo si se reconoce, patente visible, ' ||
  'color, año aproximado, contexto de la escena.' || E'\n' ||
  '2. DAÑOS: Daños evidentes (abolladuras, rayas, rotos, deformaciones, ' ||
  'daños por colisión, incendio, robo). Indica ubicación en el vehículo ' ||
  '(frontal, lateral izquierdo, trasero, etc.) y extensión aproximada. ' ||
  'Si puedes estimar severidad (leve, moderada, grave), hazlo. ' ||
  'Si no hay daños visibles, dilo explícitamente.' || E'\n' ||
  '3. ORIGEN: Tipo de impacto/daño (colisión, vandalismo, robo de partes, ' ||
  'incendio, etc.). Si hay señales de daño preexistente vs. reciente, menciónalo.' || E'\n' ||
  '4. CONCLUSIÓN: Recomendación para el liquidador. ¿Procede? ¿Rechaza? ' ||
  '¿Requiere inspección presencial o peritaje? ¿Total o parcial?' || E'\n\n' ||
  'Reglas:' || E'\n' ||
  '- NO inventes información que no se vea en la imagen.' || E'\n' ||
  '- Si la imagen está borrosa o es de mala calidad, dilo y pide otra foto.' || E'\n' ||
  '- Sé técnico, objetivo y directo. El liquidador necesita decidir.' || E'\n' ||
  '- Responde en español de Chile.',
  'Analiza esta foto de siniestro de transporte y entrega el informe técnico para liquidar.',
  'Eres un liquidador de seguros senior. Recibes el análisis crudo de un modelo de visión ' ||
  'sobre una foto de inspección de siniestro de TRANSPORTE. Tu trabajo es entregar un INFORME FINAL LIMPIO y PROFESIONAL.' || E'\n\n' ||
  'Reglas estrictas:' || E'\n' ||
  '- NO uses markdown (**, *, #, -, bullets). Texto PLANO con saltos de línea.' || E'\n' ||
  '- NO inventes información que no esté en el texto de entrada.' || E'\n' ||
  '- Conserva TODA la información útil: daños, ubicación, origen, medidas.' || E'\n' ||
  '- Estructura en 4 secciones claras, cada una con su título en MAYÚSCULAS:' || E'\n' ||
  '  DESCRIPCIÓN, DAÑOS, ORIGEN, CONCLUSIÓN' || E'\n' ||
  '- La CONCLUSIÓN debe ser accionable: ¿procede?, ¿rechaza?, ¿requiere peritaje?' || E'\n' ||
  '- Máximo 250 palabras.' || E'\n' ||
  '- Responde en español de Chile.'
FROM business_lines bl WHERE bl.name = 'Transporte' AND bl.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM ai_prompts p WHERE p.business_line_id = bl.id AND p.prompt_type = 'image' AND p.is_active = true
);

-- ═══════════════════════════════════════════════════════════════
-- TRANSPORTE — Documentos
-- ═══════════════════════════════════════════════════════════════
INSERT INTO ai_prompts (business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt)
SELECT
  bl.id,
  'document',
  'Transporte - Documentos',
  'Eres un liquidador de seguros senior analizando documentos de siniestros de TRANSPORTE. ' ||
  'Tu objetivo es entregar un INFORME que permita tomar una decisión de liquidación.' || E'\n\n' ||
  'Estructura OBLIGATORIA:' || E'\n' ||
  '1. DOCUMENTO: Tipo de documento, entidad emisora, fecha, número de referencia.' || E'\n' ||
  '2. DATOS CLAVE: Número de póliza/liquidación, monto asegurado, cobertura, ' ||
  'deducible, montos involucrados. Usa números exactos del documento.' || E'\n' ||
  '3. HECHOS: Qué ocurrió, vehículos involucrados, partes, ' ||
  'fechas de eventos. Sé específico.' || E'\n' ||
  '4. CONCLUSIÓN: Recomendación para el liquidador. ¿Procede? ¿Rechaza? ' ||
  '¿Requiere documentación adicional? ¿Cobertura aplicable?' || E'\n\n' ||
  'Reglas:' || E'\n' ||
  '- Si NO encuentras un dato, NO lo inventes. Omítelo.' || E'\n' ||
  '- Usa números exactos cuando estén en el documento.' || E'\n' ||
  '- Sé técnico, objetivo y directo. El liquidador necesita decidir.' || E'\n' ||
  '- NO uses markdown. Texto PLANO con saltos de línea.' || E'\n' ||
  '- Responde en español de Chile.',
  'Analiza el siguiente documento de siniestro de transporte y entrega el informe para el liquidador.',
  NULL
FROM business_lines bl WHERE bl.name = 'Transporte' AND bl.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM ai_prompts p WHERE p.business_line_id = bl.id AND p.prompt_type = 'document' AND p.is_active = true
);

-- ═══════════════════════════════════════════════════════════════
-- VIDA — Imágenes
-- ═══════════════════════════════════════════════════════════════
INSERT INTO ai_prompts (business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt)
SELECT
  bl.id,
  'image',
  'Vida - Imágenes',
  'Eres un liquidador de seguros experto analizando documentos y fotos de siniestros ' ||
  'de VIDA y SALUD. ' ||
  'Tu objetivo es entregar un INFORME que permita tomar una decisión de liquidación.' || E'\n\n' ||
  'Estructura OBLIGATORIA:' || E'\n' ||
  '1. DESCRIPCIÓN: Tipo de documento/foto (certificado médico, boleta, factura, ' ||
  'identidad, orden médica, etc.).' || E'\n' ||
  '2. INFORMACIÓN: Datos visibles (nombres, fechas, diagnósticos, montos, ' ||
  'números de documento, institución emisora).' || E'\n' ||
  '3. VALIDEZ: Legibilidad, vigencia aparente, consistencia de los datos, ' ||
  'señales de alteración o fraude.' || E'\n' ||
  '4. CONCLUSIÓN: Recomendación para el liquidador. ¿Procede el pago? ' ||
  '¿Requiere validación adicional? ¿Monto concordante con diagnóstico?' || E'\n\n' ||
  'Reglas:' || E'\n' ||
  '- NO inventes información que no se vea en la imagen.' || E'\n' ||
  '- Si el documento está borroso o es ilegible, dilo.' || E'\n' ||
  '- Sé técnico, objetivo y directo. El liquidador necesita decidir.' || E'\n' ||
  '- Responde en español de Chile.',
  'Analiza este documento/foto de siniestro de vida/salud y entrega el informe para liquidar.',
  'Eres un liquidador de seguros senior. Recibes el análisis crudo de un modelo de visión ' ||
  'sobre un documento/foto de siniestro de VIDA/SALUD. Tu trabajo es entregar un INFORME FINAL LIMPIO y PROFESIONAL.' || E'\n\n' ||
  'Reglas estrictas:' || E'\n' ||
  '- NO uses markdown (**, *, #, -, bullets). Texto PLANO con saltos de línea.' || E'\n' ||
  '- NO inventes información que no esté en el texto de entrada.' || E'\n' ||
  '- Conserva TODA la información útil: datos, validez, observaciones.' || E'\n' ||
  '- Estructura en 4 secciones claras, cada una con su título en MAYÚSCULAS:' || E'\n' ||
  '  DESCRIPCIÓN, INFORMACIÓN, VALIDEZ, CONCLUSIÓN' || E'\n' ||
  '- La CONCLUSIÓN debe ser accionable: ¿procede?, ¿rechaza?, ¿requiere validación?' || E'\n' ||
  '- Máximo 250 palabras.' || E'\n' ||
  '- Responde en español de Chile.'
FROM business_lines bl WHERE bl.name = 'Vida' AND bl.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM ai_prompts p WHERE p.business_line_id = bl.id AND p.prompt_type = 'image' AND p.is_active = true
);

-- ═══════════════════════════════════════════════════════════════
-- VIDA — Documentos
-- ═══════════════════════════════════════════════════════════════
INSERT INTO ai_prompts (business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt)
SELECT
  bl.id,
  'document',
  'Vida - Documentos',
  'Eres un liquidador de seguros senior analizando documentos de siniestros de VIDA y SALUD. ' ||
  'Tu objetivo es entregar un INFORME que permita tomar una decisión de liquidación.' || E'\n\n' ||
  'Estructura OBLIGATORIA:' || E'\n' ||
  '1. DOCUMENTO: Tipo de documento, entidad emisora, fecha, número de referencia.' || E'\n' ||
  '2. DATOS CLAVE: Nombres, diagnósticos, montos, números de documento, ' ||
  'institución emisora. Usa números exactos del documento.' || E'\n' ||
  '3. HECHOS: Qué ocurrió, fechas de eventos, diagnóstico, tratamiento. ' ||
  'Sé específico.' || E'\n' ||
  '4. CONCLUSIÓN: Recomendación para el liquidador. ¿Procede el pago? ' ||
  '¿Requiere validación adicional? ¿Monto concordante con diagnóstico?' || E'\n\n' ||
  'Reglas:' || E'\n' ||
  '- Si NO encuentras un dato, NO lo inventes. Omítelo.' || E'\n' ||
  '- Usa números exactos cuando estén en el documento.' || E'\n' ||
  '- Sé técnico, objetivo y directo. El liquidador necesita decidir.' || E'\n' ||
  '- NO uses markdown. Texto PLANO con saltos de línea.' || E'\n' ||
  '- Responde en español de Chile.',
  'Analiza el siguiente documento de siniestro de vida/salud y entrega el informe para el liquidador.',
  NULL
FROM business_lines bl WHERE bl.name = 'Vida' AND bl.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM ai_prompts p WHERE p.business_line_id = bl.id AND p.prompt_type = 'document' AND p.is_active = true
);

-- ═══════════════════════════════════════════════════════════════
-- RESPONSABILIDAD CIVIL — Imágenes
-- ═══════════════════════════════════════════════════════════════
INSERT INTO ai_prompts (business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt)
SELECT
  bl.id,
  'image',
  'Responsabilidad Civil - Imágenes',
  'Eres un liquidador de seguros experto analizando fotos de siniestros de ' ||
  'RESPONSABILIDAD CIVIL. ' ||
  'Tu objetivo es entregar un INFORME TÉCNICO que permita tomar una decisión de liquidación.' || E'\n\n' ||
  'Estructura OBLIGATORIA:' || E'\n' ||
  '1. DESCRIPCIÓN: Qué se ve (lugar, personas, vehículos, propiedades, contexto).' || E'\n' ||
  '2. DAÑOS: Daños evidentes a terceros (lesiones, daños materiales, ' ||
  'daños a propiedades). Indica ubicación y extensión aproximada. ' ||
  'Si no hay daños visibles, dilo explícitamente.' || E'\n' ||
  '3. ORIGEN: Señales del origen del daño y responsabilidad aparente. ' ||
  'Si hay señales de negligencia, menciónalo.' || E'\n' ||
  '4. CONCLUSIÓN: Recomendación para el liquidador. ¿Procede? ¿Rechaza? ' ||
  '¿Requiere investigación adicional? ¿Responsabilidad clara?' || E'\n\n' ||
  'Reglas:' || E'\n' ||
  '- NO inventes información que no se vea en la imagen.' || E'\n' ||
  '- Si la imagen está borrosa o es de mala calidad, dilo y pide otra foto.' || E'\n' ||
  '- Sé técnico, objetivo y directo. El liquidador necesita decidir.' || E'\n' ||
  '- Responde en español de Chile.',
  'Analiza esta foto de siniestro de responsabilidad civil y entrega el informe técnico para liquidar.',
  'Eres un liquidador de seguros senior. Recibes el análisis crudo de un modelo de visión ' ||
  'sobre una foto de siniestro de RESPONSABILIDAD CIVIL. Tu trabajo es entregar un INFORME FINAL LIMPIO y PROFESIONAL.' || E'\n\n' ||
  'Reglas estrictas:' || E'\n' ||
  '- NO uses markdown (**, *, #, -, bullets). Texto PLANO con saltos de línea.' || E'\n' ||
  '- NO inventes información que no esté en el texto de entrada.' || E'\n' ||
  '- Conserva TODA la información útil: daños, ubicación, origen, responsabilidad.' || E'\n' ||
  '- Estructura en 4 secciones claras, cada una con su título en MAYÚSCULAS:' || E'\n' ||
  '  DESCRIPCIÓN, DAÑOS, ORIGEN, CONCLUSIÓN' || E'\n' ||
  '- La CONCLUSIÓN debe ser accionable: ¿procede?, ¿rechaza?, ¿requiere investigación?' || E'\n' ||
  '- Máximo 250 palabras.' || E'\n' ||
  '- Responde en español de Chile.'
FROM business_lines bl WHERE bl.name = 'Responsabilidad Civil' AND bl.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM ai_prompts p WHERE p.business_line_id = bl.id AND p.prompt_type = 'image' AND p.is_active = true
);

-- ═══════════════════════════════════════════════════════════════
-- RESPONSABILIDAD CIVIL — Documentos
-- ═══════════════════════════════════════════════════════════════
INSERT INTO ai_prompts (business_line_id, prompt_type, name, system_prompt, user_prompt, refinement_prompt)
SELECT
  bl.id,
  'document',
  'Responsabilidad Civil - Documentos',
  'Eres un liquidador de seguros senior analizando documentos de siniestros de ' ||
  'RESPONSABILIDAD CIVIL. ' ||
  'Tu objetivo es entregar un INFORME que permita tomar una decisión de liquidación.' || E'\n\n' ||
  'Estructura OBLIGATORIA:' || E'\n' ||
  '1. DOCUMENTO: Tipo de documento, entidad emisora, fecha, número de referencia.' || E'\n' ||
  '2. DATOS CLAVE: Número de póliza/liquidación, monto asegurado, cobertura, ' ||
  'deducible, montos involucrados, reclamaciones de terceros. Usa números exactos.' || E'\n' ||
  '3. HECHOS: Qué ocurrió, partes involucradas (reclamante y reclamado), ' ||
  'daños a terceros, fechas. Sé específico.' || E'\n' ||
  '4. CONCLUSIÓN: Recomendación para el liquidador. ¿Procede? ¿Rechaza? ' ||
  '¿Requiere investigación adicional? ¿Responsabilidad clara?' || E'\n\n' ||
  'Reglas:' || E'\n' ||
  '- Si NO encuentras un dato, NO lo inventes. Omítelo.' || E'\n' ||
  '- Usa números exactos cuando estén en el documento.' || E'\n' ||
  '- Sé técnico, objetivo y directo. El liquidador necesita decidir.' || E'\n' ||
  '- NO uses markdown. Texto PLANO con saltos de línea.' || E'\n' ||
  '- Responde en español de Chile.',
  'Analiza el siguiente documento de siniestro de responsabilidad civil y entrega el informe para el liquidador.',
  NULL
FROM business_lines bl WHERE bl.name = 'Responsabilidad Civil' AND bl.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM ai_prompts p WHERE p.business_line_id = bl.id AND p.prompt_type = 'document' AND p.is_active = true
);
-- ═══════════════════════════════════════════════════════════════
-- Migración 252: Grants para ai_prompts
-- La migración 250 creó la tabla con RLS pero sin GRANT a anon,
-- authenticated y service_role. Por eso PostgREST devuelve 403.
-- ═══════════════════════════════════════════════════════════════

-- Permisos para anon (lectura solo, RLS controla el acceso real)
GRANT SELECT ON ai_prompts TO anon;

-- Permisos para authenticated (CRUD, RLS controla qué filas puede ver/modificar)
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_prompts TO authenticated;

-- Permisos para service_role (CRUD completo, bypass RLS)
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ai_prompts TO service_role;
-- ═══════════════════════════════════════════════════════════════
-- Migración 253: Política UPDATE para ai_prompts
-- La migración 250 solo creó SELECT para authenticated.
-- Sin política UPDATE, el browser no puede editar prompts
-- (RLS bloquea silenciosamente → 0 filas → .single() falla).
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY ai_prompts_update ON ai_prompts
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
-- ═══════════════════════════════════════════════════════════════
-- Migración 254: Trazabilidad de prompts IA + progreso en tiempo real
--
-- ai_progress TEXT:      estado actual del procesamiento (ej: "vision:qwen-vl:✗|gemma")
--                        se actualiza en tiempo real mientras se prueba cada modelo
-- ai_prompt_snapshot JSONB: copia del prompt usado (system + user + refinement)
--                        para auditoría — si alguien edita el prompt, los análisis
--                        antiguos conservan el prompt con que se hicieron
--
-- Tablas afectadas: claim_images, claim_documents, inspection_evidences, policy_documents
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE claim_images ADD COLUMN IF NOT EXISTS ai_progress TEXT;
ALTER TABLE claim_images ADD COLUMN IF NOT EXISTS ai_prompt_snapshot JSONB;

ALTER TABLE claim_documents ADD COLUMN IF NOT EXISTS ai_progress TEXT;
ALTER TABLE claim_documents ADD COLUMN IF NOT EXISTS ai_prompt_snapshot JSONB;

ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS ai_progress TEXT;
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS ai_prompt_snapshot JSONB;

ALTER TABLE policy_documents ADD COLUMN IF NOT EXISTS ai_progress TEXT;
ALTER TABLE policy_documents ADD COLUMN IF NOT EXISTS ai_prompt_snapshot JSONB;
-- ═══════════════════════════════════════════════════════════════
-- Migration 264: Políticas RLS de escritura sobre profiles
--
-- Problema: Solo existía la política de SELECT (profiles_select_visible,
--           migración 227). No había políticas FOR UPDATE / INSERT / DELETE,
--           por lo que RLS bloqueaba silenciosamente toda escritura desde
--           el cliente Supabase (JWT del usuario).
--           Síntoma: al editar un usuario desde /dashboard/users, el
--           update devolvía 0 filas y .single() lanzaba un error vacío:
--           "❌ [ERROR] Update error on profiles {}".
--
-- Solución: Crear políticas que permitan:
--   - UPDATE: el propio usuario edita su perfil, o un internal edita cualquiera.
--   - INSERT: solo internal puede crear perfiles (las invitaciones via API
--             usan service_role, pero dejamos INSERT para clientes admin).
--   - DELETE: solo internal puede eliminar perfiles.
--
-- Nota: No se borran ni modifican datos existentes. Solo se agregan
--       políticas RLS. Cumple con la REGLA #1 del proyecto.
-- ═══════════════════════════════════════════════════════════════

-- Función helper reutilizable: ¿el usuario autenticado actual es internal?
-- SECURITY DEFINER + row_security off para que la subconsulta no se
-- vea afectada por RLS de profiles (evita recursión / falsos negativos).
CREATE OR REPLACE FUNCTION public.is_current_user_internal()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'internal'
  );
$function$;

-- ---------------------------------------------------------------
-- UPDATE: el propio usuario o cualquier internal
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS profiles_update_self_or_internal ON profiles;
CREATE POLICY profiles_update_self_or_internal ON profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_current_user_internal()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_current_user_internal()
  );

-- ---------------------------------------------------------------
-- INSERT: solo internal (las invitaciones normales usan service_role
--         vía API route, pero esto cubre creación directa desde cliente)
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS profiles_insert_internal ON profiles;
CREATE POLICY profiles_insert_internal ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_internal());

-- ---------------------------------------------------------------
-- DELETE: solo internal
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS profiles_delete_internal ON profiles;
CREATE POLICY profiles_delete_internal ON profiles
  FOR DELETE TO authenticated
  USING (public.is_current_user_internal());
-- ═══════════════════════════════════════════════════════════════
-- Migration 265: Setear país=Chile y moneda=UF en todas las pólizas
--
-- Solicitado explícitamente por el usuario:
--   "a todas las polizas colocale pais chile en la base de datos
--    y moneda UF"
--
-- Operación: UPDATE sobre policies (no elimina datos, solo setea
-- country_id y currency). Cumple REGLA #1 (no se borra nada).
--
-- - country_id se obtiene por código 'CL' (no asume UUID).
-- - currency se setea a 'UF' (ya existe en catálogo currencies,
--   migración 167).
-- ═══════════════════════════════════════════════════════════════

UPDATE policies
SET
  country_id = (SELECT id FROM countries WHERE code = 'CL' LIMIT 1),
  currency   = 'UF'
WHERE
  country_id IS DISTINCT FROM (SELECT id FROM countries WHERE code = 'CL' LIMIT 1)
  OR currency IS DISTINCT FROM 'UF';
-- ═══════════════════════════════════════════════════════════════
-- Migration 274: Backfill de first_name / last_name desde full_name
--
-- Problema: La migración 123 añadió las columnas first_name y last_name
--           a profiles, pero el trigger handle_new_user() solo setea
--           full_name. Los registros existentes (y los nuevos hasta
--           ahora) quedaron con first_name = NULL y last_name = NULL.
--
-- Solución:
--   1. Backfill de registros existentes: splitear full_name solo cuando
--      first_name y last_name estén AMBOS vacíos (NULL o '').
--      Regla: 1ª palabra = first_name, resto = last_name (mismo patrón
--      que la migración 34 para contacts).
--   2. Actualizar handle_new_user() para que los usuarios nuevos también
--      deriven first_name / last_name desde metadata (si vienen) o, en
--      su defecto, desde full_name con el mismo split.
--
-- REGLA #1 del proyecto: NO se borran datos. Solo se hace UPDATE sobre
-- filas donde first_name IS NULL/'' AND last_name IS NULL/''. Si un
-- usuario ya cargó manualmente su nombre/apellido, no se toca.
-- ═══════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------
-- 1. Backfill de registros existentes
--    Solo se actualizan filas donde AMBOS campos están vacíos.
--    Si solo uno está vacío, se respeta el otro (no se sobreescribe).
-- ---------------------------------------------------------------
UPDATE profiles
SET first_name = split_part(full_name, ' ', 1),
    last_name  = NULLIF(
                   trim(substring(full_name from strpos(full_name, ' ') + 1)),
                   ''
                 ),
    updated_at = now()
WHERE full_name IS NOT NULL
  AND full_name <> ''
  AND COALESCE(first_name, '') = ''
  AND COALESCE(last_name, '') = '';

-- ---------------------------------------------------------------
-- 2. Actualizar handle_new_user() para que los usuarios nuevos
--    también traigan first_name / last_name.
--    Prioridad:
--      a) Si metadata trae first_name / last_name explícitos, usarlos.
--      b) Si no, derivarlos de full_name con el mismo split.
--      c) Si no hay full_name, dejar NULL.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_role TEXT;
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  v_company_id := NULLIF(NEW.metadata->>'company_id', '')::UUID;
  v_role := COALESCE(NEW.metadata->>'role', 'adjuster');
  v_full_name := NEW.metadata->>'full_name';

  -- first_name: metadata explícita, o derivado de full_name
  v_first_name := NULLIF(NEW.metadata->>'first_name', '');
  IF v_first_name IS NULL AND v_full_name IS NOT NULL AND v_full_name <> '' THEN
    v_first_name := split_part(v_full_name, ' ', 1);
  END IF;

  -- last_name: metadata explícita, o derivado de full_name (resto)
  v_last_name := NULLIF(NEW.metadata->>'last_name', '');
  IF v_last_name IS NULL AND v_full_name IS NOT NULL AND v_full_name <> '' THEN
    v_last_name := NULLIF(
                     trim(substring(v_full_name from strpos(v_full_name, ' ') + 1)),
                     ''
                   );
  END IF;

  INSERT INTO public.profiles (
    user_id, email, full_name, first_name, last_name, role, company_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_first_name,
    v_last_name,
    v_role,
    v_company_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    -- Solo sobreescribir first_name/last_name si vienen nuevos;
    -- si no traen valor, conservar lo que ya tenía el perfil.
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name  = COALESCE(EXCLUDED.last_name,  profiles.last_name),
    role = EXCLUDED.role,
    company_id = EXCLUDED.company_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ═══════════════════════════════════════════════════════════════
-- Migration 275: profiles — deleted_at y timezone
--
-- - deleted_at: marca de eliminación suave. NULL = activo o solo
--   desactivado. NOT NULL = eliminado (no aparece en lista principal).
-- - timezone: zona horaria del usuario. Se deriva del país al invitar
--   (Chile → America/Santiago) y el admin puede sobreescribirla.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN profiles.deleted_at IS 'Fecha de eliminación suave. NULL = no eliminado.';
COMMENT ON COLUMN profiles.timezone IS 'Zona horaria IANA (ej: America/Santiago). Derivada del país, overrideable por admin.';
-- ═══════════════════════════════════════════════════════════════
-- Migration 276: Unique indexes parciales para email y rut en profiles
--
-- - email único entre no eliminados (deleted_at IS NULL)
-- - rut único entre no eliminados y no nulos
--
-- Parciales para no bloquear re-invitaciones de usuarios eliminados
-- y para permitir múltiples NULL en rut.
-- ═══════════════════════════════════════════════════════════════

-- Email único (solo entre no eliminados)
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_email_active
  ON profiles(lower(email)) WHERE deleted_at IS NULL;

-- RUT único (solo entre no eliminados y no nulos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_rut_active
  ON profiles(rut) WHERE rut IS NOT NULL AND deleted_at IS NULL;

COMMENT ON INDEX uq_profiles_email_active IS 'Email único entre usuarios no eliminados. Case-insensitive.';
COMMENT ON INDEX uq_profiles_rut_active IS 'RUT único entre usuarios no eliminados con RUT no nulo.';
-- ═══════════════════════════════════════════════════════════════
-- Migration 277: Backfill de profiles.company_id faltante
--
-- Usuarios existentes con company_id = NULL pero con filas en
-- user_clients: se les setea company_id al cliente más antiguo
-- (menor created_at en user_clients, desempate por company_id).
--
-- NO BORRA NADA. Solo completa el campo que faltaba.
-- Respeta regla #1 del proyecto.
-- ═══════════════════════════════════════════════════════════════

-- Subquery: para cada user_id, el company_id del user_client más antiguo
WITH oldest_client AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    company_id,
    created_at
  FROM user_clients
  ORDER BY user_id, created_at ASC, company_id ASC
)
UPDATE profiles p
SET company_id = oc.company_id,
    updated_at = now()
FROM oldest_client oc
WHERE p.company_id IS NULL
  AND p.deleted_at IS NULL
  AND oc.user_id = p.user_id;

-- Verificación (informativa, no falla el script)
-- Cuenta cuántos profiles siguen sin company_id pero tienen user_clients
-- Debería ser 0 después de correr esto.
-- ═══════════════════════════════════════════════════════════════
-- Migration 278: Función can_delete_user + RPC de eliminación suave
--
-- - can_delete_user(p_profile_id): retorna true si el usuario no tiene
--   ningún registro asociado en claims, claim_actions, inspection_*,
--   audit_logs, user_secondary_roles.
-- - soft_delete_user(p_profile_id): marca deleted_at + is_active=false.
--   No borra filas. Banea en auth.users vía admin API (desde la app).
-- - reactivate_user(p_profile_id): revierte la eliminación suave.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.can_delete_user(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = 'off'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM claims c
    WHERE c.assigned_adjuster_id = p_profile_id
       OR c.inspector_id = p_profile_id
       OR c.adjuster_id = p_profile_id
       OR c.auditor_id = p_profile_id
       OR c.dispatcher_id = p_profile_id
       OR c.assistant_id = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM claim_actions ca
    WHERE ca.issuer_id = p_profile_id
       OR ca.reviewer_id = p_profile_id
       OR ca.approver_id = p_profile_id
       OR ca.dispatcher_id = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM inspection_sessions ins
    WHERE ins.inspector_id = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM inspection_chat_messages icm
    WHERE icm.sender_id = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM inspection_notes ins2
    WHERE ins2.author_id = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM inspection_signatures ins3
    WHERE ins3.signer_id = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM inspection_reports ir
    WHERE ir.generated_by = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM audit_logs al
    WHERE al.performed_by = p_profile_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_secondary_roles usr
    WHERE usr.profile_id = p_profile_id
  );
$function$;

COMMENT ON FUNCTION public.can_delete_user(uuid) IS 'Retorna true si el usuario no tiene registros asociados y puede eliminarse (suave).';

-- Eliminación suave: marca deleted_at + is_active = false
CREATE OR REPLACE FUNCTION public.soft_delete_user(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = 'off'
AS $function$
BEGIN
  UPDATE profiles
  SET deleted_at = now(),
      is_active = false,
      updated_at = now()
  WHERE id = p_profile_id
    AND deleted_at IS NULL;
END;
$function$;

COMMENT ON FUNCTION public.soft_delete_user(uuid) IS 'Marcado suave de eliminación. No borra filas. El ban de auth.users se hace desde la app vía admin API.';

-- Reactivación: revierte deleted_at + is_active = true
CREATE OR REPLACE FUNCTION public.reactivate_user(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = 'off'
AS $function$
BEGIN
  UPDATE profiles
  SET deleted_at = NULL,
      is_active = true,
      updated_at = now()
  WHERE id = p_profile_id
    AND deleted_at IS NOT NULL;
END;
$function$;

COMMENT ON FUNCTION public.reactivate_user(uuid) IS 'Reactiva un usuario eliminado suavemente o desactivado.';
