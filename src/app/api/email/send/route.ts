import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { renderEmailTemplate } from "@/services/email-render";
import { sendEmail } from "@/services/email-sender";

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

    const payload = await request.json();
    const { claimActionId, emailTemplateId, to, cc = [], bcc = [] } = payload as {
      claimActionId: string;
      emailTemplateId: string;
      to: string[];
      cc?: string[];
      bcc?: string[];
    };

    if (!claimActionId || !emailTemplateId || !to?.length) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    // Cargar acción + claim + perfiles asociados
    const { data: action, error: actionError } = await supabase
      .from("claim_actions")
      .select(
        "id, action_data, company_id, claim_id, action_template_id, claim:claims!inner(id, claim_number, liquidation_number, claim_date, claim_address, business_line_id, event_id, adjuster_id, assigned_adjuster_id, inspector_id, dispatcher_id, assistant_id, insurance_company_id, policy_id, owner_same_as_insured, owner_name, owner_email, owner_phone, country_id, region_id, city_id, commune_id, created_at)"
      )
      .eq("id", claimActionId)
      .single();

    if (actionError || !action) {
      return NextResponse.json({ error: "Acción no encontrada" }, { status: 404 });
    }

    const claim = (action as unknown as { claim: Record<string, unknown> }).claim;
    const companyId = action.company_id as string;

    // Validar plantilla
    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("id, company_id, action_template_id, subject, body, placeholder_mapping")
      .eq("id", emailTemplateId)
      .eq("is_active", true)
      .single();

    if (templateError || !template || template.company_id !== companyId || template.action_template_id !== action.action_template_id) {
      return NextResponse.json({ error: "Plantilla no válida" }, { status: 400 });
    }

    // Perfiles asociados al siniestro
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

    // Datos para renderizar placeholders
    const data: Record<string, unknown> = {
      ...claim,
      claim_id: claim.id,
      action_id: action.id,
      action_data: action.action_data,
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

    // Aplanar action_data como top-level keys
    const actionData = (action.action_data || {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(actionData)) {
      if (typeof v !== "object" || v === null) {
        data[k] = v;
      }
    }

    const { subject, body } = renderEmailTemplate(template, data);

    const result = await sendEmail({
      to,
      cc,
      bcc,
      subject,
      body,
    });

    const { data: log, error: logError } = await supabase.from("email_logs").insert({
      company_id: companyId,
      claim_id: claim.id as string,
      claim_action_id: claimActionId,
      email_template_id: emailTemplateId,
      to_address: to,
      cc_address: cc,
      bcc_address: bcc,
      subject,
      body,
      status: result.status,
      provider_response: result.provider_response,
      sent_by: user.id,
    }).select("id").single();

    if (logError) {
      console.error("Error guardando email_logs:", logError.message);
    }

    return NextResponse.json({ success: true, log, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
