import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadInspectionFile } from "@/lib/storage/inspection-upload";
import { logger } from "@/lib/logger";

/**
 * API route para subir una firma como archivo (no dibujada) a R2.
 *
 * A diferencia de /api/inspection/sign (que recibe base64 dibujado),
 * este endpoint recibe un File subido por el usuario.
 *
 * Path: claims/{L}/actions/{code}/images/{code}-FIR-NNNN.png
 *
 * Recibe multipart/form-data:
 *   - file: el archivo (png, jpg)
 *   - sessionId: UUID de la inspection_session
 *   - role: "insured" | "adjuster"
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sessionId = formData.get("sessionId");
    const role = formData.get("role");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }
    if (!role || (role !== "insured" && role !== "adjuster")) {
      return NextResponse.json({ error: "Falta role (insured o adjuster)" }, { status: 400 });
    }

    const mimeType = file.type || "image/png";
    const ext = file.name.includes(".")
      ? "." + file.name.split(".").pop()?.toLowerCase()
      : ".png";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a R2 con path estructurado (FIR = firma)
    const { url } = await uploadInspectionFile(sessionId, buffer, mimeType, "FIR", ext);

    // Insertar en inspection_signatures
    const supabase = createAdminClient();
    const { data: signature, error } = await supabase
      .from("inspection_signatures")
      .insert({
        session_id: sessionId,
        role,
        signature_url: url,
        signed_at: new Date().toISOString(),
      })
      .select("id, role, signature_url, signed_at")
      .single();

    if (error) {
      logger.error("Signature file upload: insert falló", new Error(error.message), {
        component: "inspection-sign-upload",
        action: "insert.signature",
      });
      return NextResponse.json({ error: "Error al registrar firma" }, { status: 500 });
    }

    return NextResponse.json({ signature });
  } catch (err) {
    logger.error("API /api/inspection/sign/upload error", err as Error, {
      component: "inspection-sign-upload",
      action: "upload.signature_file",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo subir la firma" },
      { status: 500 }
    );
  }
}
