import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * API route para que el cliente (magic link) guarde su firma.
 * Recibe: { sessionId, role, signatureDataUrl (base64 PNG) }
 * 1. Sube la imagen a Supabase Storage
 * 2. Crea el registro en inspection_signatures
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId, role, signatureDataUrl } = await request.json();
    if (!sessionId || !signatureDataUrl || !role) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Convertir base64 a buffer y subir a Storage
    const base64Response = await fetch(signatureDataUrl);
    const blob = await base64Response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const filePath = `signatures/signature_${role}_${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("inspection-evidences")
      .upload(filePath, buffer, { contentType: "image/png" });

    if (uploadError) {
      logger.error("Sign API: upload falló", new Error(uploadError.message), {
        component: "inspection-sign-route",
        action: "storage.upload",
        metadata: { error: uploadError.message },
      });
      return NextResponse.json({ error: "Error al subir firma" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("inspection-evidences")
      .getPublicUrl(filePath);

    const signatureUrl = urlData.publicUrl;

    // 2. Crear registro en inspection_signatures
    const { data: signature, error: insertError } = await supabase
      .from("inspection_signatures")
      .insert({
        session_id: sessionId,
        role,
        signature_url: signatureUrl,
        signed_at: new Date().toISOString(),
      })
      .select("id, role, signature_url, signed_at")
      .single();

    if (insertError) {
      logger.error("Sign API: insert falló", new Error(insertError.message), {
        component: "inspection-sign-route",
        action: "insert.signature",
      });
      return NextResponse.json({ error: "Error al guardar firma" }, { status: 500 });
    }

    return NextResponse.json({ signature });
  } catch (err) {
    logger.error("API /api/inspection/sign error", err as Error, {
      component: "inspection-sign-route",
      action: "save.signature",
    });
    return NextResponse.json({ error: "No se pudo guardar la firma" }, { status: 500 });
  }
}
