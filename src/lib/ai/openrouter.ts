import "server-only";
import { logger } from "@/lib/logger";

// ═══════════════════════════════════════════════════════════════════
// OpenRouter AI Service
//
// Estrategia: FREE primero → PAID barato después.
// Las API keys se rotan (comma-separated en env).
// ═══════════════════════════════════════════════════════════════════

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
 * Llama a OpenRouter con un modelo específico.
 * Retorna el texto de respuesta o null si falla.
 */
async function callOpenRouter(
  model: string,
  messages: OpenRouterMessage[],
  apiKey: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string | null> {
  const referer = process.env.OPENROUTER_HTTP_REFERER || "http://localhost:3000";

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
    return text || null;
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
  options?: { maxTokens?: number; temperature?: number }
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
  const chain = [...freeModels, ...paidModels];

  if (chain.length === 0) {
    logger.warn("OpenRouter: no hay modelos configurados", {
      component: "openrouter",
      action: "call.fallback",
      metadata: { freeModelsEnv, paidModelsEnv },
    });
    return null;
  }

  for (const model of chain) {
    // Rotar keys: usar la primera key para el primer modelo, etc.
    const keyIndex = chain.indexOf(model) % keys.length;
    const apiKey = keys[keyIndex];

    const text = await callOpenRouter(model, messages, apiKey, options);
    if (text) {
      logger.info("OpenRouter: respuesta exitosa", {
        component: "openrouter",
        action: "call.fallback",
        metadata: { model, textLength: text.length },
      });
      return { text, model };
    }
  }

  logger.warn("OpenRouter: todos los modelos fallaron", {
    component: "openrouter",
    action: "call.fallback",
    metadata: { chain },
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
 * @param buffer  Buffer de la imagen
 * @param mimeType  MIME type (image/jpeg, image/png, image/webp, etc.)
 * @returns Descripción breve (máx ~200 chars) o null si falla
 */
export async function describeImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ description: string; model: string } | null> {
  // Convertir a base64 data URL
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content:
        "Eres un inspector de seguros experto analizando fotos de siniestros. " +
        "Describe la imagen de forma objetiva y detallada, útil para el liquidador. " +
        "Estructura tu respuesta en los siguientes puntos (omite los que no apliquen):\n" +
        "1. Qué se ve (tipo de espacio/objeto/vehículo, ubicación aparente).\n" +
        "2. Estado visible y daños evidentes (abolladuras, grietas, humedad, rotos, etc.). " +
        "Si no hay daños visibles, dilo explícitamente.\n" +
        "3. Detalle relevante: matrícula visible, marca/modelo si se reconoce, " +
        "ubicación GPS inferible, hora/fecha si aparece en metadata visual.\n" +
        "4. Observaciones adicionales que aporten al análisis del siniestro.\n\n" +
        "Reglas:\n" +
        "- NO inventes información que no se vea en la imagen.\n" +
        "- Si la imagen está borrosa o es de mala calidad, dilo.\n" +
        "- Sé lo más detallado y completo posible.\n" +
        "- Responde en español de Chile.",
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
          text: "Analiza esta foto de inspección de siniestro y extrae toda la información útil para el liquidador.",
        },
      ],
    },
  ];

  const result = await callWithFallback(
    messages,
    "OPENROUTER_VISION_MODEL_FREE",
    "OPENROUTER_VISION_MODEL",
    { maxTokens: 1000, temperature: 0.2 }
  );

  if (!result) return null;

  return { description: result.text, model: result.model };
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
  maxPages = 5
): Promise<{ ok: true; summary: string; model: string; pageCount: number } | { ok: false; reason: string }> {
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
    const scanned = await summarizeScannedPdf(buffer, pageCount);
    if (scanned) return { ok: true, summary: scanned.summary, model: scanned.model, pageCount };
    return {
      ok: false,
      reason: `PDF escaneado sin texto extraíble (${pageCount} páginas). Los modelos de visión tampoco pudieron procesarlo.`,
    };
  }

  // Truncar texto a ~8000 chars para no exceder context window de modelos free
  const truncated = pdfText.length > 8000 ? pdfText.slice(0, 8000) + "\n[...texto truncado...]" : pdfText;

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content:
        "Eres un liquidador de seguros experto analizando documentos de siniestros. " +
        "Lee cuidadosamente el documento y extrae INFORMACIÓN QUE APORTE al liquidador, " +
        "no un resumen genérico. Estructura tu respuesta en los siguientes puntos (omite los que no apliquen):\n" +
        "1. Tipo de documento + entidad emisora + fecha (si se ve).\n" +
        "2. Datos clave: número de póliza/liquidación, monto asegurado, cobertura, deducible (si aplica).\n" +
        "3. Hechos relevantes: qué ocurrió, partes involucradas, vehículos/bienes afectados.\n" +
        "4. Acción sugerida o dato crítico para el siniestro.\n" +
        "5. Cualquier otra información relevante que aparezca en el documento.\n\n" +
        "Reglas:\n" +
        "- Si NO encuentras un dato, NO lo inventes. Omítelo.\n" +
        "- Usa números exactos cuando estén en el documento.\n" +
        "- Sé lo más detallado y completo posible.\n" +
        "- Responde en español de Chile.",
    },
    {
      role: "user",
      content: `Analiza el siguiente documento (primeras ${maxPages} páginas de ${pageCount}) y extrae toda la información útil para un liquidador de seguros:\n\n${truncated}`,
    },
  ];

  const result = await callWithFallback(
    messages,
    "OPENROUTER_DOCUMENT_MODEL_FREE",
    "OPENROUTER_DOCUMENT_MODEL",
    { maxTokens: 1500, temperature: 0.3 }
  );

  if (!result) {
    return { ok: false, reason: "Texto extraído del PDF pero todos los modelos de IA fallaron (sin crédito, rate limit o error de OpenRouter)" };
  }

  return { ok: true, summary: result.text, model: result.model, pageCount };
}

/**
 * Para PDFs escaneados (sin texto extraíble): renderiza la primera página a imagen
 * con unpdf (renderPageAsImage) y la envía a un modelo de visión.
 */
async function summarizeScannedPdf(
  buffer: Buffer,
  pageCount: number
): Promise<{ summary: string; model: string } | null> {
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

    const messages: OpenRouterMessage[] = [
      {
        role: "system",
        content:
          "Eres un liquidador de seguros experto analizando un documento escaneado. " +
          "Extrae INFORMACIÓN QUE APORTE al liquidador, no un resumen genérico. " +
          "Estructura tu respuesta en máximo 4 líneas:\n" +
          "1. Tipo de documento + entidad emisora + fecha (si se lee).\n" +
          "2. Datos clave: número de póliza/liquidación, monto, cobertura, deducible (si se lee).\n" +
          "3. Hechos relevantes: qué ocurrió, partes involucradas, bienes afectados.\n" +
          "4. Acción sugerida o dato crítico.\n\n" +
          "Reglas:\n" +
          "- Si NO se lee un dato, NO lo inventes. Omítelo.\n" +
          "- Si la imagen es ilegible, dilo claramente.\n" +
          "- Responde en español de Chile.\n" +
          "- Máximo 4 líneas, separadas por ' | '.",
      },
      {
        role: "user",
        content: [
          ...imageContent,
          { type: "text", text: `Analiza estas ${dataUrls.length} página(s) de un PDF escaneado y extrae toda la información útil para un liquidador de seguros.` },
        ],
      },
    ];

    const result = await callWithFallback(
      messages,
      "OPENROUTER_VISION_MODEL_FREE",
      "OPENROUTER_VISION_MODEL",
      { maxTokens: 1500, temperature: 0.3 }
    );

    if (!result) return null;
    return { summary: result.text, model: result.model };
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
  | { ok: true; summary: string; model: string; pageCount?: number }
  | { ok: false; reason: string };

/**
 * Genera un resumen/descripción automático según el tipo de archivo.
 * - Imágenes → describeImage (visión)
 * - PDFs → summarizeDocument (texto + IA)
 * - Texto/Office → extracción de texto + IA
 * - Otros → { ok: false, reason } con explicación
 *
 * @param buffer  Buffer del archivo
 * @param mimeType  MIME type
 * @param fileName  Nombre del archivo (para fallback de detección)
 */
export async function summarizeFile(
  buffer: Buffer,
  mimeType: string,
  fileName?: string
): Promise<SummarizeResult> {
  // Normalizar mimeType: si es octet-stream, intentar adivinar desde el nombre
  let effectiveMime = mimeType;
  if (effectiveMime === "application/octet-stream" && fileName) {
    const guessed = guessMimeFromName(fileName);
    if (guessed) effectiveMime = guessed;
  }

  if (effectiveMime.startsWith("image/")) {
    const result = await describeImage(buffer, effectiveMime);
    if (!result) return { ok: false, reason: "Todos los modelos de visión fallaron (sin crédito, rate limit o error de OpenRouter)" };
    return { ok: true, summary: result.description, model: result.model };
  }

  if (effectiveMime === "application/pdf") {
    const result = await summarizeDocument(buffer, 5);
    if (!result.ok) return { ok: false, reason: result.reason };
    return { ok: true, summary: result.summary, model: result.model, pageCount: result.pageCount };
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
    const result = await summarizeText(text, fileName || "archivo de texto");
    if (!result) return { ok: false, reason: "Todos los modelos fallaron al resumir el texto" };
    return { ok: true, summary: result.summary, model: result.model };
  }

  // Word .docx
  if (
    effectiveMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    (fileName?.toLowerCase().endsWith(".docx") ?? false)
  ) {
    const text = await extractDocxText(buffer);
    if (!text || !text.trim()) return { ok: false, reason: "No se pudo extraer texto del .docx (posiblemente es solo imágenes)" };
    const result = await summarizeText(text, fileName || "documento Word");
    if (!result) return { ok: false, reason: "Texto extraído del .docx pero todos los modelos fallaron" };
    return { ok: true, summary: result.summary, model: result.model };
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
  label: string
): Promise<{ summary: string; model: string } | null> {
  const truncated = text.length > 8000 ? text.slice(0, 8000) + "\n[...texto truncado...]" : text;

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content:
        "Eres un liquidador de seguros experto analizando documentos de siniestros. " +
        "Lee cuidadosamente el documento y extrae INFORMACIÓN QUE APORTE al liquidador, " +
        "no un resumen genérico. Estructura tu respuesta en los siguientes puntos (omite los que no apliquen):\n" +
        "1. Tipo de documento + entidad emisora + fecha (si se ve).\n" +
        "2. Datos clave: número de póliza/liquidación, monto, cobertura, deducible (si aplica).\n" +
        "3. Hechos relevantes: qué ocurrió, partes involucradas, bienes afectados.\n" +
        "4. Acción sugerida o dato crítico.\n" +
        "5. Cualquier otra información relevante que aparezca en el documento.\n\n" +
        "Reglas:\n" +
        "- Si NO encuentras un dato, NO lo inventes. Omítelo.\n" +
        "- Usa números exactos cuando estén en el documento.\n" +
        "- Sé lo más detallado y completo posible.\n" +
        "- Responde en español de Chile.",
    },
    {
      role: "user",
      content: `Analiza el siguiente documento (${label}) y extrae toda la información útil para un liquidador de seguros:\n\n${truncated}`,
    },
  ];

  const result = await callWithFallback(
    messages,
    "OPENROUTER_DOCUMENT_MODEL_FREE",
    "OPENROUTER_DOCUMENT_MODEL",
    { maxTokens: 1500, temperature: 0.3 }
  );

  if (!result) return null;

  return { summary: result.text, model: result.model };
}
