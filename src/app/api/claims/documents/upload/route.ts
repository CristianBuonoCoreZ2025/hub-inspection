import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { uploadClaimDocumentRaw, reuploadClaimDocumentOptimized } from "@/lib/storage/claim-upload";
import { logActionHistory } from "@/services/claim-action-history";
import { summarizeFile } from "@/lib/ai/openrouter";
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

    logger.info("Upload request received", {
      component: "claim-doc-upload",
      action: "upload.start",
      metadata: {
        hasFile: !!file,
        fileName: file instanceof File ? file.name : "not-a-file",
        fileSize: file instanceof File ? file.size : 0,
        claimId: String(claimId),
        documentTypeCode: String(documentTypeCode),
      },
    });

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (!claimId || typeof claimId !== "string") {
      return NextResponse.json({ error: "Falta claimId" }, { status: 400 });
    }

    // Obtener usuario actual (para registrar quién subió)
    let userId: string | null = null;
    try {
      const serverClient = await createServerClient();
      const { data: { user } } = await serverClient.auth.getUser();
      userId = user?.id || null;
      logger.info("User from session", {
        component: "claim-doc-upload",
        action: "auth.user",
        metadata: { userId },
      });
    } catch (authErr) {
      logger.error("Error getting user session", authErr as Error, {
        component: "claim-doc-upload",
        action: "auth.error",
      });
    }

    const mimeType = file.type || "application/octet-stream";
    const ext = file.name.includes(".")
      ? "." + file.name.split(".").pop()?.toLowerCase()
      : "";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a R2 SIN optimizar (raw, rápido) — la optimización va en background
    const { url, key, seq, docCode } = await uploadClaimDocumentRaw(claimId, buffer, mimeType, ext || ".bin");

    // Insertar en claim_documents (sin IA aún — se hace en background)
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
        ai_summary: null,
        ai_model: null,
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
    // Solo si el documento coincide con un item pendiente de un request RTA
    if (documentTypeCode && typeof documentTypeCode === "string") {
      const now = new Date().toISOString();

      // Buscar requests del claim que estén pendientes (status != received)
      const { data: openRequests } = await supabase
        .from("claim_document_requests")
        .select("id")
        .eq("claim_id", claimId)
        .neq("status", "received");

      if (openRequests && openRequests.length > 0) {
        const requestIds = openRequests.map((r: { id: string }) => r.id);

        // Buscar items pendientes (status="requested") del mismo tipo
        const { data: pendingItems, error: itemsErr } = await supabase
          .from("claim_document_request_items")
          .select("id, request_id, document_type_code, status")
          .in("request_id", requestIds)
          .eq("document_type_code", documentTypeCode)
          .eq("status", "requested");

        // Si NO hay items pendientes de este tipo, no vincular ni tocar RTA
        if (!itemsErr && pendingItems && pendingItems.length > 0) {
          // 1. Marcar items como received
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

          // 2. Verificar si todos los items del request están resueltos
          //    → cerrar el request + autoemitir RTA
          const affectedRequestIds = [...new Set(pendingItems.map((i: { request_id: string }) => i.request_id))];

          for (const reqId of affectedRequestIds) {
          const { data: allItems } = await supabase
            .from("claim_document_request_items")
            .select("status")
            .eq("request_id", reqId);

          if (!allItems || allItems.length === 0) continue;

          const allDone = allItems.every(
            (it: { status: string }) => it.status === "received" || it.status === "not_needed"
          );

          if (!allDone) continue;

          // Cerrar el request si no estaba cerrado
          await supabase
            .from("claim_document_requests")
            .update({ status: "received", updated_at: now })
            .eq("id", reqId)
            .neq("status", "received");

          logger.info("Solicitud cerrada (todos los items recibidos)", {
            component: "claim-doc-upload",
            action: "auto_close.request",
            metadata: { request_id: reqId },
          });

          // 3. Autoemitir RTA si está pendiente (status = "todo")
          const rtaTemplateIds = (
            await supabase
              .from("action_template")
              .select("id")
              .eq("code", "RTA")
          ).data?.map((t: { id: string }) => t.id) || [];

          if (rtaTemplateIds.length === 0) continue;

          const { data: rtaActions } = await supabase
            .from("claim_actions")
            .select("id, action_status_id")
            .eq("claim_id", claimId)
            .in("action_template_id", rtaTemplateIds);

          if (!rtaActions || rtaActions.length === 0) continue;

          // Obtener status_id de "todo" y "issued"
          const { data: todoStatus } = await supabase
            .from("lookup_catalog")
            .select("id")
            .eq("category", "action_status")
            .eq("code", "todo")
            .maybeSingle();

          const { data: issuedStatus } = await supabase
            .from("lookup_catalog")
            .select("id")
            .eq("category", "action_status")
            .eq("code", "issued")
            .maybeSingle();

          if (!todoStatus || !issuedStatus) continue;

          const pendingRta = rtaActions.find(
            (a: { id: string; action_status_id: string }) =>
              a.action_status_id === todoStatus.id
          );

          if (!pendingRta) continue;

          try {
            // Validar que el userId exista en profiles (FK constraint)
            let validUserId = userId;
            if (userId) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("id, full_name")
                .eq("id", userId)
                .maybeSingle();
              if (!profile) {
                validUserId = null;
              }
            }

            const nowIso = new Date().toISOString();
            const updateFields: Record<string, unknown> = {
              action_status_id: issuedStatus.id,
              issued_on: nowIso,
              issued_by: userId,
              updated_on: nowIso,
            };
            if (validUserId) {
              updateFields.issuer_id = validUserId;
            }

            // Emitir RTA directamente con admin client (sin issueClaimAction)
            const { error: issueErr } = await supabase
              .from("claim_actions")
              .update(updateFields)
              .eq("id", pendingRta.id);

            if (issueErr) throw new Error(issueErr.message);

            // Obtener nombre del performer
            let performerName: string | null = null;
            if (validUserId) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", validUserId)
                .maybeSingle();
              performerName = profile?.full_name || null;
            }

            // Registrar en historial
            await logActionHistory({
              claim_action_id: pendingRta.id,
              event_type: "issued",
              from_status_code: "todo",
              to_status_code: "issued",
              performed_by: validUserId || null,
              performed_by_name: performerName,
              level: "issue",
              comment: `Autoemitida por recepción completa (último documento: ${docCode})`,
              metadata: {
                auto_issued: true,
                reason: "all_documents_received",
                triggered_by_document: docCode,
                triggered_by_user: userId,
                triggered_by_user_name: performerName,
                triggered_at: nowIso,
              },
              supabase,
            });

            logger.info("RTA autoemitida por recepción completa de documentos", {
              component: "claim-doc-upload",
              action: "auto_issue.rta",
              metadata: {
                claim_id: claimId,
                rta_action_id: pendingRta.id,
                issued_by: userId,
              },
            });
          } catch (issueErr) {
            logger.error("Error autoemitiendo RTA", issueErr as Error, {
              component: "claim-doc-upload",
              action: "auto_issue.rta.error",
              metadata: { error: String(issueErr) },
            });
          } // cierra try/catch issueErr
        } // cierra for (reqId)
      } // cierra if (pendingItems)
    } // cierra if (openRequests)
    } // cierra if (documentTypeCode)

    // ── Background: IA + optimización del archivo ──
    // Se ejecuta después de responder al cliente para no bloquear la subida
    const docId = document.id;
    const docBuffer = buffer;
    const docMimeType = mimeType;
    const docFileName = file.name;
    const docExt = ext || ".bin";
    const docSeq = seq;

    after(async () => {
      // 1. IA: resumen automático
      let aiSummary: string | null = null;
      let aiModel: string | null = null;
      try {
        const ai = await summarizeFile(docBuffer, docMimeType, docFileName);
        if (ai.ok) {
          aiSummary = ai.summary;
          aiModel = ai.model;
          logger.info("IA (bg): resumen generado", {
            component: "claim-doc-upload",
            action: "ai.summary.bg",
            metadata: { docId, model: ai.model, summaryLength: ai.summary.length },
          });
        } else {
          logger.warn("IA (bg): documento no procesado", {
            component: "claim-doc-upload",
            action: "ai.summary.skipped.bg",
            metadata: { docId, mimeType: docMimeType, reason: ai.reason },
          });
        }
      } catch (aiErr) {
        logger.warn("IA (bg): no se pudo generar resumen", {
          component: "claim-doc-upload",
          action: "ai.summary.error.bg",
          metadata: { docId, error: aiErr instanceof Error ? aiErr.message : String(aiErr) },
        });
      }

      // 2. Optimización del archivo (re-subir versión optimizada a R2)
      let optimizedUrl: string | null = null;
      let optimizedKey: string | null = null;
      try {
        const result = await reuploadClaimDocumentOptimized(
          claimId, docSeq, docBuffer, docMimeType, docExt
        );
        optimizedUrl = result.url;
        optimizedKey = result.key;
        logger.info("Optimización (bg): documento optimizado", {
          component: "claim-doc-upload",
          action: "optimize.bg",
          metadata: { docId, originalSize: docBuffer.length, optimizedKey },
        });
      } catch (optErr) {
        logger.warn("Optimización (bg): no se pudo optimizar", {
          component: "claim-doc-upload",
          action: "optimize.error.bg",
          metadata: { docId, error: optErr instanceof Error ? optErr.message : String(optErr) },
        });
      }

      // 3. Actualizar el registro con IA + URL optimizada
      try {
        const updateFields: Record<string, unknown> = {};
        if (aiSummary) {
          updateFields.ai_summary = aiSummary;
          updateFields.ai_model = aiModel;
        }
        if (optimizedUrl && optimizedKey) {
          updateFields.file_url = optimizedUrl;
          updateFields.file_path = optimizedKey;
          updateFields.document_url = optimizedUrl;
        }
        if (Object.keys(updateFields).length > 0) {
          await createAdminClient()
            .from("claim_documents")
            .update(updateFields)
            .eq("id", docId);
          logger.info("Background: documento actualizado", {
            component: "claim-doc-upload",
            action: "bg.update",
            metadata: { docId, fields: Object.keys(updateFields) },
          });
        }
      } catch (updErr) {
        logger.error("Background: error actualizando documento", updErr as Error, {
          component: "claim-doc-upload",
          action: "bg.update.error",
          metadata: { docId },
        });
      }
    });

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
