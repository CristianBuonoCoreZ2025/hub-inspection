import { NextRequest, NextResponse } from "next/server";

/**
 * API route para recibir logs del frontend.
 * En desarrollo solo los imprime en consola.
 * En producción podría enviarlos a un servicio externo (Sentry, LogRocket, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const entry = await request.json();

    // En desarrollo, solo log en consola del servidor
    if (process.env.NODE_ENV !== "production") {
      console.log("[Client Log]", entry);
      return NextResponse.json({ ok: true });
    }

    // En producción, aquí podrías:
    // - Enviar a Sentry
    // - Guardar en base de datos
    // - Enviar a Slack/Discord webhook
    // - etc.

    console.error("[Production Client Error]", {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      stack: entry.stack,
      context: entry.context,
      source: entry.source,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
