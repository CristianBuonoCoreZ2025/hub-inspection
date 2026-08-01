import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { renderEmailTemplate, type EmailBodyFormat } from "@/services/email-render";
import { sendEmail } from "@/services/email-sender";
import { buildDocumentDataForClaim } from "@/services/document-data";
import { buildTemplateData } from "@/lib/document-fields";

// ──────────────────────────────────────────────────────────────
// POST /api/email/send
// Envía un e-mail usando una plantilla vinculada a una claim_action.
// ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Buscar el profile del usuario logueado (email_logs.sent_by FK → profiles.id)
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    const profileId = profileRow?.id ?? null;

    const payload = await request.json();
    const {
      claimActionId,
      emailTemplateId,
      to,
      cc = [],
      // Modo "escrito a mano": el usuario escribe subject y body sin plantilla
      manualSubject,
      manualBody,
      manualBodyFormat = "plain",
    } = payload as {
      claimActionId: string;
      emailTemplateId?: string | null;
      to: string[];
      cc?: string[];
      manualSubject?: string;
      manualBody?: string;
      manualBodyFormat?: "plain" | "html";
    };

    if (!claimActionId || !to?.length) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    // Validar formato de todos los destinatarios (to + cc) antes de enviar al
    // proveedor. Resend/SendGrid rechazan con 422 si un email es inválido, pero
    // su mensaje es genérico. Aquí damos feedback específico al usuario.
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidTo = to.filter((e) => !EMAIL_RE.test(e));
    const invalidCc = (cc || []).filter((e) => !EMAIL_RE.test(e));
    if (invalidTo.length || invalidCc.length) {
      const allInvalid = [...invalidTo, ...invalidCc];
      return NextResponse.json(
        {
          error: `Dirección(es) de correo inválida(s): ${allInvalid.join(", ")}. Usa el formato email@ejemplo.com y separa múltiples destinatarios con coma o punto y coma.`,
        },
        { status: 400 }
      );
    }

    // Modo: plantilla (con emailTemplateId) o escrito a mano (con manualSubject + manualBody)
    const isManual = !emailTemplateId;
    if (isManual && (!manualSubject || !manualBody)) {
      return NextResponse.json(
        { error: "En modo manual se requiere subject y body" },
        { status: 400 }
      );
    }

    // Cargar acción (claim_actions NO tiene company_id — se obtiene del claim)
    const { data: action, error: actionError } = await supabase
      .from("claim_actions")
      .select("id, code, action_data, claim_id, action_template_id")
      .eq("id", claimActionId)
      .single();

    if (actionError || !action) {
      console.error("[email/send] Acción no encontrada:", { claimActionId, error: actionError?.message });
      return NextResponse.json({ error: "Acción no encontrada" }, { status: 404 });
    }

    const actionRow = action as unknown as {
      id: string;
      code: string | null;
      action_data: Record<string, unknown> | null;
      claim_id: string;
      action_template_id: string;
    };

    // Cargar el claim por separado (evita problemas de RLS con !inner join)
    const { data: claimRow, error: claimError } = await supabase
      .from("claims")
      .select("id, company_id, claim_number, liquidation_number, claim_date, claim_address, business_line_id, event_id, adjuster_id, assigned_adjuster_id, inspector_id, dispatcher_id, assistant_id, insurance_company_id, policy_id, owner_same_as_insured, country_id, region_id, city_id, commune_id, created_at")
      .eq("id", actionRow.claim_id)
      .single();

    if (claimError || !claimRow) {
      console.error("[email/send] Claim no encontrado:", { claimId: actionRow.claim_id, error: claimError?.message });
      return NextResponse.json({ error: "Siniestro no encontrado" }, { status: 404 });
    }

    const claim = claimRow as Record<string, unknown> & { company_id: string; id: string };
    const actionCode = actionRow.code || null;
    const companyId = claim.company_id;

    // Validar plantilla (solo si se usa plantilla — no en modo manual)
    type EmailTpl = {
      id: string;
      company_id: string;
      business_line_id: string | null;
      action_template_id: string | null;
      name: string;
      description: string | null;
      body_format: EmailBodyFormat;
      subject: string;
      body: string;
      logo_url: string | null;
      header_color: string | null;
      logo_position: "left" | "center" | "right" | null;
      placeholder_mapping: Record<string, string> | null;
      is_active: boolean;
      actions?: { action_template_id: string; is_default: boolean }[];
    };
    let template: EmailTpl | null = null;

    if (!isManual && emailTemplateId) {
      const { data: tpl, error: templateError } = await supabase
        .from("email_templates")
        .select(
          "id, company_id, business_line_id, action_template_id, name, description, body_format, subject, body, logo_url, header_color, logo_position, placeholder_mapping, is_active, actions:email_template_actions(action_template_id, is_default)"
        )
        .eq("id", emailTemplateId)
        .eq("is_active", true)
        .maybeSingle();

      if (templateError || !tpl) {
        return NextResponse.json({ error: "Plantilla no encontrada o inactiva" }, { status: 404 });
      }
      if (tpl.company_id !== companyId) {
        return NextResponse.json({ error: "Plantilla no pertenece al tenant" }, { status: 403 });
      }
      const linkedActions = (tpl as unknown as {
        actions?: { action_template_id: string; is_default: boolean }[];
      }).actions || [];
      const isLinked = linkedActions.some((a) => a.action_template_id === actionRow.action_template_id);
      if (!isLinked) {
        return NextResponse.json(
          { error: "La plantilla no está vinculada a esta gestión" },
          { status: 400 }
        );
      }
      template = tpl as EmailTpl;
    }

    // ── Construir datos completos del siniestro usando el mismo sistema que
    //    document-data.ts (resuelve TODOS los joins: participantes, perfiles,
    //    catálogos, gestiones, sesión de inspección, etc.) ──
    //    Esto garantiza que TODOS los placeholders del catálogo DOCUMENT_FIELDS
    //    se resuelvan correctamente, sin que falte ninguno.
    const docData = await buildDocumentDataForClaim(actionRow.claim_id, supabase);

    // Cargar la sesión de inspección vinculada a esta gestión específica.
    // Si no existe (gestión sin sesión), buscar la última del siniestro como fallback.
    let sessionQuery = supabase
      .from("inspection_sessions")
      .select("id, magic_link_token, magic_link_expires_at, scheduled_at, created_at, inspection_type, status")
      .eq("claim_id", claim.id as string);
    if (claimActionId) {
      sessionQuery = sessionQuery.eq("claim_action_id", claimActionId);
    }
    const { data: sessions } = await sessionQuery
      .order("created_at", { ascending: false })
      .limit(1);
    let lastSession = sessions?.[0] ?? null;

    // Fallback: si la gestión no tiene sesión vinculada, buscar la última del siniestro
    if (!lastSession) {
      const { data: fallbackSessions } = await supabase
        .from("inspection_sessions")
        .select("id, magic_link_token, magic_link_expires_at, scheduled_at, created_at, inspection_type, status")
        .eq("claim_id", claim.id as string)
        .order("created_at", { ascending: false })
        .limit(1);
      lastSession = fallbackSessions?.[0] ?? null;
    }

    // Construir URL pública del magic link.
    // NEXT_PUBLIC_APP_URL puede no estar seteada en dev/local, así que usamos
    // el origin del request (headers host + x-forwarded-proto) como fallback.
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${request.nextUrl.protocol}//${request.headers.get("x-forwarded-host") || request.headers.get("host") || ""}`;
    const magicLinkUrl = lastSession?.magic_link_token
      ? `${appUrl}/inspection/${lastSession.magic_link_token}`
      : "";

    // Helper para calcular el inicio de la ventana de validez del magic link.
    // La ventana es: [scheduled_at - 1h, magic_link_expires_at].
    // (coincide con la lógica del componente MagicLinkSender).
    const fmtDateTime = (v: string | null | undefined): string => {
      if (!v) return "";
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    };
    const windowStart = lastSession?.scheduled_at
      ? new Date(new Date(lastSession.scheduled_at).getTime() - 60 * 60 * 1000).toISOString()
      : lastSession?.created_at ?? null;

    // Resolver TODOS los campos canónicos del catálogo (claim_number, insured_name,
    // inspector_name, claim_cause, insurance_company, policy_*, etc.) + mapeo manual
    const placeholderMapping = (template as { placeholder_mapping?: Record<string, string> } | null)?.placeholder_mapping || {};
    const templateData = buildTemplateData(docData, placeholderMapping);

    // Datos finales para renderizar:
    // IMPORTANTE: NO hacer spread de `claim` crudo aquí, porque sus campos son
    // objetos (joins como {id, name}) y pisarían los strings resueltos por
    // buildTemplateData (ej: insurance_company pasaría de "Mapfre" a {id,name}).
    // templateData ya contiene todos los campos canónicos resueltos a strings.
    const data: Record<string, unknown> = {
      ...templateData,
      claim_id: claim.id,
      action_id: actionRow.id,
      action_data: actionRow.action_data,
      // Magic link de la última inspección
      magic_link: magicLinkUrl,
      magic_link_valid_from: fmtDateTime(windowStart),
      magic_link_valid_until: fmtDateTime(lastSession?.magic_link_expires_at),
      last_inspection_scheduled_at: fmtDateTime(lastSession?.scheduled_at),
      // <coord_inspection_date> = fecha de la última inspección agendada (formateada)
      coord_inspection_date: fmtDateTime(lastSession?.scheduled_at),
      coord_inspection_datetime: fmtDateTime(lastSession?.scheduled_at),
      // Header color: prioridad de la plantilla, fallback al color de la empresa
      company_header_color: template?.header_color ?? "#0095DA",
    };

    // Aplanar action_data como top-level keys (por si la plantilla usa campos
    // específicos de la gestión, ej: <email_fecha>, <contact_date>)
    const actionData = (actionRow.action_data || {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(actionData)) {
      if (typeof v !== "object" || v === null) {
        data[k] = v;
      }
    }

    // Renderizar: si hay plantilla, renderiza placeholders; si es manual, usa lo que el usuario escribió
    let subject: string;
    let body: string;
    let body_format: "plain" | "html";
    // Versión original de la plantilla (para auditoría)
    let orig_template_subject: string | null = null;
    let orig_template_body: string | null = null;
    let orig_template_body_format: "plain" | "html" | null = null;
    let was_modified = false;

    if (template) {
      const rendered = renderEmailTemplate({
        subject: template.subject,
        body: template.body,
        body_format: template.body_format,
        placeholder_mapping: template.placeholder_mapping ?? undefined,
      }, data);
      orig_template_subject = rendered.subject;
      orig_template_body = rendered.body;
      orig_template_body_format = rendered.body_format;

      // Si el usuario envió manualSubject/manualBody, significa que editó la plantilla
      if (manualSubject !== undefined || manualBody !== undefined) {
        const manualTemplate = {
          subject: manualSubject || rendered.subject,
          body: manualBody || rendered.body,
          body_format: manualBodyFormat || rendered.body_format,
          placeholder_mapping: undefined as Record<string, string> | undefined,
        };
        const renderedManual = renderEmailTemplate(manualTemplate, data);
        subject = renderedManual.subject;
        body = renderedManual.body;
        body_format = renderedManual.body_format;
        was_modified =
          subject !== orig_template_subject ||
          body !== orig_template_body;
      } else {
        subject = rendered.subject;
        body = rendered.body;
        body_format = rendered.body_format;
      }
    } else {
      // Modo manual puro (sin plantilla)
      const manualTemplate = {
        subject: manualSubject || "",
        body: manualBody || "",
        body_format: manualBodyFormat,
        placeholder_mapping: undefined as Record<string, string> | undefined,
      };
      const rendered = renderEmailTemplate(manualTemplate, data);
      subject = rendered.subject;
      body = rendered.body;
      body_format = rendered.body_format;
    }

    // Si la plantilla es HTML, envolver en estructura de email completa
    // Usa header_color, logo_url y logo_position de la PLANTILLA (configurados
    // en el editor de plantillas), no de la empresa.
    const { wrapHtmlEmail } = await import("@/services/email-render");
    const finalBody =
      body_format === "html"
        ? wrapHtmlEmail({
            body,
            logoUrl: template?.logo_url ?? (data.company_logo as string) ?? null,
            headerColor: template?.header_color ?? null,
            companyName: data.company_name as string,
            logoPosition: template?.logo_position ?? "center",
          })
        : body;

    const result = await sendEmail({
      to,
      cc,
      subject,
      body: finalBody,
      html: body_format === "html",
    });

    // Si el proveedor rechazó el envío, devolver error con detalle para que
    // el usuario vea la causa real (ej: dominio no verificado, API key inválida,
    // destinatario inválido). Antes esto se silenciaba y el toast decía "enviado".
    if (result.status === "failed") {
      const providerMsg =
        (result.provider_response?.message as string | undefined) ||
        (result.provider_response?.error as string | undefined) ||
        JSON.stringify(result.provider_response);
      console.error("[email/send] Proveedor rechazó el envío:", {
        provider: result.provider,
        provider_response: result.provider_response,
        to,
        from: process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL,
      });
      // Igual registramos el intento fallido en email_logs para auditoría
      await supabase.from("email_logs").insert({
        company_id: companyId,
        claim_id: claim.id as string,
        claim_action_id: claimActionId,
        email_template_id: emailTemplateId ?? null,
        to_address: to,
        cc_address: cc,
        subject,
        body: finalBody,
        body_format,
        status: "failed",
        provider_response: result.provider_response,
        sent_by: profileId,
        parent_action_code: actionCode,
        template_subject: orig_template_subject,
        template_body: orig_template_body,
        template_body_format: orig_template_body_format,
        was_modified: was_modified,
      }).select("id, correlativo").single();
      return NextResponse.json(
        { error: `Proveedor (${result.provider}) rechazó el envío: ${providerMsg}` },
        { status: 502 }
      );
    }

    const { data: log, error: logError } = await supabase.from("email_logs").insert({
      company_id: companyId,
      claim_id: claim.id as string,
      claim_action_id: claimActionId,
      email_template_id: emailTemplateId ?? null,
      to_address: to,
      cc_address: cc,
      subject,
      body: finalBody,
      body_format,
      status: result.status,
      provider_response: result.provider_response,
      sent_by: profileId,
      parent_action_code: actionCode,
      // Auditoría de plantilla: versión original vs final
      template_subject: orig_template_subject,
      template_body: orig_template_body,
      template_body_format: orig_template_body_format,
      was_modified: was_modified,
    }).select("id, correlativo").single();

    if (logError) {
      console.error("Error guardando email_logs:", logError.message);
    }

    return NextResponse.json({ success: true, log, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    console.error("[email/send] Error inesperado:", err);
    return NextResponse.json(
      { error: `Error enviando e-mail: ${message}` },
      { status: 500 }
    );
  }
}
