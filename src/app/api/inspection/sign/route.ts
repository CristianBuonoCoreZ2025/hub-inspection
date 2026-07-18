import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadInspectionFile } from "@/lib/storage/inspection-upload";
import { deleteFromR2 } from "@/lib/storage/r2-upload";
import { logger } from "@/lib/logger";

/**
 * API route para que el cliente (magic link) guarde su firma.
 * Recibe: { sessionId, role, signatureDataUrl (base64 PNG) }
 *
 * 1. Si ya existe una firma para (session_id, role), la borra de R2 y de la BD
 * 2. Sube la nueva imagen a R2: claims/{L}/actions/{code}/images/{code}-FIR-NNNN.png
 * 3. Crea el registro en inspection_signatures
 *
 * Así nunca quedan firmas huérfanas en R2.
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId, role, signatureDataUrl } = await request.json();
    if (!sessionId || !signatureDataUrl || !role) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 0. Si ya existe una firma para (session_id, role), borrarla de R2 y BD
    const { data: existing } = await supabase
      .from("inspection_signatures")
      .select("id, signature_url")
      .eq("session_id", sessionId)
      .eq("role", role)
      .maybeSingle();

    if (existing) {
      // Borrar el archivo antiguo de R2
      try {
        const publicUrl = process.env.R2_PUBLIC_URL || "";
        const key = existing.signature_url.replace(`${publicUrl}/`, "");
        if (key && key !== existing.signature_url) {
          await deleteFromR2(key);
        }
      } catch (delErr) {
        logger.warn("No se pudo borrar firma antigua de R2", {
          component: "inspection-sign-route",
          action: "delete.old_signature",
          metadata: { error: delErr instanceof Error ? delErr.message : String(delErr) },
        });
      }
      // Borrar el registro antiguo de la BD
      await supabase
        .from("inspection_signatures")
        .delete()
        .eq("id", existing.id);
    }

    // 1. Convertir base64 a buffer y subir a R2 con path estructurado (FIR = firma)
    const base64Response = await fetch(signatureDataUrl);
    const blob = await base64Response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    const { url: signatureUrl } = await uploadInspectionFile(
      sessionId,
      buffer,
      "image/png",
      "FIR",
      ".png"
    );

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
