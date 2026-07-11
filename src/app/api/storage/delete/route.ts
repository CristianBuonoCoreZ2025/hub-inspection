import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, r2Bucket } from "@/lib/storage/r2-client";
import { logger } from "@/lib/logger";

/**
 * API route para eliminar archivos de Cloudflare R2.
 *
 * Recibe JSON:
 *   - key: la clave (path) del archivo en R2
 *
 * Devuelve:
 *   - success: true si se eliminó correctamente
 */
export async function POST(request: NextRequest) {
  try {
    if (!r2Bucket) {
      return NextResponse.json(
        { error: "R2 no configurado. Faltan variables de entorno." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { key } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "No se especificó la clave (key)" }, { status: 400 });
    }

    const command = new DeleteObjectCommand({
      Bucket: r2Bucket,
      Key: key,
    });

    await r2Client.send(command);

    logger.info("Archivo eliminado de R2", {
      component: "storage-delete",
      action: "r2.delete",
      metadata: { key },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("Error eliminando de R2", err as Error, {
      component: "storage-delete",
      action: "r2.delete",
    });
    return NextResponse.json(
      { error: "No se pudo eliminar el archivo de R2" },
      { status: 500 }
    );
  }
}
