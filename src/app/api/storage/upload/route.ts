import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, r2Bucket, r2PublicUrl } from "@/lib/storage/r2-client";
import { logger } from "@/lib/logger";

/**
 * API route para subir archivos a Cloudflare R2.
 *
 * Recibe multipart/form-data:
 *   - file: el archivo a subir
 *   - path: la ruta completa en R2 (ej: "configuracion/gestiones/HILI/HILI-00001.docx")
 *
 * Devuelve:
 *   - url: URL pública del archivo
 *   - key: la clave (path) en R2
 *   - size: tamaño en bytes
 *   - contentType: tipo MIME
 */
export async function POST(request: NextRequest) {
  try {
    if (!r2Bucket) {
      return NextResponse.json(
        { error: "R2 no configurado. Faltan variables de entorno." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const path = formData.get("path");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "No se especificó la ruta (path)" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const command = new PutObjectCommand({
      Bucket: r2Bucket,
      Key: path,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
    });

    await r2Client.send(command);

    const url = `${r2PublicUrl}/${path}`;

    logger.info("Archivo subido a R2", {
      component: "storage-upload",
      action: "r2.upload",
      metadata: { path, size: file.size, contentType: file.type },
    });

    return NextResponse.json({
      url,
      key: path,
      size: file.size,
      contentType: file.type,
    });
  } catch (err) {
    logger.error("Error subiendo a R2", err as Error, {
      component: "storage-upload",
      action: "r2.upload",
    });
    return NextResponse.json(
      { error: "No se pudo subir el archivo a R2" },
      { status: 500 }
    );
  }
}
