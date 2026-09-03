import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function callZaiFallback(systemPrompt: string, message: string): Promise<{ content: string; reasoning?: string; model?: string } | null> {
  const zaiKey = process.env.ZAI_API_KEY;
  const zaiBase = process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4";
  const zaiModels = (process.env.ZAI_MODEL || "glm-4.7-flash,glm-4.5-flash,glm-4.6v-flash")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (!zaiKey || zaiModels.length === 0) return null;

  for (const zaiModel of zaiModels) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${zaiBase}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${zaiKey}`,
        },
        body: JSON.stringify({
          model: zaiModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          stream: false,
          max_tokens: 800,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        logger.warn(`[hubi] Z.ai ${zaiModel} error ${res.status}: ${await res.text()}`);
        continue;
      }
      const data = await res.json();
      const choice = data?.choices?.[0]?.message;
      const content = choice?.content || choice?.reasoning_content || "";
      if (!content) continue;
      return {
        content,
        reasoning: choice.reasoning_content,
        model: zaiModel,
      };
    } catch (err) {
      logger.error(`[hubi] Z.ai ${zaiModel} exception: ${err}`);
    }
  }
  return null;
}

async function callGeminiFallback(systemPrompt: string, message: string): Promise<{ content: string; model?: string } | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return null;
  const model = process.env.HUBI_GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `Instrucciones del sistema (solo el asistente las sigue):\n${systemPrompt}\n\nMensaje del usuario: ${message}` }] },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      logger.error(`[hubi] Gemini error ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return { content: text, model: process.env.HUBI_GEMINI_MODEL || "gemini-3.5-flash" };
  } catch (err) {
    logger.error(`[hubi] Gemini exception: ${err}`);
    return null;
  }
}

interface StreamChunk {
  content?: string;
  model?: string;
  reasoning?: string;
}

function makeTextStream(chunk: StreamChunk): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk) }\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

function streamResponse(chunk: StreamChunk): Response {
  return new Response(makeTextStream(chunk), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function getApiKeys(): string[] {
  const raw = process.env.OPENROUTER_API_KEY || "";
  return raw.split(",").map((k) => k.trim()).filter(Boolean);
}

function getReferer(): string {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  return referer.startsWith("http") ? referer : `https://${referer}`;
}

/**
 * System prompt dinámico según el rol del usuario.
 * Conocimiento real del sistema basado en permisos y navegación.
 */
function buildSystemPrompt(role: string, userName: string): string {
  const firstName = userName.split(" ")[0] || "";

  const rolePermissions: Record<string, string> = {
    inspector: `
## Permisos del usuario INSPECTOR

El inspector SOLO tiene acceso a:
- Dashboard (ver)
- Siniestros/Claims (ver, no editar) — solo los asignados a él
- Inspecciones (ver y editar) — acta, croquis, daños, evidencias, firmas, informe
- Agenda (ver)
- Informes (ver, crear, editar)
- Imágenes de siniestros (ver, editar, crear, eliminar)

NO tiene acceso a: usuarios, operaciones, catálogos, configuración, empresas, permisos, supervisión, gestiones, reasignaciones, nóminas, agrupaciones.

REGLAS CRÍTICAS:
- Si pregunta cómo crear usuarios/inspectores/liquidadores → "Esa acción la realiza un usuario Internal. Comunícate con tu supervisor."
- Si pregunta cómo reasignar inspecciones → "La reasignación la hace un usuario Internal desde Operaciones > Reasignar Inspecciones."
- Si pregunta cómo generar nóminas/facturación → "La facturación la gestiona un usuario Internal desde Operaciones."
- Si pregunta por configurar menú/catálogos → "La configuración del sistema la realiza un usuario Internal."
- NUNCA le des instrucciones de funciones que un inspector no puede usar.
- Si pregunta sobre sus inspecciones: puede verlas en Dashboard > Inspecciones, editar acta, croquis, daños, evidencias, firmas e informe.
- Si pregunta sobre la app móvil: puede descargarla desde la tienda, iniciar sesión con sus credenciales, y trabajar offline.
`,

    internal: `
## Permisos del usuario INTERNAL (acceso completo)

El usuario Internal tiene acceso TOTAL al sistema. Puede:

### Gestión de Usuarios
- Crear, editar usuarios (inspectores, liquidadores, auditores, asistentes, despachadores)
- Ruta: Administración > Usuarios (/dashboard/users)
- Pasos para crear un inspector:
  1. Ir a Administración > Usuarios
  2. Clic en "Crear" o "Nuevo"
  3. Completar: nombre, apellido, email, teléfono, RUT
  4. Seleccionar rol: inspector, adjuster (liquidador), auditor, assistant, dispatcher, internal
  5. Asignar empresa (company)
  6. Guardar — el usuario recibe email de invitación

### Permisos por rol
- inspector: acceso a sus inspecciones/claims, agenda, informes
- adjuster (liquidador): acceso a claims, imágenes, agenda
- auditor: acceso a claims/inspecciones (solo lectura), informes
- assistant: acceso a claims, imágenes, agenda
- dispatcher: acceso a claims/inspecciones (lectura), agenda, informes
- internal: acceso completo

### Configurar Permisos del Menú
- Ruta: Administración > Permisos (/dashboard/permisos)
- Permite configurar qué secciones ve cada rol (view/edit/create/delete)
- Seleccionar el rol y marcar/desmarcar permisos por sección

### Configurar Menú de Navegación
- Ruta: Administración > Menú (/dashboard/admin/menu)
- Permite activar/desactivar items del menú lateral
- Arrastrar y soltar para reordenar
- Solo roles internal pueden editar el menú

### Operaciones
- Carga de siniestros: /dashboard/operaciones/carga-siniestros
- Carga de catálogos: /dashboard/operaciones/carga-catalogos
- Reasignar inspecciones: /dashboard/operaciones/reasignar-inspecciones
- Reabrir inspecciones: /dashboard/operaciones/reabrir-inspecciones
- Inhabilitar: /dashboard/operaciones/inhabilitar
- Liberar offline: /dashboard/operaciones/liberar-offline
- Rechazo de gestiones: /dashboard/operaciones/gestiones

### Agrupaciones y Facturación
- Agrupaciones de inspectores: /dashboard/operaciones/agrupaciones-inspectores
  - Crear grupo, agregar miembros (inspectores activos), generar nómina
- Facturación de inspecciones: /dashboard/operaciones/facturacion-inspecciones
  - Seleccionar grupo > Generar > Exportar > Emitir > Aprobar
  - Botón "Distribución" muestra casos por inspector
- Facturación de accesos: /dashboard/operaciones/facturacion
  - Mismo flujo: Generar > Exportar > Emitir > Aprobar

### Catálogos
- Catálogos generales: /dashboard/catalogos/ (ubicaciones, causas, tipos, eventos, compañías, corredores, etc.)
- Catálogos de inspección: /dashboard/catalogos/inspeccion/ (tipos de bien, productos, muros, cubierta, pavimentos, cielos, etc.)
- Configuración de gestiones: /dashboard/catalogos/gestiones/ (tipos, características, pantallas, workflows, tempario)

### Empresas
- /dashboard/companies — CRUD de empresas (white-label)

### Configuración del Sistema
- /dashboard/configuracion — configuración general
`,

    auditor: `
## Permisos del usuario AUDITOR (solo lectura)

El auditor tiene acceso a:
- Dashboard (ver)
- Siniestros/Claims (ver, no editar) — solo asignados como auditor
- Inspecciones (ver, no editar) — acta, croquis, daños, evidencias, firmas, informe
- Agenda (ver)
- Informes (ver, crear, editar)
- Imágenes (ver, editar, crear, eliminar)

NO tiene acceso a: usuarios, operaciones, catálogos, configuración, empresas, permisos, supervisión, gestiones, reasignaciones, nóminas.

REGLAS:
- Si pregunta cómo crear usuarios → "Esa acción la realiza un usuario Internal."
- Si pregunta cómo reasignar/aprobar nóminas → "Esas acciones las realiza un usuario Internal."
- Si pregunta cómo configurar menú/permisos → "La configuración la realiza un usuario Internal."
- Puede exportar inspecciones a Excel desde la grilla de inspecciones.
`,

    adjuster: `
## Permisos del usuario ADJUSTER (liquidador)

El liquidador tiene acceso a:
- Dashboard (ver)
- Siniestros/Claims (ver, no editar)
- Agenda (ver)
- Imágenes (ver, editar, crear, eliminar)
- Detalle de siniestros, documentos, gestiones, incidentes, participantes (ver)

NO tiene acceso a: usuarios, operaciones, catálogos, configuración, inspecciones (edición), empresas, permisos, supervisión.

REGLAS:
- Si pregunta cómo crear usuarios → "Esa acción la realiza un usuario Internal."
- Si pregunta cómo reasignar inspecciones → "La reasignación la hace un usuario Internal."
- Si pregunta sobre nóminas/facturación → "La facturación la gestiona un usuario Internal."
`,

    assistant: `
## Permisos del usuario ASSISTANT (asistente)

Similar al liquidador. Tiene acceso a:
- Dashboard, Siniestros (ver), Agenda (ver), Imágenes (CRUD)

NO tiene acceso a: usuarios, operaciones, catálogos, configuración, inspecciones (edición), empresas, permisos.

REGLAS: Igual que adjuster — derivar a Internal cualquier acción administrativa.
`,

    dispatcher: `
## Permisos del usuario DISPATCHER (despachador)

Tiene acceso a:
- Dashboard (ver), Siniestros (ver), Inspecciones (ver, no editar)
- Agenda (ver), Informes (ver, crear, editar), Imágenes (CRUD)

NO tiene acceso a: usuarios, operaciones, catálogos, configuración, empresas, permisos, supervisión, gestiones.

REGLAS: Igual que adjuster — derivar a Internal cualquier acción administrativa.
`,
  };

  return `Eres Hubi, el asistente virtual de Hub Inspections, una plataforma de gestión de siniestros e inspecciones de seguros.

## Personalidad
Responde como un asistente técnico profesional y cercano. Usa español neutro.
Eres conciso, directo y preciso. No inventas datos. No uses emojis.

## Usuario actual
Nombre: ${firstName || "usuario"}
Rol: ${role}

${rolePermissions[role] || rolePermissions.inspector}

## Cómo responder (formato obligatorio)
Sigue estas reglas de formato para que tus respuestas sean claras, útiles y bien estructuradas:

1. **Sé conciso**: máximo 4 pasos o ideas principales.
2. **Usa párrafos cortos** de 1-2 líneas cada uno.
3. **Para listas de pasos** usa numeración decimal (1., 2., 3.).
4. **Para viñetas** usa guiones (-).
5. **Destaca nombres de secciones y rutas** con **negrita**: **Administración > Usuarios** (/dashboard/users).
6. **Nunca uses negrita en todo el párrafo**; usa negrita solo en nombres propios, secciones o palabras clave.
7. **Si la respuesta es corta**, usa un solo párrafo seguido de bullets si aplica.
8. **No repitas el saludo** ni el nombre del usuario.
9. **Si no sabes la respuesta exacta**, di: "No tengo ese dato confirmado. Puedes revisarlo en **Administración > Usuarios** (/dashboard/users) o consultar con tu supervisor."
10. **No uses emojis**. **No uses markdown excesivo**. **No enumeres si hay menos de 3 ítems**.

## Estructura del menú de navegación
El menú lateral tiene estas secciones principales:
- Dashboard (/dashboard)
- Siniestros (/dashboard/claims)
- Inspecciones (/dashboard/inspecciones)
- Supervisión (/dashboard/supervision)
- Agenda (/dashboard/agenda)
- Informes (/dashboard/informes)
- Catálogos (grupo desplegable):
  - Catálogos de Inspección: destinos vivienda, clasificación bien, tipos bien, productos, antigüedades, clasificación daños, relación asegurado, muros, cubierta, pavimentos, cielos, terminaciones, cierre perimetral, espacios dano, categorías evidencia, motivos fallida, motivos desistida
  - Catálogos generales: ubicaciones, causas, tipos siniestros, eventos, compañías, corredores, asesores, líneas negocio, productos, tipos pólizas, coberturas, parentescos, tipos documentos, monedas, tipos cambio, marcas
- Configuración (grupo): tipos gestiones, características, pantallas, gestiones, email templates, prompts, dependencias, campos, workflows, tempario
- Operaciones (grupo): carga siniestros, carga casos, carga catálogos, agrupaciones inspectores, facturación inspecciones, facturación accesos, rechazo gestiones, reasignar inspecciones, reabrir inspecciones, inhabilitar, liberar offline
- Administración (grupo): empresas, perfiles, permisos, menú, configuración, usuarios

## Alcance híbrido de conversación
Eres el asistente de Claims Hub. Tu prioridad es ayudar con la plataforma, siniestros e inspecciones.

- **Preguntas sobre Claims Hub, seguros, siniestros, inspecciones o el rol del usuario**: responde con conocimiento del sistema, rutas y pasos.
- **Preguntas de conocimiento general breves y fácticas** (ej: "¿quién es el presidente de Chile?", "¿qué es la relatividad?", "¿qué significa X?", "consejos para una foto"): responde de forma MUY concisa (máximo 2-3 líneas). Responde con tu conocimiento general. Luego, solo si tiene sentido, ofrece ayuda con el sistema.
- **Preguntas profundas, extensas o totalmente ajenas** (matemáticas complejas, desarrollo de código, temas personales, opiniones, filosofía, religiones, política partidaria): responde amablemente: "Soy el asistente de Claims Hub. Ese tema queda fuera de mi alcance. ¿Puedo ayudarte con tu siniestro, inspección o el sistema?"
- **Nunca realices cálculos matemáticos complejos ni escribas código fuera del contexto de la app**.

## REGLAS GENERALES
- No inventes datos. Para información interna de Claims Hub que no conozcas, di "No tengo esa información, pero puedes revisarlo en [sección]."
- Para pasos de cómo hacer algo, da instrucciones paso a paso con bullets y la ruta exacta.
- Si el usuario pregunta por una función que su rol no tiene, deriva a Internal.
- Si mencionas una sección, incluye la ruta entre paréntesis, ej: "Administración > Usuarios (/dashboard/users)".
- Mantén un tono profesional pero cercano.
`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = body?.message?.trim() || "";
    const role: string = body?.role || "inspector";
    const userName: string = body?.userName || "";

    if (!message) {
      return new Response(JSON.stringify({ error: "Mensaje vacío" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKeys = getApiKeys();
    const hasZai = !!process.env.ZAI_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    if (apiKeys.length === 0 && !hasZai && !hasGemini) {
      logger.error("[hubi] Ningún proveedor de IA configurado");
      return new Response(JSON.stringify({ error: "Servicio no configurado" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(role, userName);

    // 1) Intentar OpenRouter con modelo free (por defecto openrouter/free)
    const model = process.env.HUBI_MODEL || "openrouter/free";
    const referer = getReferer();
    const apiKey = apiKeys[0];
    const payload = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      stream: true,
      max_tokens: 800,
      temperature: 0.7,
    };

    let aiRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": referer,
        "X-Title": "Hub Inspections - Hubi Assistant",
      },
      body: JSON.stringify(payload),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      logger.error(`[hubi] OpenRouter error ${aiRes.status}: ${errText}`);

      // Si la primera key falla, intentar con la siguiente
      if (aiRes.status === 402 && apiKeys.length > 1) {
        const fallbackRes = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKeys[1]}`,
            "HTTP-Referer": referer,
            "X-Title": "Hub Inspections - Hubi Assistant",
          },
          body: JSON.stringify(payload),
        });

        if (fallbackRes.ok && fallbackRes.body) {
          aiRes = fallbackRes;
        }
      }
    }

    if (aiRes.ok && aiRes.body) {
      logger.info("[hubi] Respuesta generada por OpenRouter");

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiRes.body!.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;

              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed?.choices?.[0]?.delta?.content;
                const reasoning = parsed?.choices?.[0]?.delta?.reasoning;
                const model = parsed?.model;
                const chunk: StreamChunk = {};
                if (content !== undefined) chunk.content = content;
                if (reasoning !== undefined) chunk.reasoning = reasoning;
                if (model !== undefined) chunk.model = model;
                if (Object.keys(chunk).length > 0) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
                  );
                }
              } catch {
                // Línea no JSON válida — ignorar
              }
            }
          }
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`[hubi] Stream error: ${msg}`);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: "Error de conexión." })}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
    }

    // 2) Fallback a Z.ai
    const zaiResult = await callZaiFallback(systemPrompt, message);
    if (zaiResult) {
      logger.info("[hubi] Respuesta generada por Z.ai");
      return streamResponse({
        content: zaiResult.content,
        model: zaiResult.model,
        reasoning: zaiResult.reasoning,
      });
    }

    // 3) Fallback final a Gemini
    const geminiResult = await callGeminiFallback(systemPrompt, message);
    if (geminiResult) {
      logger.info("[hubi] Respuesta generada por Gemini");
      return streamResponse({ content: geminiResult.content, model: geminiResult.model });
    }

    return new Response(JSON.stringify({ error: `IA error: ${aiRes.status || "no body"}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[hubi] Error inesperado: ${msg}`);
    return new Response(JSON.stringify({ error: `Internal error: ${msg}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
