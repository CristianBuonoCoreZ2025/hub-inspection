import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadInspectionFile } from "@/lib/storage/inspection-upload";
import { logger } from "@/lib/logger";

/**
 * API route para descargar un mapa estático y guardarlo como evidencia
 * de la inspección.
 *
 * Recibe JSON:
 *   - sessionId: UUID de la inspection_session
 *   - lat: latitud capturada
 *   - lng: longitud capturada
 *   - mapUrl: URL del mapa estático (de generateStaticMapUrl)
 *   - capturedBy: (opcional) ID del usuario que capturó
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, lat, lng, mapUrl, capturedBy, label } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "Falta lat/lng" }, { status: 400 });
    }
    if (!mapUrl || typeof mapUrl !== "string") {
      return NextResponse.json({ error: "Falta mapUrl" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const geoLabel = label || "captured";

    try {
      // 1. Descargar la imagen del mapa estático
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const mapRes = await fetch(mapUrl, {
        headers: {
          Accept: "image/*",
          "User-Agent": "ClaimsHub/1.0",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!mapRes.ok) {
        throw new Error(`descarga fallida HTTP ${mapRes.status}`);
      }
      const arrayBuffer = await mapRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = mapRes.headers.get("content-type") || "image/png";
      const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? ".jpg" : ".png";

      // 2. Subir a R2 como evidencia (tipo EVI)
      const { url, fileCode } = await uploadInspectionFile(sessionId, buffer, mimeType, "EVI", ext);

      // 3. Insertar en inspection_evidences
      const { data: evidence, error } = await supabase
        .from("inspection_evidences")
        .insert({
          session_id: sessionId,
          type: "photo",
          url,
          description: fileCode,
          captured_by: capturedBy || null,
          captured_at: now,
          source: "geo_map",
          include_in_report: true,
          lat,
          lng,
          metadata: {
            source: "geo_map",
            isGeoMap: true,
            mapUrl,
            geoLabel,
            originalName: `${fileCode}.png`,
            fileSize: buffer.length,
            mimeType,
          },
        })
        .select("id, url, description, type, created_at, source")
        .single();

      if (error) {
        logger.error("Geo map: insert falló", new Error(error.message), {
          component: "geo-save-map",
          action: "insert.evidence",
        });
        return NextResponse.json({ error: "Error al registrar evidencia del mapa" }, { status: 500 });
      }

      logger.info("Mapa de geolocalización guardado como evidencia", {
        component: "geo-save-map",
        action: "save.map",
        metadata: { sessionId, fileCode, lat, lng },
      });

      return NextResponse.json({ evidence });
    } catch (downloadErr) {
      // Fallback: si no se puede descargar el mapa estático, generar una
      // imagen SVG simple con las coordenadas y un marcador, y subirla a R2.
      logger.warn("No se pudo descargar mapa estático; generando imagen SVG", {
        component: "geo-save-map",
        action: "save.map.fallback",
        metadata: { sessionId, mapUrl, error: downloadErr instanceof Error ? downloadErr.message : String(downloadErr) },
      });

      // Generar SVG con marcador y coordenadas
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <rect width="600" height="400" fill="#e5e7eb"/>
  <rect x="0" y="0" width="600" height="400" fill="url(#grid)"/>
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d1d5db" stroke-width="1"/>
    </pattern>
  </defs>
  <circle cx="300" cy="180" r="20" fill="#f74e4e" opacity="0.3"/>
  <circle cx="300" cy="180" r="10" fill="#f74e4e"/>
  <path d="M 300 190 L 300 210" stroke="#f74e4e" stroke-width="3"/>
  <text x="300" y="250" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="bold" fill="#1f2937">Ubicación Capturada</text>
  <text x="300" y="275" text-anchor="middle" font-family="monospace" font-size="14" fill="#4b5563">Lat: ${lat.toFixed(6)}</text>
  <text x="300" y="295" text-anchor="middle" font-family="monospace" font-size="14" fill="#4b5563">Lng: ${lng.toFixed(6)}</text>
  <text x="300" y="330" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#6b7280">Geolocalización de la inspección</text>
</svg>`;
      const svgBuffer = Buffer.from(svgContent, "utf-8");

      try {
        const { url, fileCode } = await uploadInspectionFile(sessionId, svgBuffer, "image/svg+xml", "EVI", ".svg");

        const { data: evidence, error } = await supabase
          .from("inspection_evidences")
          .insert({
            session_id: sessionId,
            type: "photo",
            url,
            description: fileCode,
            captured_by: capturedBy || null,
            captured_at: now,
            source: "geo_map",
            include_in_report: true,
            lat,
            lng,
            metadata: {
              source: "geo_map",
              isGeoMap: true,
              mapUrl,
              geoLabel,
              originalName: `${fileCode}.svg`,
              fileSize: svgBuffer.length,
              mimeType: "image/svg+xml",
              generatedLocally: true,
            },
          })
          .select("id, url, description, type, created_at, source")
          .single();

        if (error) {
          logger.error("Geo map SVG fallback: insert falló", new Error(error.message), {
            component: "geo-save-map",
            action: "insert.evidence.fallback",
          });
          return NextResponse.json({ error: "Error al registrar evidencia del mapa" }, { status: 500 });
        }

        return NextResponse.json({ evidence });
      } catch (svgErr) {
        // Último recurso: guardar la URL externa
        logger.error("Geo map SVG fallback falló", svgErr instanceof Error ? svgErr : new Error(String(svgErr)), {
          component: "geo-save-map",
          action: "save.map.fallback.svg",
        });

        const { data: evidence, error } = await supabase
          .from("inspection_evidences")
          .insert({
            session_id: sessionId,
            type: "photo",
            url: mapUrl,
            description: "MAPA-GEO-EXTERNO",
            captured_by: capturedBy || null,
            captured_at: now,
            source: "geo_map",
            include_in_report: true,
            lat,
            lng,
            metadata: {
              source: "geo_map",
              isGeoMap: true,
              mapUrl,
              geoLabel,
              originalName: "MAPA-GEO-EXTERNO.png",
              fileSize: 0,
              mimeType: "image/png",
              externalUrl: true,
            },
          })
          .select("id, url, description, type, created_at, source")
          .single();

        if (error) {
          logger.error("Geo map fallback final: insert falló", new Error(error.message), {
            component: "geo-save-map",
            action: "insert.evidence.fallback.final",
          });
          return NextResponse.json({ error: "Error al registrar evidencia del mapa" }, { status: 500 });
        }

        return NextResponse.json({ evidence });
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("API /api/inspection/geo/save-map error", error, {
      component: "geo-save-map",
      action: "save.map.error",
    });
    return NextResponse.json(
      { error: "No se pudo guardar el mapa", detail: error.message || String(err) },
      { status: 500 }
    );
  }
}
