import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * GET /api/storage/proxy?url=<url-publica-r2>
 *
 * Descarga un archivo desde R2 server-side (sin CORS) y lo devuelve al browser.
 * Necesario porque R2 no tiene CORS configurado para fetch desde el browser.
 * Usado por el botón ZIP del reporte de inspección.
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "Falta parámetro url" }, { status: 400 });
    }

    // Solo permitir URLs de R2 (seguridad: evitar SSRF a otros hosts)
    const parsed = new URL(url);
    const allowedHosts = [
      "pub-c3b5a095e0d54343be81175021745490.r2.dev",
      "r2.dev",
    ];
    const isAllowed = allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith("." + h));
    if (!isAllowed) {
      return NextResponse.json({ error: "Host no permitido" }, { status: 403 });
    }

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: `R2 respondió ${res.status}` }, { status: res.status });
    }

    const blob = await res.blob();
    const contentType = res.headers.get("content-type") || blob.type || "application/octet-stream";

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error("[storage/proxy] Error: " + errMsg);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
