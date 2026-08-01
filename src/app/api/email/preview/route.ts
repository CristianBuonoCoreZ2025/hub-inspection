import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { buildDocumentDataForClaim } from "@/services/document-data";
import { buildTemplateData } from "@/lib/document-fields";
import { renderEmailTemplate } from "@/services/email-render";

// ──────────────────────────────────────────────────────────────
// POST /api/email/preview
// Devuelve subject y body renderizados con los datos reales del siniestro,
// para mostrar el preview en el EmailComposeModal del frontend.
// El frontend no puede llamar a buildDocumentDataForClaim (server-only),
// así que este endpoint hace el render y devuelve el resultado.
// ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { claimActionId, emailTemplateId, manualSubject, manualBody, manualBodyFormat } =
      await request.json() as {
        claimActionId: string;
        emailTemplateId?: string | null;
        manualSubject?: string;
        manualBody?: string;
        manualBodyFormat?: "plain" | "html";
      };

    if (!claimActionId) {
      return NextResponse.json({ error: "Falta claimActionId" }, { status: 400 });
    }

    // 1. Obtener la claim_action (query simple sin joins, igual que el send route)
    const { data: actionRow, error: actionError } = await supabase
      .from("claim_actions")
      .select("id, code, action_data, claim_id, action_template_id")
      .eq("id", claimActionId)
      .maybeSingle();

    if (actionError || !actionRow) {
      return NextResponse.json({ error: "Gestión no encontrada" }, { status: 404 });
    }

    // 2. Construir datos completos del siniestro (mismo sistema que el envío real)
    const docData = await buildDocumentDataForClaim(actionRow.claim_id, supabase, claimActionId);

    // 3. La sesión de inspección vinculada a esta gestión ya viene en docData.last_inspection_session
    const lastSession = docData.last_inspection_session;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${request.nextUrl.protocol}//${request.headers.get("x-forwarded-host") || request.headers.get("host") || ""}`;
    const magicLinkUrl = lastSession?.magic_link_token
      ? `${appUrl}/inspection/${lastSession.magic_link_token}`
      : "";

    const fmtDateTime = (v: string | null | undefined): string => {
      if (!v) return "";
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    };
    // Ventana de validez: [scheduled_at - 1h, magic_link_expires_at]
    const windowStart = lastSession?.scheduled_at
      ? new Date(new Date(lastSession.scheduled_at).getTime() - 60 * 60 * 1000).toISOString()
      : lastSession?.created_at ?? null;

    // 4. Resolver todos los campos canónicos
    let templateMapping: Record<string, string> = {};
    let template: { subject: string; body: string; body_format?: "plain" | "html"; placeholder_mapping?: Record<string, string> } | null = null;

    if (emailTemplateId) {
      const { data: tpl } = await supabase
        .from("email_templates")
        .select("subject, body, body_format, placeholder_mapping")
        .eq("id", emailTemplateId)
        .maybeSingle();
      if (tpl) {
        template = tpl as typeof template & object;
        templateMapping = (tpl as { placeholder_mapping?: Record<string, string> }).placeholder_mapping || {};
      }
    }

    const templateData = buildTemplateData(docData, templateMapping);

    const data: Record<string, unknown> = {
      ...templateData,
      claim_id: actionRow.claim_id,
      action_id: actionRow.id,
      action_data: actionRow.action_data,
      magic_link: magicLinkUrl,
      magic_link_valid_from: fmtDateTime(windowStart),
      magic_link_valid_until: fmtDateTime(lastSession?.magic_link_expires_at),
      last_inspection_scheduled_at: fmtDateTime(lastSession?.scheduled_at),
    };

    // Aplanar action_data
    const actionData = (actionRow.action_data || {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(actionData)) {
      if (typeof v !== "object" || v === null) {
        data[k] = v;
      }
    }

    // 5. Renderizar
    let subject: string;
    let body: string;
    let body_format: "plain" | "html";

    if (template) {
      const rendered = renderEmailTemplate(template, data);
      subject = rendered.subject;
      body = rendered.body;
      body_format = rendered.body_format;
    } else {
      // Modo manual: renderizar placeholders en lo que el usuario escribió
      const manualTemplate = {
        subject: manualSubject || "",
        body: manualBody || "",
        body_format: manualBodyFormat || "plain",
      };
      const rendered = renderEmailTemplate(manualTemplate, data);
      subject = rendered.subject;
      body = rendered.body;
      body_format = rendered.body_format;
    }

    return NextResponse.json({ subject, body, body_format });
  } catch (err) {
    console.error("[email-preview] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
