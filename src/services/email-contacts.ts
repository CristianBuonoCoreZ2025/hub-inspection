"use server";

import { getSupabaseClient } from "@/lib/supabase/db";

/**
 * Contacto de la libreta de direcciones del email.
 * Unificado: puede venir de participants, profiles, advisors, o directorio global.
 */
export interface EmailContact {
  email: string;
  fullName: string | null;
  /** Grupo al que pertenece (para seccionar la libreta) */
  group: "participants" | "team" | "advisor" | "global";
  /** Roles/etiquetas que tiene este contacto (ej: "Asegurado", "Liquidador") */
  roles: string[];
  /** Si es un usuario interno del sistema (profile) */
  isInternal: boolean;
}

/**
 * Obtiene la libreta de contactos completa para un siniestro.
 *
 * Fuentes (en orden de relevancia):
 *  1. Participantes del siniestro (claims_participants)
 *  2. Equipo del siniestro (claims.*_id → profiles)
 *  3. Asesor (claims.advisor_id → advisors)
 *  4. Directorio global (profiles) — todos los usuarios del sistema
 *
 * Deduplica por email: si el Asegurado y el Beneficiario comparten email,
 * se muestra un solo contacto con ambos roles combinados.
 */
export async function getClaimContacts(claimId: string): Promise<EmailContact[]> {
  const supabase = getSupabaseClient();

  // ─── 1. Cargar el claim con sus FKs de equipo ───
  const { data: claim } = await supabase
    .from("claims")
    .select(`
      owner_email,
      assigned_adjuster_id,
      inspector_id,
      adjuster_id,
      auditor_id,
      dispatcher_id,
      assistant_id,
      advisor_id
    `)
    .eq("id", claimId)
    .single();

  // Mapa de email → EmailContact (para deduplicar)
  const byEmail = new Map<string, EmailContact>();

  const addContact = (
    email: string,
    fullName: string | null,
    group: EmailContact["group"],
    role: string,
    isInternal = false
  ) => {
    const key = email.toLowerCase().trim();
    if (!key) return;
    const existing = byEmail.get(key);
    if (existing) {
      if (!existing.roles.includes(role)) {
        existing.roles.push(role);
      }
      // Priorizar el grupo más específico (participants > team > advisor > global)
      const priority: Record<EmailContact["group"], number> = { participants: 1, team: 2, advisor: 3, global: 4 };
      if (priority[group] < priority[existing.group]) {
        existing.group = group;
      }
      // Si alguno es interno, marcar como interno
      if (isInternal) existing.isInternal = true;
      // Si alguno tiene nombre, usarlo
      if (fullName && !existing.fullName) existing.fullName = fullName;
    } else {
      byEmail.set(key, {
        email,
        fullName,
        group,
        roles: [role],
        isInternal,
      });
    }
  };

  // ─── 2. Owner email (propietario del bien) ───
  if (claim?.owner_email) {
    addContact(claim.owner_email, null, "participants", "Propietario");
  }

  // ─── 3. Equipo del siniestro (profiles) ───
  const teamFieldMap: Array<{ field: keyof typeof claim; role: string }> = [
    { field: "adjuster_id", role: "Liquidador" },
    { field: "assigned_adjuster_id", role: "Liq. Asignado" },
    { field: "inspector_id", role: "Inspector" },
    { field: "auditor_id", role: "Auditor" },
    { field: "dispatcher_id", role: "Despachador" },
    { field: "assistant_id", role: "Asistente" },
  ];

  const teamProfileIds = teamFieldMap
    .map(({ field }) => claim?.[field] as string | null)
    .filter(Boolean) as string[];

  if (teamProfileIds.length > 0) {
    const { data: teamProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", teamProfileIds);

    const profMap = new Map<string, { full_name: string; email: string }>(
      (teamProfiles || []).map((p: { id: string; full_name: string; email: string }) => [p.id, p])
    );

    for (const { field, role } of teamFieldMap) {
      const profileId = claim?.[field] as string | null;
      if (!profileId) continue;
      const p = profMap.get(profileId);
      if (p?.email) {
        addContact(p.email, p.full_name, "team", role, true);
      }
    }
  }

  // ─── 4. Asesor (advisors) ───
  if (claim?.advisor_id) {
    const { data: advisor } = await supabase
      .from("advisors")
      .select("name, email")
      .eq("id", claim.advisor_id)
      .single();
    if (advisor?.email) {
      addContact(advisor.email, advisor.name, "advisor", "Asesor");
    }
  }

  // ─── 5. Participantes del siniestro (claims_participants) ───
  const { data: participants } = await supabase
    .from("claims_participants")
    .select("id, type, full_name, email")
    .eq("claim_id", claimId)
    .eq("is_active", true);

  const typeLabel: Record<string, string> = {
    insured: "Asegurado",
    contractor: "Contratista",
    beneficiary: "Beneficiario",
    executive: "Ejecutivo",
    contact: "Contacto",
  };

  for (const p of participants || []) {
    if (!p.email) continue;
    addContact(p.email, p.full_name, "participants", typeLabel[p.type] || p.type);
  }

  // ─── 6. Directorio global (todos los profiles) ───
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .neq("email", "")
    .order("full_name", { ascending: true });

  for (const p of allProfiles || []) {
    if (!p.email) continue;
    addContact(p.email, p.full_name, "global", "Usuario", true);
  }

  // ─── 7. Ordenar: por grupo, luego por nombre ───
  const groupOrder: Record<EmailContact["group"], number> = {
    participants: 1,
    team: 2,
    advisor: 3,
    global: 4,
  };

  return Array.from(byEmail.values()).sort((a, b) => {
    if (groupOrder[a.group] !== groupOrder[b.group]) {
      return groupOrder[a.group] - groupOrder[b.group];
    }
    return (a.fullName || a.email).localeCompare(b.fullName || b.email);
  });
}

/**
 * Wrapper para componentes "use client" que necesitan la libreta de contactos.
 *
 * Como este archivo tiene "use server", esta función se ejecuta como Server Action
 * (en el servidor). Por eso NO puede hacer fetch a una API route con URL relativa
 * (falla con ERR_INVALID_URL en SSR). En su lugar, llama directamente a
 * getClaimContacts que está en el mismo archivo y ya tiene acceso a Supabase.
 */
export async function fetchClaimContacts(claimId: string): Promise<EmailContact[]> {
  return getClaimContacts(claimId);
}
