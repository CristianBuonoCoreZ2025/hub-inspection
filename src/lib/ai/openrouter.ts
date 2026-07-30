import "server-only";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/server";

// ═══════════════════════════════════════════════════════════════════
// OpenRouter AI Service
//
// Estrategia: FREE primero → PAID barato después.
// Las API keys se rotan (comma-separated en env).
// ═══════════════════════════════════════════════════════════════════

/**
 * Callback para reportar progreso del análisis en tiempo real.
 * Se llama antes/después de probar cada modelo.
 * El caller (process-pending) lo usa para actualizar ai_progress en la BD.
 */
export type AiProgressCallback = (
  phase: "vision" | "document" | "refinement",
  model: string,
  status: "trying" | "failed" | "ok"
) => void;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Obtiene las API keys de OpenRouter (rotación). */
function getApiKeys(): string[] {
  const raw = process.env.OPENROUTER_API_KEY || "";
  return raw.split(",").map((k) => k.trim()).filter(Boolean);
}

/** Obtiene la lista de modelos free desde env (comma-separated). */
function getFreeModels(envVar: string): string[] {
  const raw = process.env[envVar] || "";
  return raw.split(",").map((m) => m.trim()).filter(Boolean);
}

/** Obtiene la lista de modelos paid desde env (comma-separated). */
function getPaidModels(envVar: string): string[] {
  const raw = process.env[envVar] || "";
  return raw.split(",").map((m) => m.trim()).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════
// Prompts configurables desde la BD (tabla ai_prompts)
// ═══════════════════════════════════════════════════════════════

interface AiPromptRow {
  system_prompt: string;
  user_prompt: string;
  refinement_prompt: string | null;
  source?: string;
}

/**
 * Snapshot del prompt usado en un análisis — se guarda en BD para auditoría.
 * Si alguien edita el prompt después, los análisis antiguos conservan el original.
 */
export interface PromptSnapshot {
  system_prompt: string;
  user_prompt: string;
  refinement_prompt: string | null;
  source: string;
}

/**
 * Obtiene el prompt configurado para una línea de negocio y tipo.
 * Prioridad: prompt específico de la línea > prompt genérico (business_line_id IS NULL).
 * Si no hay ninguno en la BD, retorna null (el caller usa los defaults hardcodeados).
 */
async function getPromptFromDb(
  businessLineId: string | undefined,
  promptType: "image" | "document"
): Promise<AiPromptRow | null> {
  try {
    const supabase = createAdminClient();

    // 1. Buscar prompt específico de la línea de negocio
    if (businessLineId) {
      const { data } = await supabase
        .from("ai_prompts")
        .select("system_prompt, user_prompt, refinement_prompt")
        .eq("business_line_id", businessLineId)
        .eq("prompt_type", promptType)
        .eq("is_active", true)
        .maybeSingle();
      if (data) return { ...(data as AiPromptRow), source: `line:${businessLineId}` };
    }

    // 2. Fallback: prompt genérico (business_line_id IS NULL)
    const { data: generic } = await supabase
      .from("ai_prompts")
      .select("system_prompt, user_prompt, refinement_prompt")
      .is("business_line_id", null)
      .eq("prompt_type", promptType)
      .eq("is_active", true)
      .maybeSingle();
    if (generic) return { ...(generic as AiPromptRow), source: "generic" };

    return null;
  } catch (err) {
    logger.warn("getPromptFromDb: error leyendo prompt de BD", {
      component: "openrouter",
      action: "prompt.db_read",
      metadata: { error: err instanceof Error ? err.message : String(err), businessLineId, promptType },
    });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Fallbacks mínimos (solo si la BD no tiene prompts configurados)
// Los prompts reales viven en la tabla ai_prompts y se gestionan
// desde /dashboard/catalogos/gestiones/prompts
// ═══════════════════════════════════════════════════════════════

const FALLBACK_IMAGE_PROMPT: AiPromptRow = {
  system_prompt:
    "Eres un liquidador de seguros experto. Analiza la foto del siniestro " +
    "y entrega un informe técnico con 4 secciones: DESCRIPCIÓN, DAÑOS, ORIGEN, CONCLUSIÓN. " +
    "Sé técnico, objetivo y directo. Responde en español de Chile.",
  user_prompt: "Analiza esta foto de siniestro y entrega el informe técnico para liquidar.",
  refinement_prompt: null,
  source: "fallback",
};

const FALLBACK_DOCUMENT_PROMPT: AiPromptRow = {
  system_prompt:
    "Eres un liquidador de seguros senior. Analiza el documento del siniestro " +
    "y entrega un informe con 4 secciones: DOCUMENTO, DATOS CLAVE, HECHOS, CONCLUSIÓN. " +
    "Sé técnico, objetivo y directo. Responde en español de Chile.",
  user_prompt: "Analiza el siguiente documento y entrega el informe para el liquidador.",
  refinement_prompt: null,
  source: "fallback",
};

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  error?: { message?: string; code?: string };
}

/**
 * Limpia marcadores markdown del texto retornado por la IA.
 * Los modelos a veces ignoran la instrucción "NO uses markdown" y siguen
 * emitiendo **negritas**, *cursivas*, #encabezados, -bullets, etc.
 * Esta función los elimina para que el texto se vea limpio en la UI.
 */
function cleanMarkdown(text: string): string {
  return text
    // Encabezados: "# Título", "## Título", "### Título" → "Título"
    .replace(/^#{1,6}\s+/gm, "")
    // Negrita/cursiva: **texto**, __texto__, *texto*, _texto_ → "texto"
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "$1")
    // Tachado: ~~texto~~ → "texto"
    .replace(/~~(.+?)~~/g, "$1")
    // Bullets: "- item" o "* item" al inicio de línea → "item"
    .replace(/^[\s]*[-*]\s+/gm, "")
    // Numeración: "1. item" → "item" (mantiene el número sin el punto)
    .replace(/^(\d+)\.\s+/gm, "$1. ")
    // Bloques de código: ```...``` → contenido sin los backticks
    .replace(/```[\w]*\n?([\s\S]*?)```/g, "$1")
    // Código inline: `código` → "código"
    .replace(/`([^`]+)`/g, "$1")
    // Citas: "> texto" → "texto"
    .replace(/^>\s+/gm, "")
    // Links: [texto](url) → "texto"
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Múltiples espacios seguidos → uno solo
    .replace(/[ \t]{2,}/g, " ")
    // Espacios al final de cada línea
    .replace(/[ \t]+$/gm, "")
    .trim();
}

/**
 * Llama a OpenRouter con un modelo específico.
 * Retorna el texto de respuesta o null si falla.
 */
async function callOpenRouter(
  model: string,
  messages: OpenRouterMessage[],
  apiKey: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string | null> {
  const referer = process.env.OPENROUTER_HTTP_REFERER ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": referer,
        "X-Title": "Hub Inspections",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options?.maxTokens ?? 300,
        temperature: options?.temperature ?? 0.3,
      }),
      signal: AbortSignal.timeout(30000), // 30s max por modelo
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn("OpenRouter: modelo falló", {
        component: "openrouter",
        action: "call.model",
        metadata: { model, status: res.status, error: body.slice(0, 200) },
      });
      return null;
    }

    const data = (await res.json()) as OpenRouterResponse;
    if (data.error) {
      logger.warn("OpenRouter: error en respuesta", {
        component: "openrouter",
        action: "call.model",
        metadata: { model, error: data.error.message },
      });
      return null;
    }

    const text = data.choices?.[0]?.message?.content?.trim();
    return text ? cleanMarkdown(text) : null;
  } catch (err) {
    logger.warn("OpenRouter: excepción", {
      component: "openrouter",
      action: "call.model",
      metadata: { model, error: err instanceof Error ? err.message : String(err) },
    });
    return null;
  }
}

/**
 * Intenta llamar a OpenRouter con una cadena de modelos.
 * Estrategia: recorre free models primero, luego paid models.
 * Retorna el primer resultado exitoso o null si todos fallan.
 */
async function callWithFallback(
  messages: OpenRouterMessage[],
  freeModelsEnv: string,
  paidModelsEnv: string,
  options?: { maxTokens?: number; temperature?: number; onProgress?: AiProgressCallback; phase?: "vision" | "document" | "refinement" }
): Promise<{ text: string; model: string } | null> {
  const keys = getApiKeys();
  if (keys.length === 0) {
    logger.warn("OpenRouter: no hay API keys configuradas", {
      component: "openrouter",
      action: "call.fallback",
    });
    return null;
  }

  const freeModels = getFreeModels(freeModelsEnv);
  const paidModels = getPaidModels(paidModelsEnv);
  // Siempre agregar openrouter/free al final como último recurso (auto-selecciona free disponibles)
  const chain = [...freeModels, ...paidModels];
  if (!chain.includes("openrouter/free")) {
    chain.push("openrouter/free");
  }

  if (chain.length === 0) {
    logger.warn("OpenRouter: no hay modelos configurados", {
      component: "openrouter",
      action: "call.fallback",
      metadata: { freeModelsEnv, paidModelsEnv },
    });
    return null;
  }

  const phase = options?.phase ?? "vision";
  const onProgress = options?.onProgress;
  const failedModels: string[] = [];
  for (const model of chain) {
    // Rotar keys: usar la primera key para el primer modelo, etc.
    const keyIndex = chain.indexOf(model) % keys.length;
    const apiKey = keys[keyIndex];

    // Reportar: probando este modelo
    if (onProgress) onProgress(phase, model, "trying");

    const text = await callOpenRouter(model, messages, apiKey, options);
    if (text) {
      if (onProgress) onProgress(phase, model, "ok");
      logger.info("OpenRouter: respuesta exitosa", {
        component: "openrouter",
        action: "call.fallback",
        metadata: { model, textLength: text.length },
      });
      return { text, model };
    }
    if (onProgress) onProgress(phase, model, "failed");
    failedModels.push(model);
  }

  logger.warn("OpenRouter: todos los modelos fallaron", {
    component: "openrouter",
    action: "call.fallback",
    metadata: { chain, failedModels, keysCount: keys.length },
  });
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// Visión: descripción breve de imágenes
// ═══════════════════════════════════════════════════════════════════

/**
 * Genera una descripción breve de una imagen usando modelos de visión.
 * Estrategia: free primero (Qwen > Gemma > Nemotron > Kimi), luego paid (GPT-4o-mini > GPT-4o).
 *
 * Los prompts se leen de la tabla ai_prompts según businessLineId.
 * Si no hay prompt en la BD, usa FALLBACK_IMAGE_PROMPT.
 *
 * @param buffer  Buffer de la imagen
 * @param mimeType  MIME type (image/jpeg, image/png, image/webp, etc.)
 * @param businessLineId  ID de la línea de negocio del siniestro (para seleccionar el prompt)
 * @param onProgress  Callback para reportar progreso (modelo probando/falló/ok)
 * @returns Descripción + modelo usado + snapshot del prompt (para auditoría)
 */
export async function describeImage(
  buffer: Buffer,
  mimeType: string,
  businessLineId?: string,
  onProgress?: AiProgressCallback
): Promise<{ description: string; model: string; promptSnapshot: PromptSnapshot } | null> {
  // Convertir a base64 data URL
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  // ─── Leer prompt de la BD (específico de la línea > genérico > fallback mínimo) ───
  const dbPrompt = (await getPromptFromDb(businessLineId, "image")) ?? FALLBACK_IMAGE_PROMPT;

  const systemPrompt = dbPrompt.system_prompt;
  const userPrompt = dbPrompt.user_prompt;
  const refinementPrompt = dbPrompt.refinement_prompt;

  // Snapshot del prompt para auditoría (guardar en BD junto al análisis)
  const promptSnapshot: PromptSnapshot = {
    system_prompt: systemPrompt,
    user_prompt: userPrompt,
    refinement_prompt: refinementPrompt,
    source: dbPrompt.source ?? "fallback",
  };

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: dataUrl },
        },
        {
          type: "text",
          text: userPrompt,
        },
      ],
    },
  ];

  const result = await callWithFallback(
    messages,
    "OPENROUTER_VISION_MODEL_FREE",
    "OPENROUTER_VISION_MODEL",
    { maxTokens: 1000, temperature: 0.2, onProgress, phase: "vision" }
  );

  if (!result) return null;

  // ─── SEGUNDO PASO: razonamiento que limpia y formatea el texto crudo ───
  // Si refinementPrompt es null (vacío en BD), saltar el refinamiento y usar texto crudo.
  if (refinementPrompt === null) {
    return { description: result.text, model: `vision:${result.model}`, promptSnapshot };
  }

  const refinementMessages: OpenRouterMessage[] = [
    {
      role: "system",
      content: refinementPrompt,
    },
    {
      role: "user",
      content: `Texto crudo del modelo de visión:\n\n${result.text}\n\nEntrega el informe final limpio y profesional para el liquidador.`,
    },
  ];

  const refined = await callWithFallback(
    refinementMessages,
    "OPENROUTER_DOCUMENT_MODEL_FREE",
    "OPENROUTER_DOCUMENT_MODEL",
    { maxTokens: 800, temperature: 0.3, onProgress, phase: "refinement" }
  );

  // Si el refinamiento falla, usar el texto crudo (mejor que nada)
  if (refined) {
    return {
      description: refined.text,
      model: `vision:${result.model} | razonamiento:${refined.model}`,
      promptSnapshot,
    };
  }

  return { description: result.text, model: `vision:${result.model}`, promptSnapshot };
}

// ═══════════════════════════════════════════════════════════════════
// Documentos: resumen de PDF (primeras 5 páginas)
// ═══════════════════════════════════════════════════════════════════

/**
 * Genera un resumen breve del contenido de un PDF usando IA.
 * Extrae el texto de las primeras 5 páginas y lo envía a OpenRouter.
 *
 * Estrategia: free primero (Gemma > Qwen > Gemini > Nemotron > Kimi),
 * luego paid (GPT-4o-mini > DeepSeek > Haiku > Flash).
 *
 * @param buffer  Buffer del PDF
 * @param maxPages  Máximo de páginas a analizar (default 5)
 * @returns Resumen breve o null si falla
 */
export async function summarizeDocument(
  buffer: Buffer,
  maxPages = 5,
  businessLineId?: string,
  onProgress?: AiProgressCallback
): Promise<{ ok: true; summary: string; model: string; pageCount: number; promptSnapshot: PromptSnapshot } | { ok: false; reason: string }> {
  // Extraer texto del PDF usando unpdf (server-side, sin workers)
  let pdfText = "";
  let pageCount = 0;

  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    // extractText con mergePages: false devuelve { totalPages, text: string[] } (una por página)
    const result = await extractText(pdf, { mergePages: false });
    pageCount = result.totalPages || 0;
    const pageTexts = (result.text as string[]) || [];
    // Limitar a las primeras maxPages páginas
    const analyzedPages = pageTexts.slice(0, maxPages);
    pdfText = analyzedPages.join("\n\n");
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.warn("summarizeDocument: no se pudo extraer texto del PDF", {
      component: "openrouter",
      action: "summarize.document",
      metadata: { error: errMsg, errorName: err instanceof Error ? err.name : "unknown" },
    });
    return { ok: false, reason: `unpdf falló al extraer texto: ${errMsg}` };
  }

  if (!pdfText.trim()) {
    // PDF escaneado (sin texto extraíble) — renderizar primera página a imagen y enviar a visión
    logger.info("summarizeDocument: PDF sin texto, intentando visión", {
      component: "openrouter",
      action: "summarize.document.scanned",
      metadata: { pageCount },
    });
    const scanned = await summarizeScannedPdf(buffer, pageCount, businessLineId, onProgress);
    if (scanned) return { ok: true, summary: scanned.summary, model: scanned.model, pageCount, promptSnapshot: scanned.promptSnapshot };
    return {
      ok: false,
      reason: `PDF escaneado sin texto extraíble (${pageCount} páginas). Los modelos de visión tampoco pudieron procesarlo.`,
    };
  }

  // Truncar texto a ~8000 chars para no exceder context window de modelos free
  const truncated = pdfText.length > 8000 ? pdfText.slice(0, 8000) + "\n[...texto truncado...]" : pdfText;

  // Leer prompt de la BD (específico de la línea > genérico > fallback mínimo)
  const dbPrompt = (await getPromptFromDb(businessLineId, "document")) ?? FALLBACK_DOCUMENT_PROMPT;

  const promptSnapshot: PromptSnapshot = {
    system_prompt: dbPrompt.system_prompt,
    user_prompt: dbPrompt.user_prompt,
    refinement_prompt: dbPrompt.refinement_prompt,
    source: dbPrompt.source ?? "fallback",
  };

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: dbPrompt.system_prompt,
    },
    {
      role: "user",
      content: `${dbPrompt.user_prompt}\n\n${truncated}`,
    },
  ];

  const result = await callWithFallback(
    messages,
    "OPENROUTER_DOCUMENT_MODEL_FREE",
    "OPENROUTER_DOCUMENT_MODEL",
    { maxTokens: 1500, temperature: 0.3, onProgress, phase: "document" }
  );

  if (!result) {
    return { ok: false, reason: "Texto extraído del PDF pero todos los modelos de IA fallaron (sin crédito, rate limit o error de OpenRouter)" };
  }

  return { ok: true, summary: result.text, model: result.model, pageCount, promptSnapshot };
}

/**
 * Para PDFs escaneados (sin texto extraíble): renderiza la primera página a imagen
 * con unpdf (renderPageAsImage) y la envía a un modelo de visión.
 * Usa el prompt de tipo "document" de la BD (es un documento, no una foto de siniestro).
 */
async function summarizeScannedPdf(
  buffer: Buffer,
  pageCount: number,
  businessLineId?: string,
  onProgress?: AiProgressCallback
): Promise<{ summary: string; model: string; promptSnapshot: PromptSnapshot } | null> {
  try {
    const { renderPageAsImage, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const pagesToRender = Math.min(3, pageCount || 1);
    const dataUrls: string[] = [];

    for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
      try {
        const dataUrl = await renderPageAsImage(pdf, pageNum, { scale: 1.5, toDataURL: true });
        if (dataUrl) dataUrls.push(dataUrl);
      } catch (pageErr) {
        logger.warn("summarizeScannedPdf: falló render de página", {
          component: "openrouter",
          action: "summarize.scanned.page",
          metadata: { pageNum, error: pageErr instanceof Error ? pageErr.message : String(pageErr) },
        });
      }
    }

    if (dataUrls.length === 0) return null;

    // Construir mensaje con hasta 3 imágenes (la primera es la más importante)
    const imageContent = dataUrls.slice(0, 3).map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    }));

    // Leer prompt de la BD (tipo "document" — es un documento escaneado)
    const dbPrompt = (await getPromptFromDb(businessLineId, "document")) ?? FALLBACK_DOCUMENT_PROMPT;

    const promptSnapshot: PromptSnapshot = {
      system_prompt: dbPrompt.system_prompt,
      user_prompt: dbPrompt.user_prompt,
      refinement_prompt: dbPrompt.refinement_prompt,
      source: dbPrompt.source ?? "fallback",
    };

    const messages: OpenRouterMessage[] = [
      {
        role: "system",
        content: dbPrompt.system_prompt,
      },
      {
        role: "user",
        content: [
          ...imageContent,
          { type: "text", text: `${dbPrompt.user_prompt}\n\nAnaliza estas ${dataUrls.length} página(s) de un PDF escaneado.` },
        ],
      },
    ];

    const result = await callWithFallback(
      messages,
      "OPENROUTER_VISION_MODEL_FREE",
      "OPENROUTER_VISION_MODEL",
      { maxTokens: 1500, temperature: 0.3, onProgress, phase: "document" }
    );

    if (!result) return null;
    return { summary: result.text, model: result.model, promptSnapshot };
  } catch (err) {
    logger.warn("summarizeScannedPdf: falló el render/visión", {
      component: "openrouter",
      action: "summarize.scanned",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Helper unificado: detecta tipo y llama al servicio correspondiente
// ═══════════════════════════════════════════════════════════════════

export type SummarizeResult =
  | { ok: true; summary: string; model: string; pageCount?: number; promptSnapshot: PromptSnapshot }
  | { ok: false; reason: string };

/**
 * Genera un resumen/descripción automático según el tipo de archivo.
 * - Imágenes → describeImage (visión)
 * - PDFs → summarizeDocument (texto + IA)
 * - Texto/Office → extracción de texto + IA
 * - Otros → { ok: false, reason } con explicación
 *
 * Los prompts se leen de la tabla ai_prompts según businessLineId.
 *
 * @param buffer  Buffer del archivo
 * @param mimeType  MIME type
 * @param fileName  Nombre del archivo (para fallback de detección)
 * @param businessLineId  ID de la línea de negocio (para seleccionar el prompt de IA)
 * @param onProgress  Callback para reportar progreso en tiempo real
 */
export async function summarizeFile(
  buffer: Buffer,
  mimeType: string,
  fileName?: string,
  businessLineId?: string,
  onProgress?: AiProgressCallback
): Promise<SummarizeResult> {
  // Normalizar mimeType: si es octet-stream, intentar adivinar desde el nombre
  let effectiveMime = mimeType;
  if (effectiveMime === "application/octet-stream" && fileName) {
    const guessed = guessMimeFromName(fileName);
    if (guessed) effectiveMime = guessed;
  }

  if (effectiveMime.startsWith("image/")) {
    const result = await describeImage(buffer, effectiveMime, businessLineId, onProgress);
    if (!result) return { ok: false, reason: "Todos los modelos de visión fallaron (sin crédito, rate limit o error de OpenRouter)" };
    return { ok: true, summary: result.description, model: result.model, promptSnapshot: result.promptSnapshot };
  }

  if (effectiveMime === "application/pdf") {
    const result = await summarizeDocument(buffer, 5, businessLineId, onProgress);
    if (!result.ok) return { ok: false, reason: result.reason };
    return { ok: true, summary: result.summary, model: result.model, pageCount: result.pageCount, promptSnapshot: result.promptSnapshot };
  }

  // Texto plano y similares: enviar directamente a IA
  if (
    effectiveMime.startsWith("text/") ||
    effectiveMime === "application/json" ||
    effectiveMime === "application/xml" ||
    effectiveMime === "application/csv"
  ) {
    const text = buffer.toString("utf-8");
    if (!text.trim()) return { ok: false, reason: "El archivo de texto está vacío" };
    const result = await summarizeText(text, businessLineId, onProgress);
    if (!result) return { ok: false, reason: "Todos los modelos fallaron al resumir el texto" };
    return { ok: true, summary: result.summary, model: result.model, promptSnapshot: result.promptSnapshot };
  }

  // Word .docx
  if (
    effectiveMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    (fileName?.toLowerCase().endsWith(".docx") ?? false)
  ) {
    const text = await extractDocxText(buffer);
    if (!text || !text.trim()) return { ok: false, reason: "No se pudo extraer texto del .docx (posiblemente es solo imágenes)" };
    const result = await summarizeText(text, businessLineId, onProgress);
    if (!result) return { ok: false, reason: "Texto extraído del .docx pero todos los modelos fallaron" };
    return { ok: true, summary: result.summary, model: result.model, promptSnapshot: result.promptSnapshot };
  }

  // Tipos no soportados
  return {
    ok: false,
    reason: `Tipo no soportado: ${effectiveMime}${fileName ? ` (${fileName})` : ""}. Soportados: imágenes (jpg, png, webp, gif), PDF, texto, .docx`,
  };
}

/** Adivina el MIME type desde el nombre del archivo. */
function guessMimeFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.match(/\.(jpg|jpeg)$/)) return "image/jpeg";
  if (lower.match(/\.png$/)) return "image/png";
  if (lower.match(/\.webp$/)) return "image/webp";
  if (lower.match(/\.gif$/)) return "image/gif";
  if (lower.match(/\.pdf$/)) return "application/pdf";
  if (lower.match(/\.txt$/)) return "text/plain";
  if (lower.match(/\.csv$/)) return "text/csv";
  if (lower.match(/\.json$/)) return "application/json";
  if (lower.match(/\.xml$/)) return "application/xml";
  if (lower.match(/\.docx$/)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return null;
}

/**
 * Extrae texto de un .docx (formato Office Open XML = ZIP con XML dentro).
 */
async function extractDocxText(buffer: Buffer): Promise<string | null> {
  try {
    // Usar fflate (ligero, sin dependencias nativas) para descomprimir
    const { unzipSync } = await import("fflate");
    const uint8 = new Uint8Array(buffer);
    const files = unzipSync(uint8);
    // El contenido principal está en word/document.xml
    const docXml = files["word/document.xml"];
    if (!docXml) return null;
    const xml = new TextDecoder().decode(docXml);
    // Extraer texto de los nodos <w:t>...</w:t>
    const matches = xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    let text = "";
    for (const m of matches) text += m[1];
    return text.trim() || null;
  } catch (err) {
    logger.warn("extractDocxText: error", {
      component: "openrouter",
      action: "extract.docx",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return null;
  }
}

/**
 * Resume un texto plano usando la cadena de modelos de documentos.
 */
async function summarizeText(
  text: string,
  businessLineId?: string,
  onProgress?: AiProgressCallback
): Promise<{ summary: string; model: string; promptSnapshot: PromptSnapshot } | null> {
  const truncated = text.length > 8000 ? text.slice(0, 8000) + "\n[...texto truncado...]" : text;

  // Leer prompt de la BD (específico de la línea > genérico > fallback mínimo)
  const dbPrompt = (await getPromptFromDb(businessLineId, "document")) ?? FALLBACK_DOCUMENT_PROMPT;

  const promptSnapshot: PromptSnapshot = {
    system_prompt: dbPrompt.system_prompt,
    user_prompt: dbPrompt.user_prompt,
    refinement_prompt: dbPrompt.refinement_prompt,
    source: dbPrompt.source ?? "fallback",
  };

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: dbPrompt.system_prompt,
    },
    {
      role: "user",
      content: `${dbPrompt.user_prompt}\n\n${truncated}`,
    },
  ];

  const result = await callWithFallback(
    messages,
    "OPENROUTER_DOCUMENT_MODEL_FREE",
    "OPENROUTER_DOCUMENT_MODEL",
    { maxTokens: 1500, temperature: 0.3, onProgress, phase: "document" }
  );

  if (!result) return null;

  return { summary: result.text, model: result.model, promptSnapshot };
}
