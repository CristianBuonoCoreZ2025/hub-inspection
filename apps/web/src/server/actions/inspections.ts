"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { calculateMaxDate } from "@/lib/utils";

/**
 * Server Action: Obtiene la fecha máxima permitida para reagendar/mover
 * una inspección.
 *
 * Calcula: fecha_creacion_claim + days_to_issue del CIN template (días hábiles).
 * Usa admin client (service role) para bypass RLS y poder leer:
 *   - claims.created_at
 *   - claim_actions (incluyendo rechazadas) para encontrar el template CIN
 *   - action_template.days_to_issue
 *
 * @param claimId — ID del siniestro
 * @returns { maxDate: "yyyy-MM-dd", maxDays: number, claimCreatedAt: string }
 */
export async function getInspectionMaxDate(claimId: string): Promise<{
  maxDate: string;
  maxDays: number;
  claimCreatedAt: string;
}> {
  const admin = createAdminClient();

  // 1. Obtener fecha de creación del claim
  const { data: claim, error: claimErr } = await admin
    .from("claims")
    .select("created_at")
    .eq("id", claimId)
    .maybeSingle();
  if (claimErr) throw new Error(claimErr.message);
  const claimCreatedAt = claim?.created_at ?? new Date().toISOString();

  // 2. Buscar el template CIN del claim:
  //    Primero buscar en claim_actions existentes (incluyendo rechazadas)
  //    para obtener el action_template_id del CIN que se usó.
  const { data: cinActions, error: cinErr } = await admin
    .from("claim_actions")
    .select("action_template_id, action_template:action_template(code, days_to_issue)")
    .eq("claim_id", claimId)
    .order("created_on", { ascending: false })
    .limit(100);

  if (cinErr) throw new Error(cinErr.message);

  // Encontrar la última gestión CIN (con su template)
  let maxDays = 2; // fallback
  const cinRow = (cinActions || []).find(
    (a) => {
      const tpl = a.action_template as unknown as { code: string } | null;
      return tpl?.code === "CIN";
    }
  );
  if (cinRow?.action_template) {
    const tpl = cinRow.action_template as unknown as { code: string; days_to_issue: number | null };
    maxDays = tpl.days_to_issue ?? 2;
  } else {
    // Fallback: buscar el template CIN activo por la línea de negocio del claim
    const { data: claim2 } = await admin
      .from("claims")
      .select("business_line_id")
      .eq("id", claimId)
      .maybeSingle();

    const businessLineId = claim2?.business_line_id;
    if (businessLineId) {
      const { data: tpl } = await admin
        .from("action_template")
        .select("days_to_issue")
        .eq("code", "CIN")
        .eq("is_active", true)
        .eq("line_business_id", businessLineId)
        .maybeSingle();
      if (tpl?.days_to_issue != null) {
        maxDays = tpl.days_to_issue;
      }
    }
  }

  // 3. Calcular fecha máxima = claim.created_at + maxDays (días hábiles)
  const max = calculateMaxDate(claimCreatedAt, maxDays);
  return {
    maxDate: max.toISOString().split("T")[0],
    maxDays,
    claimCreatedAt,
  };
}
