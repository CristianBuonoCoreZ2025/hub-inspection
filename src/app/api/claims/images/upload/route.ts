import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { uploadClaimImage } from "@/lib/storage/claim-upload";
import { summarizeFile } from "@/lib/ai/openrouter";
import { logger } from "@/lib/logger";

/**
 * API route para subir una imagen del siniestro a Cloudflare R2.
 *
 * Recibe multipart/form-data:
 *   - file: la imagen (jpg, png, webp, etc.)
 *   - claimId: UUID del siniestro
 *
 * Flujo:
 *  1. Resuelve claimId → claim.liquidation_number
 *  2. Obtiene el siguiente correlativo IMG-NNNNNN atómico desde la BD
 *  3. Optimiza la imagen (redimensiona a max 1920px + comprime quality 80)
 *  4. Sube a R2 con path: claims/{L}/images/{L}-IMG-NNNNNN.ext
 *  5. Genera resumen con IA (visión — describe la imagen)
 *  6. Inserta el registro en claim_images
 *
 * Devuelve: { image: { id, url, img_code, ai_summary, ... } }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const claimId = formData.get("claimId");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (!claimId || typeof claimId !== "string") {
      return NextResponse.json({ error: "Falta claimId" }, { status: 400 });
    }

    // Validar que sea una imagen
    const mimeType = file.type || "application/octet-stream";
    if (!mimeType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Solo se permiten imágenes (jpg, png, webp, etc.)" },
        { status: 400 }
      );
    }

    // Obtener usuario actual
    let userId: string | null = null;
    try {
      const serverClient = await createServerClient();
      const { data: { user } } = await serverClient.auth.getUser();
      userId = user?.id || null;
    } catch {
      // sin sesión — continúa sin userId
    }

    const ext = file.name.includes(".")
      ? "." + file.name.split(".").pop()?.toLowerCase()
      : ".jpg";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a R2 con path estructurado + optimización
    const { url, key, imgCode } = await uploadClaimImage(claimId, buffer, mimeType, ext);

    // ── IA: descripción automática de la imagen (free → paid) ──
    let aiSummary: string | null = null;
    let aiModel: string | null = null;
    try {
      const ai = await summarizeFile(buffer, mimeType, file.name);
      if (ai.ok) {
        aiSummary = ai.summary;
        aiModel = ai.model;
        logger.info("IA: descripción de imagen generada", {
          component: "claim-image-upload",
          action: "ai.summary",
          metadata: { model: ai.model, summaryLength: ai.summary.length },
        });
      } else {
        logger.warn("IA: no se pudo generar descripción de imagen", {
          component: "claim-image-upload",
          action: "ai.summary.skipped",
          metadata: { reason: ai.reason },
        });
      }
    } catch (aiErr) {
      logger.warn("IA: error generando descripción de imagen", {
        component: "claim-image-upload",
        action: "ai.summary.error",
        metadata: { error: aiErr instanceof Error ? aiErr.message : String(aiErr) },
      });
    }

    // Insertar en claim_images
    const supabase = createAdminClient();
    const { data: image, error } = await supabase
      .from("claim_images")
      .insert({
        claim_id: claimId,
        img_code: imgCode,
        file_path: key,
        url,
        original_filename: file.name,
        mime_type: mimeType,
        file_size: file.size,
        uploaded_by: userId,
        ai_summary: aiSummary,
        ai_model: aiModel,
        is_active: true,
      })
      .select("id, claim_id, img_code, url, original_filename, mime_type, file_size, uploaded_by, ai_summary, ai_model, is_active, created_at, updated_at")
      .single();

    if (error) {
      logger.error("Claim image upload: insert falló", new Error(error.message), {
        component: "claim-image-upload",
        action: "insert.claim_image",
      });
      return NextResponse.json({ error: "Error al registrar imagen" }, { status: 500 });
    }

    logger.info("Imagen de siniestro registrada", {
      component: "claim-image-upload",
      action: "upload.success",
      metadata: { claimId, imgCode, imageId: image.id },
    });

    return NextResponse.json({ image });
  } catch (err) {
    logger.error("API /api/claims/images/upload error", err as Error, {
      component: "claim-image-upload",
      action: "upload.claim_image",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo subir la imagen" },
      { status: 500 }
    );
  }
}
