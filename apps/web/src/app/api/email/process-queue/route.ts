import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { renderEmailTemplate, wrapHtmlEmail } from "@/services/email-render";
import { sendEmail } from "@/services/email-sender";

// ──────────────────────────────────────────────────────────────
// POST /api/email/process-queue
//
// Procesa los email_logs con status='queued' (generados por el trigger
// auto_issue_and_queue_email cuando una acción con auto_email=true se emite
// automáticamente). Para cada uno:
//  1. Carga la acción + claim + perfiles asociados.
//  2. Renderiza los placeholders del subject y body.
//  3. Envía el e-mail vía el proveedor configurado (Resend por defecto).
//  4. Actualiza email_logs con el resultado (status, provider_response, body final).
//
// Autenticación: usa SUPABASE_SERVICE_ROLE_KEY (admin, bypass RLS) porque
// este endpoint se llama desde cron/webhook sin sesión de usuario.
// Protección: si CRON_SECRET está en env, exige header x-cron-secret.
// Si no está seteado, se permite (modo desarrollo) pero se loguea warning.
// ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Protección por secret opcional
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const provided = request.headers.get("x-cron-secret");
      if (provided !== cronSecret) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
    } else {
      console.warn(
        "⚠️ /api/email/process-queue: CRON_SECRET no configurado. Endpoint sin protección."
      );
    }

    // Cliente admin (service role, bypass RLS) — necesario para procesar
    // logs de cualquier tenant sin sesión de usuario.
    const supabase = createAdminClient();

    // Cargar logs en cola (máximo 50 por batch)
    const { data: queuedLogs, error: queueError } = await supabase
      .from("email_logs")
      .select(
        "id, company_id, claim_id, claim_action_id, email_template_id, to_address, cc_address, bcc_address, sent_by"
      )
      .eq("status", "queued")
      .order("sent_at", { ascending: true })
      .limit(50);

    if (queueError) {
      return NextResponse.json({ error: queueError.message }, { status: 500 });
    }

    if (!queuedLogs || queuedLogs.length === 0) {
      return NextResponse.json({ processed: 0, message: "Cola vacía" });
    }

    const results: { id: string; status: string; error?: string }[] = [];

    for (const log of queuedLogs) {
      try {
        // Cargar la claim_action con el claim
        const { data: action, error: actionError } = await supabase
          .from("claim_actions")
          .select(
            "id, action_data, company_id, claim_id, action_template_id, claim:claims!inner(id, claim_number, liquidation_number, claim_date, claim_address, business_line_id, event_id, adjuster_id, assigned_adjuster_id, inspector_id, dispatcher_id, assistant_id, insurance_company_id, policy_id, owner_same_as_insured, owner_name, owner_email, owner_phone, country_id, region_id, city_id, commune_id, created_at)"
          )
          .eq("id", log.claim_action_id)
          .single();

        if (actionError || !action) {
          await markFailed(supabase, log.id, "Acción no encontrada");
          results.push({ id: log.id, status: "failed", error: "Acción no encontrada" });
          continue;
        }

        const claim = (action as unknown as { claim: Record<string, unknown> }).claim;

        // Cargar la plantilla
        const { data: template } = await supabase
          .from("email_templates")
          .select(
            "id, company_id, business_line_id, name, description, body_format, subject, body, logo_url, header_color, logo_position, placeholder_mapping, is_active"
          )
          .eq("id", log.email_template_id)
          .maybeSingle();

        if (!template || !template.is_active) {
          await markFailed(supabase, log.id, "Plantilla no encontrada o inactiva");
          results.push({ id: log.id, status: "failed", error: "Plantilla inactiva" });
          continue;
        }

        // Cargar perfiles asociados
        const profileIds = [
          claim.adjuster_id,
          claim.assigned_adjuster_id,
          claim.inspector_id,
          claim.dispatcher_id,
          claim.assistant_id,
        ].filter(Boolean) as string[];

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .in("id", profileIds);

        const profilesMap = new Map((profiles || []).map((p) => [p.id, p]));

        // Cargar datos de la empresa (cliente) para placeholders <company_*>
        const { data: company } = await supabase
          .from("companies")
          .select("id, name, rut, address, phone, email, logo_url, primary_color")
          .eq("id", action.company_id as string)
          .maybeSingle();

        // Construir data para renderizar
        const data: Record<string, unknown> = {
          ...claim,
          claim_id: claim.id,
          action_id: action.id,
          action_data: action.action_data,
          company_name: company?.name || "",
          company_rut: company?.rut || "",
          company_address: company?.address || "",
          company_phone: company?.phone || "",
          company_email: company?.email || "",
          company_logo: company?.logo_url || "",
          company_header_color: company?.primary_color || "#0095DA",
          adjuster_full_name: profilesMap.get(claim.adjuster_id as string)?.full_name || "",
          adjuster_email: profilesMap.get(claim.adjuster_id as string)?.email || "",
          assigned_adjuster_full_name: profilesMap.get(claim.assigned_adjuster_id as string)?.full_name || "",
          inspector_full_name: profilesMap.get(claim.inspector_id as string)?.full_name || "",
          inspector_email: profilesMap.get(claim.inspector_id as string)?.email || "",
          dispatcher_full_name: profilesMap.get(claim.dispatcher_id as string)?.full_name || "",
          assistant_full_name: profilesMap.get(claim.assistant_id as string)?.full_name || "",
          owner_name: claim.owner_name || "",
          owner_email: claim.owner_email || "",
          owner_phone: claim.owner_phone || "",
          claim_address: claim.claim_address || "",
          claim_number: claim.claim_number || "",
          liquidation_number: claim.liquidation_number || "",
        };

        // Aplanar action_data
        const actionData = (action.action_data || {}) as Record<string, unknown>;
        for (const [k, v] of Object.entries(actionData)) {
          if (typeof v !== "object" || v === null) {
            data[k] = v;
          }
        }

        // Cargar participantes del siniestro
        const { data: participants } = await supabase
          .from("claims_participants")
          .select("type, full_name, email, phone")
          .eq("claim_id", log.claim_id);

        for (const p of participants || []) {
          if (p.type === "insured") {
            data.insured_full_name = p.full_name || "";
            data.insured_email = p.email || "";
            data.insured_phone = p.phone || "";
          } else if (p.type === "contractor") {
            data.contractor_full_name = p.full_name || "";
            data.contractor_email = p.email || "";
          } else if (p.type === "beneficiary") {
            data.beneficiary_full_name = p.full_name || "";
            data.beneficiary_email = p.email || "";
          } else if (p.type === "contact") {
            data.contact_full_name = p.full_name || "";
            data.contact_email = p.email || "";
            data.contact_phone = p.phone || "";
          }
        }

        // Renderizar
        const { subject, body, body_format } = renderEmailTemplate(template, data);

        // Resolver destinatarios reales desde los roles configurados
        // to_address en el log contiene los roles (insured, adjuster, etc.)
        // Hay que mapearlos a emails reales.
        const resolvedTo = resolveRecipients(log.to_address, data, profilesMap, claim);
        const resolvedCc = resolveRecipients(log.cc_address, data, profilesMap, claim);
        const resolvedBcc = resolveRecipients(log.bcc_address, data, profilesMap, claim);

        if (resolvedTo.length === 0) {
          // No hay destinatarios con email — marcar como failed con nota
          await supabase
            .from("email_logs")
            .update({
              status: "failed",
              subject,
              body,
              body_format,
              provider_response: { error: "No hay destinatarios con email cargado para los roles configurados" },
              sent_at: new Date().toISOString(),
            })
            .eq("id", log.id);
          results.push({ id: log.id, status: "failed", error: "Sin destinatarios" });
          continue;
        }

        // Envolver HTML si corresponde
        // Usa header_color, logo_url y logo_position de la PLANTILLA
        const tplTyped = template as { logo_url: string | null; header_color: string | null; logo_position: "left" | "center" | "right" | null } | null;
        const finalBody =
          body_format === "html"
            ? wrapHtmlEmail({
                body,
                logoUrl: tplTyped?.logo_url ?? (data.company_logo as string) ?? null,
                headerColor: tplTyped?.header_color ?? null,
                companyName: data.company_name as string,
                logoPosition: tplTyped?.logo_position ?? "center",
              })
            : body;

        // Enviar
        const result = await sendEmail({
          to: resolvedTo,
          cc: resolvedCc,
          bcc: resolvedBcc,
          subject,
          body: finalBody,
          html: body_format === "html",
        });

        // Actualizar el log
        await supabase
          .from("email_logs")
          .update({
            status: result.status,
            subject,
            body: finalBody,
            body_format,
            to_address: resolvedTo,
            cc_address: resolvedCc,
            bcc_address: resolvedBcc,
            provider_response: result.provider_response,
            sent_at: new Date().toISOString(),
          })
          .eq("id", log.id);

        results.push({ id: log.id, status: result.status });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado";
        await markFailed(supabase, log.id, message);
        results.push({ id: log.id, status: "failed", error: message });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({
      processed: results.length,
      sent,
      failed,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

async function markFailed(
  supabase: ReturnType<typeof createAdminClient>,
  logId: string,
  message: string
) {
  await supabase
    .from("email_logs")
    .update({
      status: "failed",
      provider_response: { error: message },
      sent_at: new Date().toISOString(),
    })
    .eq("id", logId);
}

/**
 * Resuelve los roles configurados en auto_email_recipients a emails reales.
 * Los roles son: insured, contractor, beneficiary, contact, adjuster, inspector.
 * Si to_address ya contiene emails (no roles), los pasa directo.
 */
function resolveRecipients(
  recipients: string[],
  data: Record<string, unknown>,
  profilesMap: Map<string, { id: string; full_name: string; email: string; role: string }>,
  claim: Record<string, unknown>
): string[] {
  const emails: string[] = [];
  for (const r of recipients || []) {
    // Si ya es un email, pasarlo directo
    if (r.includes("@")) {
      emails.push(r);
      continue;
    }
    // Mapear rol → email
    switch (r) {
      case "insured":
        if (data.insured_email) emails.push(data.insured_email as string);
        break;
      case "contractor":
        if (data.contractor_email) emails.push(data.contractor_email as string);
        break;
      case "beneficiary":
        if (data.beneficiary_email) emails.push(data.beneficiary_email as string);
        break;
      case "contact":
        if (data.contact_email) emails.push(data.contact_email as string);
        break;
      case "adjuster": {
        const id = claim.adjuster_id as string | undefined;
        const email = id ? profilesMap.get(id)?.email : undefined;
        if (email) emails.push(email);
        break;
      }
      case "inspector": {
        const id = claim.inspector_id as string | undefined;
        const email = id ? profilesMap.get(id)?.email : undefined;
        if (email) emails.push(email);
        break;
      }
      default:
        // Rol desconocido — ignorar
        break;
    }
  }
  // Deduplicar
  return [...new Set(emails.filter(Boolean))];
}
