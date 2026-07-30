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
