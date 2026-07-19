import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { uploadClaimDocument } from "@/lib/storage/claim-upload";
import { logger } from "@/lib/logger";

/**
 * API route para subir un documento del siniestro a Cloudflare R2.
 *
 * Recibe multipart/form-data:
 *   - file: el archivo
 *   - claimId: UUID del siniestro
 *   - documentTypeCode: código del tipo de documento (opcional)
 *
 * Flujo:
 *  1. Resuelve claimId → claim.liquidation_number
 *  2. Obtiene el siguiente correlativo DOC-NNNNNN atómico desde la BD
 *  3. Sube a R2 con path: claims/{L}/documents/{L}-DOC-NNNNNN.ext
 *  4. Inserta el registro en claim_documents (doc_code, file_path, file_url NOT NULL)
 *  5. Vincula con claim_document_request_items pendientes del mismo tipo:
 *     marca el item como "received" con received_file_url, received_at, received_by
 *  6. Si todos los items del request están recibidos/no_necesarios → cierra el request
 *
 * Devuelve: { document: { id, document_name, document_url, ... } }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const claimId = formData.get("claimId");
    const documentTypeCode = formData.get("documentTypeCode");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (!claimId || typeof claimId !== "string") {
      return NextResponse.json({ error: "Falta claimId" }, { status: 400 });
    }

    // Obtener usuario actual (para registrar quién subió)
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    const userId = user?.id || null;

    const mimeType = file.type || "application/octet-stream";
    const ext = file.name.includes(".")
      ? "." + file.name.split(".").pop()?.toLowerCase()
      : "";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a R2 con path estructurado del plan
    const { url, key, docCode } = await uploadClaimDocument(claimId, buffer, mimeType, ext || ".bin");

    // Insertar en claim_documents — llenar columnas NOT NULL del schema original
    const supabase = createAdminClient();
    const { data: document, error } = await supabase
      .from("claim_documents")
      .insert({
        claim_id: claimId,
        doc_code: docCode,
        file_path: key,
        file_url: url,
        original_filename: file.name,
        mime_type: mimeType,
        document_name: file.name,
        document_url: url,
        document_type: typeof documentTypeCode === "string" && documentTypeCode ? documentTypeCode : null,
        file_size: file.size,
        is_active: true,
        uploaded_by: userId,
        created_by: userId,
      })
      .select("id, claim_id, doc_code, document_name, document_url, document_type, original_filename, mime_type, file_size, file_path, is_active, created_at, updated_at")
      .single();

    if (error) {
      logger.error("Claim doc upload: insert falló", new Error(error.message), {
        component: "claim-doc-upload",
        action: "insert.claim_doc",
      });
      return NextResponse.json({ error: "Error al registrar documento" }, { status: 500 });
    }

    // Vincular con claim_document_request_items pendientes del mismo tipo
    if (documentTypeCode && typeof documentTypeCode === "string") {
      const now = new Date().toISOString();

      // Buscar items pendientes (status = "requested") del mismo document_type_code
      // en los requests activos de este claim
      const { data: activeRequests } = await supabase
        .from("claim_document_requests")
        .select("id")
        .eq("claim_id", claimId)
        .in("status", ["requested", "received"]);

      if (activeRequests && activeRequests.length > 0) {
        const requestIds = activeRequests.map((r: { id: string }) => r.id);

        const { data: pendingItems, error: itemsErr } = await supabase
          .from("claim_document_request_items")
          .select("id, request_id, document_type_code, status")
          .in("request_id", requestIds)
          .eq("document_type_code", documentTypeCode)
          .eq("status", "requested");

        if (!itemsErr && pendingItems && pendingItems.length > 0) {
          // Marcar cada item pendiente como "received"
          for (const item of pendingItems) {
            await supabase
              .from("claim_document_request_items")
              .update({
                status: "received",
                received_file_url: url,
                received_file_id: document.id,
                received_at: now,
                received_by: userId,
                updated_at: now,
              })
              .eq("id", item.id);
          }

          logger.info("Items de solicitud marcados como recibidos", {
            component: "claim-doc-upload",
            action: "link.request_items",
            metadata: {
              claim_id: claimId,
              document_type: documentTypeCode,
              items_count: pendingItems.length,
            },
          });

          // Verificar si todos los items del request están recibidos/no_necesarios
          // → cerrar el request automáticamente
          for (const reqId of requestIds) {
            const { data: allItems } = await supabase
              .from("claim_document_request_items")
              .select("status")
              .eq("request_id", reqId);

            if (allItems && allItems.length > 0) {
              const allDone = allItems.every(
                (it: { status: string }) => it.status === "received" || it.status === "not_needed"
              );
              if (allDone) {
                await supabase
                  .from("claim_document_requests")
                  .update({
                    status: "received",
                    updated_at: now,
                  })
                  .eq("id", reqId);

                logger.info("Solicitud cerrada automáticamente (todos los items recibidos)", {
                  component: "claim-doc-upload",
                  action: "auto_close.request",
                  metadata: { request_id: reqId },
                });
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ document });
  } catch (err) {
    logger.error("API /api/claims/documents/upload error", err as Error, {
      component: "claim-doc-upload",
      action: "upload.claim_doc",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo subir el documento" },
      { status: 500 }
    );
  }
}
