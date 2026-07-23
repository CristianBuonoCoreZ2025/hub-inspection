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
      // Fallback: si no se puede descargar/subir, guardar la URL externa como evidencia
      logger.warn("No se pudo descargar/subir mapa; guardando URL externa", {
        component: "geo-save-map",
        action: "save.map.fallback",
        metadata: { sessionId, mapUrl, error: downloadErr instanceof Error ? downloadErr.message : String(downloadErr) },
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
        logger.error("Geo map fallback: insert falló", new Error(error.message), {
          component: "geo-save-map",
          action: "insert.evidence.fallback",
        });
        return NextResponse.json({ error: "Error al registrar evidencia del mapa" }, { status: 500 });
      }

      return NextResponse.json({ evidence });
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
