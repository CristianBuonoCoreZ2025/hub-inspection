import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { deleteFromR2 } from "@/lib/storage/r2-upload";
import { logActionHistory } from "@/services/claim-action-history";
import { getProfileName } from "@/services/claim-actions";
import { logger } from "@/lib/logger";

/**
 * API route para eliminar (hard delete) un documento del siniestro.
 *
 * Reglas:
 *  1. No se puede eliminar si la liquidación está cerrada (claim_status = "closed")
 *  2. No se pueden eliminar documentos recibidos por webservices (origin = "ws")
 *     — no implementado aún, pero la validación queda preparada
 *  3. Al eliminar:
 *     a. Borra el archivo físico de R2
 *     b. Hard-delete del registro en claim_documents
 *     c. Si RTA (Recepción Total de Antecedentes) está emitida → reversar a "todo"
 *        porque el documento que la justificaba ya no existe
 *     d. Si el documento estaba vinculado a un claim_document_request_item,
 *        desvincularlo (limpiar received_file_url, received_at, etc.)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    if (!documentId) {
      return NextResponse.json({ error: "Falta documentId" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Obtener usuario actual (para registrar quién eliminó)
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    const userId = user?.id || null;

    // 1. Obtener el documento
    const { data: doc, error: docErr } = await supabase
      .from("claim_documents")
      .select("id, claim_id, file_path, doc_code, document_type, original_filename")
      .eq("id", documentId)
      .maybeSingle();

    if (docErr) throw new Error(docErr.message);
    if (!doc) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    // 2. Validar que la liquidación no esté cerrada
    const { data: claim } = await supabase
      .from("claims")
      .select("status_id, liquidation_number")
      .eq("id", doc.claim_id)
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

    // 3. (Futuro) Validar que no sea un documento recibido por webservice
    // if (doc.origin === "ws") {
    //   return NextResponse.json(
    //     { error: "No se puede eliminar: documento recibido por webservice" },
    //     { status: 403 }
    //   );
    // }

    // 4. Desvincular de claim_document_request_items si estaba linkeado
    //    + reabrir el request si estaba cerrado (status="received")
    if (doc.document_type) {
      const affectedRequestIds = (
        await supabase
          .from("claim_document_requests")
          .select("id")
          .eq("claim_id", doc.claim_id)
      ).data?.map((r: { id: string }) => r.id) || [];

      if (affectedRequestIds.length > 0) {
        await supabase
          .from("claim_document_request_items")
          .update({
            received_file_url: null,
            received_file_id: null,
            received_at: null,
            received_by: null,
            status: "requested",
            updated_at: new Date().toISOString(),
          })
          .eq("document_type_code", doc.document_type)
          .in("request_id", affectedRequestIds);

        // Reabrir requests que estaban cerrados (status="received" → "requested")
        // porque al eliminar un documento, ya no están completos
        await supabase
          .from("claim_document_requests")
          .update({
            status: "requested",
            updated_at: new Date().toISOString(),
          })
          .in("id", affectedRequestIds)
          .eq("status", "received");
      }
    }

    // 5. Verificar si RTA está emitida → reversar
    const rtaTemplateIds = (
      await supabase
        .from("action_template")
        .select("id")
        .eq("code", "RTA")
    ).data?.map((t: { id: string }) => t.id) || [];

    if (rtaTemplateIds.length > 0) {
      const { data: rtaActions } = await supabase
        .from("claim_actions")
        .select("id, action_status_id, issued_on, issued_by")
        .eq("claim_id", doc.claim_id)
        .in("action_template_id", rtaTemplateIds)
        .not("issued_on", "is", null);

      if (rtaActions && rtaActions.length > 0) {
        // Obtener el status_id de "todo"
        const { data: todoStatus } = await supabase
          .from("lookup_catalog")
          .select("id")
          .eq("category", "action_status")
          .eq("code", "todo")
          .maybeSingle();

        if (todoStatus) {
          for (const rta of rtaActions) {
            await supabase
              .from("claim_actions")
              .update({
                action_status_id: todoStatus.id,
                issued_on: null,
                issued_by: null,
                updated_on: new Date().toISOString(),
              })
              .eq("id", rta.id);

            // Registrar en historial: reversión de emisión
            const performerName = userId ? await getProfileName(userId) : null;
            await logActionHistory({
              claim_action_id: rta.id,
              event_type: "reversed",
              from_status_code: "issued",
              to_status_code: "todo",
              performed_by: userId,
              performed_by_name: performerName,
              level: "issue",
              comment: `Reversada por eliminación del documento ${doc.doc_code} (${doc.document_type})`,
              metadata: {
                reason: "document_deleted",
                document_id: documentId,
                doc_code: doc.doc_code,
                document_type: doc.document_type,
                original_filename: doc.original_filename,
                deleted_by: userId,
                deleted_by_name: performerName,
                deleted_at: new Date().toISOString(),
              },
            });
          }
          logger.info("RTA reversada por eliminación de documento", {
            component: "claim-documents",
            action: "rta.reversal",
            metadata: {
              claim_id: doc.claim_id,
              document_id: documentId,
              rta_count: rtaActions.length,
            },
          });
        }
      }
    }

    // 6. Borrar el archivo físico de R2
    if (doc.file_path) {
      try {
        await deleteFromR2(doc.file_path);
      } catch (r2Err) {
        // Si R2 falla, igual borramos el registro de la BD
        logger.error("Error borrando archivo de R2 (continuando con BD)", {
          component: "claim-documents",
          action: "r2.delete.error",
          metadata: { file_path: doc.file_path, error: String(r2Err) },
        });
      }
    }

    // 7. Hard-delete del registro en claim_documents
    const { error: deleteErr } = await supabase
      .from("claim_documents")
      .delete()
      .eq("id", documentId);

    if (deleteErr) throw new Error(deleteErr.message);

    logger.info("Documento eliminado", {
      component: "claim-documents",
      action: "document.delete",
      metadata: {
        document_id: documentId,
        claim_id: doc.claim_id,
        doc_code: doc.doc_code,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("Error eliminando documento", {
      component: "claim-documents",
      action: "document.delete.error",
      metadata: { error: String(err) },
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
