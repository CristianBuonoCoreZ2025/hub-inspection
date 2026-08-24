import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { describeImage } from "@/lib/ai/openrouter";

/**
 * GET /api/ai/health
 *
 * Diagnóstico del servicio de IA (OpenRouter) para detectar por qué la IA
 * no funciona en un entorno dado (UAT, producción, etc.).
 *
 * No expone secretos: reporta solo booleanos (¿está seteada la var?) y un
 * ping mínimo a OpenRouter para confirmar autenticación + conectividad.
 *
 * Útil para diferenciar:
 *  - Variables de entorno faltantes en Vercel (causa más común).
 *  - Bloqueo de red / firewall hacia openrouter.ai.
 *  - API key inválida o sin crédito.
 *
 * POST /api/ai/health  (multipart/form-data con campo "file" = imagen)
 *
 * Ejecuta el flujo COMPLETO de visión (describeImage) con una imagen real
 * subida desde el navegador, reportando tiempo por etapa y el resultado.
 * No toca la BD ni R2 — es solo diagnóstico. Permite reproducir exactamente
 * lo que hace el Brain pero sin depender de un registro existente.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Enmascarar una key: mostrar solo si está presente + primeros/últimos chars.
function maskKey(raw: string): { present: boolean; preview: string } {
  if (!raw) return { present: false, preview: "" };
  const keys = raw.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) return { present: false, preview: "" };
  const masked = keys.map((k) => {
    if (k.length <= 12) return `${k.slice(0, 4)}…${k.slice(-4)}`;
    return `${k.slice(0, 6)}…${k.slice(-4)}`;
  });
  return { present: true, preview: `${keys.length} key(s): ${masked.join(", ")}` };
}

// Lista de variables (split por coma) → reporta cuántas hay.
function countList(envVar: string): { present: boolean; count: number; values: string[] } {
  const raw = process.env[envVar] || "";
  const values = raw.split(",").map((v) => v.trim()).filter(Boolean);
  return { present: values.length > 0, count: values.length, values };
}

export async function GET() {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const refererValue = referer.startsWith("http") ? referer : `https://${referer}`;

  const apiKeys = maskKey(process.env.OPENROUTER_API_KEY || "");
  const visionFree = countList("OPENROUTER_VISION_MODEL_FREE");
  const visionPaid = countList("OPENROUTER_VISION_MODEL");
  const docFree = countList("OPENROUTER_DOCUMENT_MODEL_FREE");
  const docPaid = countList("OPENROUTER_DOCUMENT_MODEL");

  const envStatus = {
    OPENROUTER_API_KEY: apiKeys,
    OPENROUTER_VISION_MODEL_FREE: visionFree,
    OPENROUTER_VISION_MODEL: visionPaid,
    OPENROUTER_DOCUMENT_MODEL_FREE: docFree,
    OPENROUTER_DOCUMENT_MODEL: docPaid,
    OPENROUTER_HTTP_REFERER: {
      present: Boolean(process.env.OPENROUTER_HTTP_REFERER),
      value: process.env.OPENROUTER_HTTP_REFERER || null,
    },
    resolvedReferer: refererValue,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || null,
    // Supabase (necesario para que analyze-document guarde el resultado)
    NEXT_PUBLIC_SUPABASE_URL: { present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    SUPABASE_SERVICE_ROLE_KEY: { present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
  };

  // Si no hay API key, no tiene sentido hacer ping — reportar y salir.
  if (!apiKeys.present) {
    logger.warn("ai/health: OPENROUTER_API_KEY no está configurada", {
      component: "ai-health",
      action: "check.env",
      metadata: { vercelEnv: process.env.VERCEL_ENV },
    });
    return NextResponse.json({
      ok: false,
      reason: "OPENROUTER_API_KEY no está configurada en este entorno. Configúrala en Vercel → Project Settings → Environment Variables (para los entornos Preview/UAT y Production).",
      env: envStatus,
    }, { status: 200 });
  }

  // Ping mínimo a OpenRouter: modelo free, 1 token, prompt trivial.
  // Confirma autenticación + conectividad + que la key tiene crédito/acceso.
  const firstKey = (process.env.OPENROUTER_API_KEY || "").split(",")[0].trim();
  const ping: {
    attempted: boolean;
    status: number | null;
    ok: boolean;
    error: string | null;
    model: string;
    latencyMs: number | null;
  } = { attempted: true, status: null, ok: false, error: null, model: "openrouter/free", latencyMs: null };

  const start = Date.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${firstKey}`,
        "HTTP-Referer": refererValue,
        "X-Title": "Hub Inspections (health check)",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15000),
    });
    ping.status = res.status;
    ping.latencyMs = Date.now() - start;
    if (res.ok) {
      ping.ok = true;
    } else {
      const body = await res.text().catch(() => "");
      ping.error = `HTTP ${res.status}: ${body.slice(0, 300)}`;
    }
  } catch (err) {
    ping.latencyMs = Date.now() - start;
    ping.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  logger.info("ai/health: ping a OpenRouter", {
    component: "ai-health",
    action: "check.ping",
    metadata: { ok: ping.ok, status: ping.status, latencyMs: ping.latencyMs, vercelEnv: process.env.VERCEL_ENV },
  });

  // Diagnóstico automático
  const missingModels: string[] = [];
  if (!visionFree.present && !visionPaid.present) missingModels.push("OPENROUTER_VISION_MODEL_FREE / OPENROUTER_VISION_MODEL");
  if (!docFree.present && !docPaid.present) missingModels.push("OPENROUTER_DOCUMENT_MODEL_FREE / OPENROUTER_DOCUMENT_MODEL");

  let diagnosis = "OK";
  if (!ping.ok) {
    diagnosis = `Ping a OpenRouter falló (${ping.error || `HTTP ${ping.status}`}). Posibles causas: API key inválida, sin crédito, rate limit, o bloqueo de red hacia openrouter.ai.`;
  } else if (missingModels.length > 0) {
    diagnosis = `Ping OK pero faltan variables de modelos: ${missingModels.join(", ")}. La IA funcionará solo con el fallback 'openrouter/free'.`;
  }

  return NextResponse.json({
    ok: ping.ok && missingModels.length === 0,
    diagnosis,
    ping,
    env: envStatus,
  }, { status: 200 });
}

/**
 * POST /api/ai/health
 *
 * Recibe multipart/form-data con un campo "file" (imagen).
 * Ejecuta describeImage (el mismo flujo del Brain) y reporta:
 *  - Tiempo total y por etapa
 *  - Modelo que respondió
 *  - Descripción generada (o error exacto)
 *
 * No toca BD ni R2. Es solo diagnóstico para reproducir el flujo de visión
 * real en el entorno (UAT/prod) sin depender de un registro existente.
 */
export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const steps: Array<{ step: string; ok: boolean; ms: number; detail?: string }> = [];

  // ── Paso 1: leer el archivo del multipart ──
  let buffer: Buffer;
  let mimeType: string;
  let fileName: string;
  let fileSize: number;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "No se encontró el campo 'file' en el multipart. Envía una imagen." },
        { status: 400 }
      );
    }
    mimeType = file.type || "application/octet-stream";
    fileName = file.name;
    fileSize = file.size;
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    steps.push({ step: "read-multipart", ok: true, ms: Date.now() - t0, detail: `${fileName} (${fileSize} bytes, ${mimeType})` });
  } catch (err) {
    steps.push({ step: "read-multipart", ok: false, ms: Date.now() - t0, detail: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "No se pudo leer el archivo", steps }, { status: 400 });
  }

  // ── Paso 2: validar que sea una imagen ──
  if (!mimeType.startsWith("image/")) {
    // Intentar adivinar desde el nombre
    const lower = fileName.toLowerCase();
    if (lower.match(/\.(jpg|jpeg)$/)) mimeType = "image/jpeg";
    else if (lower.match(/\.png$/)) mimeType = "image/png";
    else if (lower.match(/\.webp$/)) mimeType = "image/webp";
    else if (lower.match(/\.gif$/)) mimeType = "image/gif";
    else {
      steps.push({ step: "validate-image", ok: false, ms: 0, detail: `No es imagen: ${mimeType}` });
      return NextResponse.json({ ok: false, error: `El archivo no es una imagen (MIME: ${mimeType})`, steps }, { status: 400 });
    }
  }
  steps.push({ step: "validate-image", ok: true, ms: 0, detail: mimeType });

  // ── Paso 3: ejecutar describeImage (flujo real de visión) ──
  const tAi = Date.now();
  let aiResult: { description: string; model: string } | null = null;
  let aiError: string | null = null;
  try {
    aiResult = await describeImage(buffer, mimeType);
    steps.push({
      step: "describeImage",
      ok: aiResult !== null,
      ms: Date.now() - tAi,
      detail: aiResult ? `modelo: ${aiResult.model}, ${aiResult.description.length} chars` : "retornó null (todos los modelos fallaron)",
    });
  } catch (err) {
    aiError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    steps.push({ step: "describeImage", ok: false, ms: Date.now() - tAi, detail: aiError });
  }

  const totalMs = Date.now() - t0;
  const ok = aiResult !== null;

  logger.info("ai/health POST: prueba de visión", {
    component: "ai-health",
    action: "vision.test",
    metadata: { ok, totalMs, fileName, fileSize, model: aiResult?.model, vercelEnv: process.env.VERCEL_ENV },
  });

  return NextResponse.json({
    ok,
    totalMs,
    fileName,
    fileSize,
    mimeType,
    steps,
    description: aiResult?.description || null,
    model: aiResult?.model || null,
    error: aiError || (aiResult ? null : "describeImage retornó null — todos los modelos de visión fallaron. Revisa los logs del servidor (vercel logs) para ver qué modelo/paso falló exactamente."),
  }, { status: 200 });
}
