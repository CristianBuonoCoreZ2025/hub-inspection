import { NextRequest, NextResponse } from "next/server";
import { adminGraphqlRequest } from "@/lib/nhost/admin-graphql";
import { logger } from "@/lib/logger";

/**
 * API route para que el cliente (magic link) guarde su firma.
 * Recibe: { sessionId, role, signatureDataUrl (base64 PNG) }
 * 1. Sube la imagen a Nhost Storage con admin secret
 * 2. Crea el registro en inspection_signatures con admin secret
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId, role, signatureDataUrl } = await request.json();
    if (!sessionId || !signatureDataUrl || !role) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const adminSecret = process.env.NHOST_ADMIN_SECRET;
    if (!adminSecret) {
      return NextResponse.json({ error: "Falta admin secret" }, { status: 500 });
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

    // 1. Convertir base64 a blob y subir a Storage
    const base64Response = await fetch(signatureDataUrl);
    const blob = await base64Response.blob();
    const file = new File([blob], `signature_${role}_${Date.now()}.png`, { type: "image/png" });

    const uploadFormData = new FormData();
    uploadFormData.append("file[]", file);

    const uploadRes = await fetch(`${storageUrl}/v1/files`, {
      method: "POST",
      headers: { "x-hasura-admin-secret": adminSecret },
      body: uploadFormData,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => "");
      logger.error("Sign API: upload falló", new Error(`HTTP ${uploadRes.status}`), {
        component: "inspection-sign-route",
        action: "storage.upload",
        metadata: { status: uploadRes.status, body: text.slice(0, 200) },
      });
      return NextResponse.json({ error: "Error al subir firma" }, { status: 500 });
    }

    const uploadData = (await uploadRes.json()) as { processedFiles?: { id: string }[] };
    const fileId = uploadData.processedFiles?.[0]?.id;
    if (!fileId) {
      return NextResponse.json({ error: "No se recibió ID del archivo" }, { status: 500 });
    }

    const signatureUrl = `${storageUrl}/v1/files/${fileId}`;

    // 2. Crear registro en inspection_signatures
    const mutation = `
      mutation CreateSignature($object: inspection_signatures_insert_input!) {
        insert_inspection_signatures_one(object: $object) {
          id role signature_url signed_at
        }
      }
    `;
    const data = await adminGraphqlRequest<{ insert_inspection_signatures_one: { id: string; role: string; signature_url: string; signed_at: string } }>(
      mutation,
      {
        object: {
          session_id: sessionId,
          role,
          signature_url: signatureUrl,
          signed_at: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json({ signature: data.insert_inspection_signatures_one });
  } catch (err) {
    logger.error("API /api/inspection/sign error", err as Error, {
      component: "inspection-sign-route",
      action: "save.signature",
    });
    return NextResponse.json({ error: "No se pudo guardar la firma" }, { status: 500 });
  }
}
