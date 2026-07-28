import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/services/email-sender";

// ──────────────────────────────────────────────────────────────
// POST /api/email/resend
// Reenvía un correo previamente registrado en email_logs usando los
// mismos datos (to, cc, subject, body, body_format) del log original.
// Útil para reintentar envíos que fallaron (status = "failed").
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

    const { emailLogId } = (await request.json()) as { emailLogId: string };

    if (!emailLogId) {
      return NextResponse.json({ error: "emailLogId es obligatorio" }, { status: 400 });
    }

    // Cargar el log original
    const { data: logRow, error: logError } = await supabase
      .from("email_logs")
      .select("id, company_id, claim_id, claim_action_id, email_template_id, to_address, cc_address, bcc_address, subject, body, body_format, status, parent_action_code")
      .eq("id", emailLogId)
      .single();

    if (logError || !logRow) {
      console.error("[email/resend] Log no encontrado:", { emailLogId, error: logError?.message });
      return NextResponse.json({ error: "Log no encontrado" }, { status: 404 });
    }

    const log = logRow as {
      id: string;
      company_id: string;
      claim_id: string;
      claim_action_id: string;
      email_template_id: string | null;
      to_address: string[];
      cc_address: string[];
      bcc_address: string[];
      subject: string;
      body: string;
      body_format: "plain" | "html";
      status: string;
      parent_action_code: string | null;
    };

    // Validar formato de emails antes de enviar
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidTo = log.to_address.filter((e) => !EMAIL_RE.test(e));
    const invalidCc = (log.cc_address || []).filter((e) => !EMAIL_RE.test(e));
    if (invalidTo.length || invalidCc.length) {
      const allInvalid = [...invalidTo, ...invalidCc];
      return NextResponse.json(
        {
          error: `Dirección(es) inválida(s) en el log original: ${allInvalid.join(", ")}. Corrige los destinatarios y envía un correo nuevo desde el modal de composición.`,
        },
        { status: 400 }
      );
    }

    // Reenviar con los mismos datos
    const result = await sendEmail({
      to: log.to_address,
      cc: log.cc_address,
      bcc: log.bcc_address,
      subject: log.subject,
      body: log.body,
      html: log.body_format === "html",
    });

    // Si el proveedor rechazó, devolver error con detalle
    if (result.status === "failed") {
      const providerMsg =
        (result.provider_response?.message as string | undefined) ||
        (result.provider_response?.error as string | undefined) ||
        JSON.stringify(result.provider_response);
      console.error("[email/resend] Proveedor rechazó el reenvío:", {
        provider: result.provider,
        provider_response: result.provider_response,
      });
      // Registrar el intento fallido
      await supabase.from("email_logs").insert({
        company_id: log.company_id,
        claim_id: log.claim_id,
        claim_action_id: log.claim_action_id,
        email_template_id: log.email_template_id,
        to_address: log.to_address,
        cc_address: log.cc_address,
        bcc_address: log.bcc_address,
        subject: log.subject,
        body: log.body,
        body_format: log.body_format,
        status: "failed",
        provider_response: result.provider_response,
        sent_by: profileId,
        parent_action_code: log.parent_action_code,
      });
      return NextResponse.json(
        { error: `Proveedor (${result.provider}) rechazó el reenvío: ${providerMsg}` },
        { status: 502 }
      );
    }

    // Registrar el reenvío exitoso como nuevo log
    const { data: newLog, error: insertError } = await supabase.from("email_logs").insert({
      company_id: log.company_id,
      claim_id: log.claim_id,
      claim_action_id: log.claim_action_id,
      email_template_id: log.email_template_id,
      to_address: log.to_address,
      cc_address: log.cc_address,
      bcc_address: log.bcc_address,
      subject: log.subject,
      body: log.body,
      body_format: log.body_format,
      status: result.status,
      provider_response: result.provider_response,
      sent_by: profileId,
      parent_action_code: log.parent_action_code,
    }).select("id, correlativo").single();

    if (insertError) {
      console.error("[email/resend] Error guardando nuevo email_logs:", insertError.message);
    }

    return NextResponse.json({ success: true, log: newLog, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    console.error("[email/resend] Error inesperado:", err);
    return NextResponse.json(
      { error: `Error reenviando e-mail: ${message}` },
      { status: 500 }
    );
  }
}
