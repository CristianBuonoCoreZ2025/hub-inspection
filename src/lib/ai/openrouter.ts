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
        "Eres un asistente experto en inspecciones de seguros. " +
        "Describe la imagen de forma breve y objetiva en máximo 2-3 líneas. " +
        "Menciona: tipo de espacio/objeto, estado visible, daños evidentes si los hay. " +
        "Responde en español. No inventes información que no se vea.",
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
          text: "Describe brevemente esta imagen (inspección de siniestro).",
        },
      ],
    },
  ];

  const result = await callWithFallback(
    messages,
    "OPENROUTER_VISION_MODEL_FREE",
    "OPENROUTER_VISION_MODEL",
    { maxTokens: 200, temperature: 0.2 }
  );

  if (!result) return null;

  // Truncar a 300 caracteres
  const description = result.text.length > 300 ? result.text.slice(0, 297) + "..." : result.text;

  return { description, model: result.model };
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
): Promise<{ summary: string; model: string; pageCount: number } | null> {
  // Extraer texto del PDF
  let pdfText = "";
  let pageCount = 0;

  try {
    const { PDFParse } = await import("pdf-parse");
    const uint8 = new Uint8Array(buffer);
    const parser = new PDFParse(uint8);
    const result = await parser.getText();

    pageCount = result.total || 0;
    const pages = result.pages || [];
    const analyzedPages = pages.slice(0, maxPages);
    pdfText = analyzedPages.map((p: { text: string }) => p.text).join("\n\n");
  } catch (err) {
    logger.warn("summarizeDocument: no se pudo extraer texto del PDF", {
      component: "openrouter",
      action: "summarize.document",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return null;
  }

  if (!pdfText.trim()) {
    return {
      summary: "Documento sin texto extraíble (posiblemente escaneado).",
      model: "none",
      pageCount,
    };
  }

  // Truncar texto a ~8000 chars para no exceder context window de modelos free
  const truncated = pdfText.length > 8000 ? pdfText.slice(0, 8000) + "\n[...texto truncado...]" : pdfText;

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content:
        "Eres un asistente experto en documentos de seguros. " +
        "Genera un resumen breve (máximo 3-4 líneas) del documento. " +
        "Menciona: tipo de documento, partes relevantes (póliza, cobertura, montos, fechas), " +
        "y cualquier dato clave para un siniestro. " +
        "Responde en español. No inventes información.",
    },
    {
      role: "user",
      content: `Resume el siguiente documento (primeras ${maxPages} páginas de ${pageCount}):\n\n${truncated}`,
    },
  ];

  const result = await callWithFallback(
    messages,
    "OPENROUTER_DOCUMENT_MODEL_FREE",
    "OPENROUTER_DOCUMENT_MODEL",
    { maxTokens: 300, temperature: 0.3 }
  );

  if (!result) return null;

  const summary = result.text.length > 500 ? result.text.slice(0, 497) + "..." : result.text;

  return { summary, model: result.model, pageCount };
}

// ═══════════════════════════════════════════════════════════════════
// Helper unificado: detecta tipo y llama al servicio correspondiente
// ═══════════════════════════════════════════════════════════════════

/**
 * Genera un resumen/descripción automático según el tipo de archivo.
 * - Imágenes → describeImage (visión)
 * - PDFs → summarizeDocument (texto + IA)
 * - Otros → null (no se procesa)
 *
 * @param buffer  Buffer del archivo
 * @param mimeType  MIME type
 * @returns { summary, model } o null
 */
export async function summarizeFile(
  buffer: Buffer,
  mimeType: string
): Promise<{ summary: string; model: string; pageCount?: number } | null> {
  if (mimeType.startsWith("image/")) {
    const result = await describeImage(buffer, mimeType);
    if (!result) return null;
    return { summary: result.description, model: result.model };
  }

  if (mimeType === "application/pdf") {
    const result = await summarizeDocument(buffer, 5);
    if (!result) return null;
    return { summary: result.summary, model: result.model, pageCount: result.pageCount };
  }

  // Otros tipos: no se procesan con IA
  return null;
}
