import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { presignEvidenceUrls, presignSignatureUrls, presignSketchUrls } from "@/lib/supabase/storage-presigned";
import { logger } from "@/lib/logger";

/**
 * API route pública (sin auth) que devuelve la sesión de inspección en vivo
 * para la página del magic link `/inspection/[token]`.
 *
 * Usa service role key server-side para leer los datos sin requerir auth.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ session: null }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: sessions, error } = await supabase
      .from("inspection_sessions")
      .select(`
        id, claim_id, status, inspection_type, scheduled_at, started_at, ended_at,
        magic_link_token, magic_link_expires_at, created_at,
        inspection_date, inspection_time,
        interviewed_name, interviewed_email, interviewed_relationship,
        police_report_number, police_report_name, police_report_rut,
        firefighters_company, other_insurances, other_insurance_company,
        active_tab, acta_step,
        inspector_observations,
        geo_latitude, geo_longitude, geo_captured_at, geo_captured_by, geo_distance_meters, geo_status, geo_map_url, geo_recapture_enabled,
        property_risk, property_materiality, security_measures,
        insured_statement, third_parties,
        action_template:action_template!inspection_sessions_action_template_id_fkey ( code ),
        claim_action:claim_actions!inspection_sessions_claim_action_id_fkey ( code ),
        inspection_evidences:inspection_evidences!inspection_evidences_session_id_fkey ( id, url, type, description, category, created_at ),
        inspection_notes:inspection_notes!inspection_notes_session_id_fkey ( id, content, created_at ),
        inspection_checklists:inspection_checklists!inspection_checklists_session_id_fkey ( id, area, item, status, notes, created_at ),
        inspection_damages:inspection_damages!inspection_damages_session_id_fkey ( id, category, subcategory, description, observations, severity,
          dependency, sector, materiality_type, unit, quantity, damage_type,
          product, brand_model, purchase_date, estimated_amount, created_at ),
        inspection_chat_messages:inspection_chat_messages!inspection_chat_messages_session_id_fkey ( id, content, sender_name, sender_role, created_at ),
        inspection_signatures:inspection_signatures!inspection_signatures_session_id_fkey ( id, role, signature_url, signed_at ),
        damage_sketches:damage_sketches!damage_sketches_session_id_fkey ( id, sketch_url, label, created_at ),
        claim:claims!inspection_sessions_claim_id_fkey (
          claim_number, client_reference, claim_address, policy_number, claim_date,
          liquidation_number, claim_latitude, claim_longitude,
          claims_participants:claims_participants!claim_participants_claim_id_fkey ( type, full_name, email, phone, cell_phone ),
          insurance_company:insurance_companies!claims_insurance_company_id_fkey ( name )
        )
      `)
      .eq("magic_link_token", token)
      .limit(1);

    if (error) throw new Error(error.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = sessions?.[0] as any;
    if (!session) {
      console.log("[inspection/live] token no encontrado:", token);
      return NextResponse.json({ session: null });
    }

    // Supabase returns nested relations as arrays; unwrap single-item relations
    if (Array.isArray(session.claim)) {
      session.claim = session.claim[0] ?? null;
    }
    if (session.claim && Array.isArray(session.claim.insurance_company)) {
      session.claim.insurance_company = session.claim.insurance_company[0] ?? null;
    }
    if (session.action_template && Array.isArray(session.action_template)) {
      session.action_template = session.action_template[0] ?? null;
    }

    // Filtrar claims_participants por tipo
    if (session.claim?.claims_participants) {
      session.claim.claims_participants = session.claim.claims_participants.filter(
        (p: { type: string }) => p.type === "insured" || p.type === "contact"
      );
    }

    // Log diagnóstico
    const counts = {
      id: session.id,
      status: session.status,
      evidences: session.inspection_evidences?.length ?? -1,
      notes: session.inspection_notes?.length ?? -1,
      checklists: session.inspection_checklists?.length ?? -1,
      damages: session.inspection_damages?.length ?? -1,
      chat: session.inspection_chat_messages?.length ?? -1,
    };
    console.log("[inspection/live] counts:", counts);

    // Usar el code del claim_action como inspection_number (estándar de gestiones)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((session as any).claim_action?.code) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).inspection_number = (session as any).claim_action.code;
    }

    // Convertir URLs a signed URLs
    if (session.inspection_evidences?.length) {
      await presignEvidenceUrls(session.inspection_evidences);
    }
    if (session.inspection_signatures?.length) {
      await presignSignatureUrls(session.inspection_signatures);
    }
    if (session.damage_sketches?.length) {
      await presignSketchUrls(session.damage_sketches);
    }

    return NextResponse.json({ session });
  } catch (err) {
    const error = err as Error;
    logger.error("API /api/inspection/live error", error, {
      component: "inspection-live-route",
      action: "get.live-session",
    });
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        session: null,
        error: "No se pudo cargar la inspección",
        detail: isDev ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH — Actualizar campos permitidos de la sesión desde el magic link (cliente):
 * - geo_* (geolocalización)
 * - insured_statement (declaración del asegurado)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const body = await request.json();
    const allowedFields = [
      "geo_latitude", "geo_longitude", "geo_captured_at",
      "geo_distance_meters", "geo_status", "geo_map_url",
    ];
    const update: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        update[field] = body[field];
      }
    }
    // Cada nueva captura consume la autorización de recaptura
    if (Object.keys(update).some((k) => k.startsWith("geo_"))) {
      update.geo_recapture_enabled = false;
    }

    const supabase = createAdminClient();

    // declaración del asegurado: merge con el objeto existente
    if (body.insured_statement !== undefined && typeof body.insured_statement === "object") {
      const { data: existing } = await supabase
        .from("inspection_sessions")
        .select("insured_statement")
        .eq("magic_link_token", token)
        .single();
      update.insured_statement = {
        ...(existing?.insured_statement || {}),
        ...body.insured_statement,
      };
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const { error } = await supabase
      .from("inspection_sessions")
      .update(update)
      .eq("magic_link_token", token);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    const error = err as Error;
    logger.error("API /api/inspection/live PATCH error", error, {
      component: "inspection-live-route",
      action: "patch.geo",
    });
    return NextResponse.json(
      { error: "No se pudo guardar la información" },
      { status: 500 }
    );
  }
}
