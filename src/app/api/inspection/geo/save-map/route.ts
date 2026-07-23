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
 *
 * Flujo:
 *  1. Descarga la imagen del mapUrl
 *  2. Sube a R2 con path: claims/{L}/actions/{code}/images/{code}-MAP-0001.png
 *  3. Inserta en inspection_evidences con metadata.source = "geo_map"
 *
 * Devuelve: { evidence: { id, url, description } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, lat, lng, mapUrl, capturedBy } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "Falta lat/lng" }, { status: 400 });
    }
    if (!mapUrl || typeof mapUrl !== "string") {
      return NextResponse.json({ error: "Falta mapUrl" }, { status: 400 });
    }

    // 1. Descargar la imagen del mapa estático
    const mapRes = await fetch(mapUrl);
    if (!mapRes.ok) {
      return NextResponse.json(
        { error: `No se pudo descargar el mapa: ${mapRes.status}` },
        { status: 502 }
      );
    }
    const arrayBuffer = await mapRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = mapRes.headers.get("content-type") || "image/png";
    const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? ".jpg" : ".png";

    // 2. Subir a R2 como evidencia (tipo EVI)
    const { url, fileCode } = await uploadInspectionFile(
      sessionId,
      buffer,
      mimeType,
      "EVI",
      ext
    );

    // 3. Insertar en inspection_evidences
    const supabase = createAdminClient();
    const { data: evidence, error } = await supabase
      .from("inspection_evidences")
      .insert({
        session_id: sessionId,
        type: "photo",
        url,
        description: fileCode,
        captured_by: capturedBy || null,
        captured_at: new Date().toISOString(),
        lat,
        lng,
        metadata: {
          source: "geo_map",
          isGeoMap: true,
          mapUrl,
          originalName: `${fileCode}.png`,
          fileSize: buffer.length,
          mimeType,
        },
      })
      .select("id, url, description, type, created_at")
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
  } catch (err) {
    const error = err as Error;
    logger.error("API /api/inspection/geo/save-map error", error, {
      component: "geo-save-map",
      action: "save.map.error",
    });
    return NextResponse.json(
      { error: "No se pudo guardar el mapa", detail: error.message },
      { status: 500 }
    );
  }
}
