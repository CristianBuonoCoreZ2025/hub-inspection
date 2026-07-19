import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * DELETE /api/claims/images/[id]
 *
 * Elimina (soft delete) una imagen del siniestro.
 * Solo se permite si el siniestro NO está cerrado (claim_status != "closed").
 *
 * 1. Trae la imagen por id
 * 2. Trae el claim y su status
 * 3. Si el claim está cerrado → 403
 * 4. Soft delete: is_active = false
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = createAdminClient();

    // 1. Traer la imagen
    const { data: image, error: imgErr } = await supabase
      .from("claim_images")
      .select("id, claim_id, img_code, is_active")
      .eq("id", id)
      .maybeSingle();

    if (imgErr) throw new Error(imgErr.message);
    if (!image) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }
    if (!image.is_active) {
      return NextResponse.json({ error: "La imagen ya fue eliminada" }, { status: 404 });
    }

    // 2. Validar que el siniestro no esté cerrado
    const { data: claim } = await supabase
      .from("claims")
      .select("status_id, liquidation_number")
      .eq("id", image.claim_id)
      .maybeSingle();

    if (claim?.status_id) {
      const { data: status } = await supabase
        .from("lookup_catalog")
        .select("code")
        .eq("id", claim.status_id)
        .maybeSingle();

      if (status?.code === "closed") {
        return NextResponse.json(
          { error: "No se puede eliminar: la liquidación está cerrada" },
          { status: 403 }
        );
      }
    }

    // 3. Soft delete
    const { error: updateErr } = await supabase
      .from("claim_images")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateErr) {
      logger.error("Claim image delete: update falló", new Error(updateErr.message), {
        component: "claim-image-delete",
        action: "soft_delete",
        metadata: { imageId: id },
      });
      return NextResponse.json({ error: "Error al eliminar imagen" }, { status: 500 });
    }

    logger.info("Imagen de siniestro eliminada (soft delete)", {
      component: "claim-image-delete",
      action: "delete.success",
      metadata: { imageId: id, imgCode: image.img_code, claimId: image.claim_id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("API /api/claims/images/[id] DELETE error", err as Error, {
      component: "claim-image-delete",
      action: "route",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
