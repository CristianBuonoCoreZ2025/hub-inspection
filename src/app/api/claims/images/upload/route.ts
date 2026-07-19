import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { uploadClaimImageRaw, reuploadClaimImageOptimized } from "@/lib/storage/claim-upload";
import { summarizeFile } from "@/lib/ai/openrouter";
import { logger } from "@/lib/logger";

/**
 * API route para subir una imagen del siniestro a Cloudflare R2.
 *
 * Recibe multipart/form-data:
 *   - file: la imagen (jpg, png, webp, etc.)
 *   - claimId: UUID del siniestro
 *
 * Flujo (rápido — responde al cliente en ~1s):
 *  1. Sube el archivo original a R2 (sin optimizar)
 *  2. Inserta el registro en claim_images
 *  3. Devuelve éxito al cliente
 *
 * Flujo paralelo (background, después de responder):
 *  4. Optimiza la imagen (sharp: max 1920px, quality 80)
 *  5. Re-sube la versión optimizada a R2
 *  6. Actualiza url + file_path en claim_images
 *  7. Genera descripción con IA (visión)
 *  8. Actualiza ai_summary + ai_model en claim_images
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
      if (user?.id) {
        // Validar que el usuario exista en profiles antes de usarlo como FK
        const admin = createAdminClient();
        const { data: profile } = await admin
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        if (profile) {
          userId = user.id;
        } else {
          logger.warn("Usuario autenticado no existe en profiles", {
            component: "claim-image-upload",
            action: "auth.profile_missing",
            metadata: { userId: user.id },
          });
        }
      }
    } catch {
      // sin sesión — continúa sin userId
    }

    const ext = file.name.includes(".")
      ? "." + file.name.split(".").pop()?.toLowerCase()
      : ".jpg";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── PASO 1: Subir original a R2 (sin optimizar — rápido) ──
    const { url, key, seq, imgCode } = await uploadClaimImageRaw(
      claimId,
      buffer,
      mimeType,
      ext
    );

    // ── PASO 2: Insertar registro en claim_images ──
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
        is_active: true,
      })
      .select(
        "id, claim_id, img_code, url, original_filename, mime_type, file_size, uploaded_by, ai_summary, ai_model, is_active, created_at, updated_at"
      )
      .single();

    if (error) {
      logger.error("Claim image upload: insert falló", new Error(error.message), {
        component: "claim-image-upload",
        action: "insert.claim_image",
        metadata: { error: error.message, code: error.code, details: error.details, hint: error.hint },
      });
      return NextResponse.json(
        { error: `Error al registrar imagen: ${error.message} (code: ${error.code})` },
        { status: 500 }
      );
    }

    logger.info("Imagen de siniestro registrada", {
      component: "claim-image-upload",
      action: "upload.success",
      metadata: { claimId, imgCode, imageId: image.id },
    });

    // ── PASO 3: Devolver éxito al cliente ──
    const response = NextResponse.json({ image });

    // ── PASO 4-8: Procesamiento en background (optimización + IA) ──
    // after() ejecuta después de que la respuesta se envía al cliente.
    // Si falla, no afecta al usuario — la imagen ya está subida y registrada.
    after(async () => {
      const imageId = image.id;
      try {
        // ── Optimización: re-subir versión optimizada ──
        try {
          const optimized = await reuploadClaimImageOptimized(
            claimId,
            seq,
            buffer,
            mimeType,
            ext
          );

          // Actualizar url + file_path en la BD
          await supabase
            .from("claim_images")
            .update({
              url: optimized.url,
              file_path: optimized.key,
              updated_at: new Date().toISOString(),
            })
            .eq("id", imageId);

          logger.info("Imagen optimizada y actualizada en BD", {
            component: "claim-image-upload",
            action: "optimize.success",
            metadata: { imageId, newKey: optimized.key },
          });
        } catch (optErr) {
          logger.warn("Optimización de imagen falló (no crítico)", {
            component: "claim-image-upload",
            action: "optimize.error",
            metadata: {
              error: optErr instanceof Error ? optErr.message : String(optErr),
            },
          });
        }

        // ── IA: descripción automática de la imagen ──
        try {
          const ai = await summarizeFile(buffer, mimeType, file.name);
          if (ai.ok) {
            await supabase
              .from("claim_images")
              .update({
                ai_summary: ai.summary,
                ai_model: ai.model,
                updated_at: new Date().toISOString(),
              })
              .eq("id", imageId);

            logger.info("IA: descripción de imagen generada y guardada", {
              component: "claim-image-upload",
              action: "ai.summary.success",
              metadata: { imageId, model: ai.model },
            });
          } else {
            logger.warn("IA: no se pudo generar descripción", {
              component: "claim-image-upload",
              action: "ai.summary.skipped",
              metadata: { imageId, reason: ai.reason },
            });
          }
        } catch (aiErr) {
          logger.warn("IA: error generando descripción (no crítico)", {
            component: "claim-image-upload",
            action: "ai.summary.error",
            metadata: {
              error: aiErr instanceof Error ? aiErr.message : String(aiErr),
            },
          });
        }
      } catch (bgErr) {
        logger.error("Background processing falló", bgErr as Error, {
          component: "claim-image-upload",
          action: "background.error",
          metadata: { imageId },
        });
      }
    });

    return response;
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
