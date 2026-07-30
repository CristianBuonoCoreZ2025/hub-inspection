"use server";

import { createServerClient } from "@/lib/supabase/server";

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
 * Extrae el apellido de un nombre completo.
 * Asume formato "Nombre Apellido" o "Nombre Apellido1 Apellido2".
 * Toma la última palabra como apellido para ordenar.
 */
function lastName(fullName: string | null): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Obtiene la libreta de contactos completa para un siniestro.
 *
 * Fuentes y orden:
 *  1. Participantes (Asegurado → Contratante → Beneficiario → Contacto)
 *  2. Equipo (Inspector → Liquidador → Auditor → Despacho → Asistente)
 *  3. Asesor
 *  4. Directorio global (profiles, excluyendo los que ya están en equipo)
 *     Ordenado por apellido.
 *
 * Deduplica por email: si el Asegurado y el Beneficiario comparten email,
 * se muestra un solo contacto con ambos roles combinados.
 */
export async function getClaimContacts(claimId: string): Promise<EmailContact[]> {
  const supabase = await createServerClient();

  // ─── 1. Cargar el claim con sus FKs de equipo ───
  const { data: claim, error: claimErr } = await supabase
    .from("claims")
    .select(`
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

  if (claimErr) console.error("[email-contacts] Error cargando claim:", claimErr);

  const claimRow = claim as Record<string, unknown> | null;

  // Mapa de email → EmailContact (para deduplicar)
  const byEmail = new Map<string, EmailContact>();
  // Set de profile IDs que ya están en el equipo (para excluirlos del directorio)
  const teamProfileIds = new Set<string>();

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
      if (isInternal) existing.isInternal = true;
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

  // ─── 2. Participantes del siniestro (claims_participants) ───
  // Orden: Asegurado → Contratante → Beneficiario → Contacto
  const { data: participants, error: partErr } = await supabase
    .from("claims_participants")
    .select("id, type, full_name, email")
    .eq("claim_id", claimId)
    .eq("is_active", true);

  if (partErr) console.error("[email-contacts] Error cargando participants:", partErr);

  const participantOrder: Record<string, number> = {
    insured: 1,
    contractor: 2,
    beneficiary: 3,
    contact: 4,
    executive: 5,
  };

  const typeLabel: Record<string, string> = {
    insured: "Asegurado",
    contractor: "Contratante",
    beneficiary: "Beneficiario",
    executive: "Ejecutivo",
    contact: "Contacto",
  };

  const sortedParticipants = (participants || []).slice().sort((a, b) => {
    const oa = participantOrder[a.type] ?? 99;
    const ob = participantOrder[b.type] ?? 99;
    return oa - ob;
  });

  for (const p of sortedParticipants) {
    if (!p.email) continue;
    addContact(p.email, p.full_name, "participants", typeLabel[p.type] || p.type);
  }

  // ─── 3. Equipo del siniestro (profiles) ───
  // Orden: Inspector → Liquidador → Auditor → Despacho → Asistente
  const teamFieldMap: Array<{ field: string; role: string }> = [
    { field: "inspector_id", role: "Inspector" },
    { field: "adjuster_id", role: "Liquidador" },
    { field: "assigned_adjuster_id", role: "Liq. Asignado" },
    { field: "auditor_id", role: "Auditor" },
    { field: "dispatcher_id", role: "Despacho" },
    { field: "assistant_id", role: "Asistente" },
  ];

  const teamIds = teamFieldMap
    .map(({ field }) => (claimRow?.[field] as string | null) ?? null)
    .filter(Boolean) as string[];

  for (const id of teamIds) teamProfileIds.add(id);

  if (teamIds.length > 0) {
    const { data: teamProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", teamIds);

    const profMap = new Map<string, { full_name: string; email: string }>(
      (teamProfiles || []).map((p: { id: string; full_name: string; email: string }) => [p.id, p])
    );

    for (const { field, role } of teamFieldMap) {
      const profileId = (claimRow?.[field] as string | null) ?? null;
      if (!profileId) continue;
      const p = profMap.get(profileId);
      if (p?.email) {
        addContact(p.email, p.full_name, "team", role, true);
      }
    }
  }

  // ─── 4. Asesor (advisors) ───
  const advisorId = (claimRow?.advisor_id as string | null) ?? null;
  if (advisorId) {
    const { data: advisor } = await supabase
      .from("advisors")
      .select("name, email")
      .eq("id", advisorId)
      .single();
    if (advisor?.email) {
      addContact(advisor.email, advisor.name, "advisor", "Asesor");
    }
  }

  // ─── 5. Directorio global (todos los profiles, excluyendo los del equipo) ───
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .neq("email", "");

  // Emails ya incluidos en participantes/equipo/asesor — no duplicar en directorio
  const existingEmails = new Set(byEmail.keys());

  const dirContacts: EmailContact[] = [];
  for (const p of allProfiles || []) {
    if (!p.email) continue;
    const key = p.email.toLowerCase().trim();
    // Si ya está en participantes, equipo o asesor, no lo agregamos al directorio
    if (existingEmails.has(key)) continue;
    // Si es un profile del equipo, tampoco lo agregamos
    if (teamProfileIds.has(p.id)) continue;
    dirContacts.push({
      email: p.email,
      fullName: p.full_name,
      group: "global",
      roles: ["Usuario"],
      isInternal: true,
    });
  }

  // Ordenar directorio por apellido
  dirContacts.sort((a, b) => {
    const la = lastName(a.fullName);
    const lb = lastName(b.fullName);
    if (la !== lb) return la.localeCompare(lb);
    return (a.fullName || a.email).localeCompare(b.fullName || b.email);
  });

  for (const c of dirContacts) {
    byEmail.set(c.email.toLowerCase().trim(), c);
  }

  // ─── 6. Ordenar resultado final por grupo, luego por orden interno ───
  const groupOrder: Record<EmailContact["group"], number> = {
    participants: 1,
    team: 2,
    advisor: 3,
    global: 4,
  };

  // Orden dentro de participantes: por orden de roles
  const roleOrderParticipants: Record<string, number> = {
    Asegurado: 1,
    Contratante: 2,
    Beneficiario: 3,
    Contacto: 4,
    Ejecutivo: 5,
  };

  // Orden dentro de equipo: por orden de roles
  const roleOrderTeam: Record<string, number> = {
    Inspector: 1,
    Liquidador: 2,
    "Liq. Asignado": 3,
    Auditor: 4,
    Despacho: 5,
    Asistente: 6,
  };

  const result = Array.from(byEmail.values()).sort((a, b) => {
    if (groupOrder[a.group] !== groupOrder[b.group]) {
      return groupOrder[a.group] - groupOrder[b.group];
    }
    // Dentro de participantes: ordenar por el primer rol
    if (a.group === "participants" && b.group === "participants") {
      const ra = roleOrderParticipants[a.roles[0]] ?? 99;
      const rb = roleOrderParticipants[b.roles[0]] ?? 99;
      return ra - rb;
    }
    // Dentro de equipo: ordenar por el primer rol
    if (a.group === "team" && b.group === "team") {
      const ra = roleOrderTeam[a.roles[0]] ?? 99;
      const rb = roleOrderTeam[b.roles[0]] ?? 99;
      return ra - rb;
    }
    // Dentro de directorio: ordenar por apellido
    if (a.group === "global" && b.group === "global") {
      const la = lastName(a.fullName);
      const lb = lastName(b.fullName);
      if (la !== lb) return la.localeCompare(lb);
      return (a.fullName || a.email).localeCompare(b.fullName || b.email);
    }
    return (a.fullName || a.email).localeCompare(b.fullName || b.email);
  });

  return result;
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
