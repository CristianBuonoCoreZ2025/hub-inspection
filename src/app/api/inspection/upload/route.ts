import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * API route server-side para subir archivos a Nhost Storage.
 * Usa el admin secret para evitar problemas de permisos del rol 'user'
 * en la tabla storage.files.
 *
 * Recibe multipart/form-data con campo "file" (archivo único).
 * Devuelve { url } con la URL pública del archivo subido.
 */
export async function POST(request: NextRequest) {
  try {
    const adminSecret = process.env.NHOST_ADMIN_SECRET;
    if (!adminSecret) {
      return NextResponse.json({ error: "Falta NHOST_ADMIN_SECRET" }, { status: 500 });
    }

    const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
    const region = process.env.NEXT_PUBLIC_NHOST_REGION;
    const storageUrl =
      process.env.NEXT_PUBLIC_NHOST_STORAGE_URL ||
      (subdomain && region
        ? `https://${subdomain}.storage.${region}.nhost.run`
        : null);
    if (!storageUrl) {
      return NextResponse.json({ error: "Storage URL no configurado" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }

    // Reenviar a Nhost Storage con admin secret
    const uploadFormData = new FormData();
    uploadFormData.append("file[]", file);

    const res = await fetch(`${storageUrl}/v1/files`, {
      method: "POST",
      headers: {
        "x-hasura-admin-secret": adminSecret,
      },
      body: uploadFormData,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.error("Upload API: Storage respondió error", new Error(`HTTP ${res.status}`), {
        component: "upload-route",
        action: "storage.upload",
        metadata: { status: res.status, body: text.slice(0, 300) },
      });
      return NextResponse.json(
        { error: `Error al subir archivo (${res.status})` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as {
      processedFiles?: { id: string }[];
      error?: { message: string };
    };

    const fileId = data.processedFiles?.[0]?.id;
    if (!fileId) {
      return NextResponse.json(
        { error: data.error?.message || "No se recibió ID del archivo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: `${storageUrl}/v1/files/${fileId}` });
  } catch (err) {
    logger.error("Upload API error", err as Error, {
      component: "upload-route",
      action: "storage.upload",
    });
    return NextResponse.json(
      { error: "No se pudo subir el archivo" },
      { status: 500 }
    );
  }
}
