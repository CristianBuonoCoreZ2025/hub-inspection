import "server-only";

import { fetchById, fetchAll } from "@/lib/supabase/db";
import type { DocumentData, ParticipantData, UserData, CatalogRef, ActionSummary } from "@/lib/document-fields";

/**
 * Obtiene los datos completos de un siniestro con todos los joins resueltos
 * a strings, listos para alimentar el render de plantillas .docx.
 *
 * Esta query es más anidada que getClaimById porque necesitamos los NOMBRES
 * de las FKs (compañía, tipo, evento, etc.), los lookup_catalog (construcción,
 * habitabilidad, etc.) y los datos de TODOS los participantes.
 */

interface ClaimData {
  id: string;
  claim_number: string;
  internal_number: string | null;
  client_reference: string | null;
  company_report_number: string | null;
  liquidation_number: string | null;
  is_special_claim: boolean | null;
  claim_date: string;
  report_date: string | null;
  assignment_date: string | null;
  summary: string | null;
  notes: string | null;
  claim_address: string | null;
  owner_same_as_insured: boolean | null;
  policy_number: string;
  policy_item: string | null;
  policy_amount: number | null;
  policy_premium: number | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  recovery_type_legal: boolean | null;
  recovery_type_material: boolean | null;
  recovery_comments: string | null;
  broker_executive: string | null;
  created_at: string;
  company: CatalogRef | null;
  insurance_company: CatalogRef | null;
  broker: CatalogRef | null;
  advisor: CatalogRef | null;
  claim_type: CatalogRef | null;
  business_line: CatalogRef | null;
  insurance_product: CatalogRef | null;
  claim_cause: CatalogRef | null;
  event: CatalogRef | null;
  type: CatalogRef | null;
  construction_type: CatalogRef | null;
  destination_housing: CatalogRef | null;
  damage_classification: CatalogRef | null;
  habitability: CatalogRef | null;
  service_type: CatalogRef | null;
  billing_type: CatalogRef | null;
  country: CatalogRef | null;
  region: CatalogRef | null;
  city: CatalogRef | null;
  commune: CatalogRef | null;
  status: (CatalogRef & { code: string }) | null;
  currency: (CatalogRef & { code: string; symbol: string | null; decimals: number | null }) | null;
  adjuster: { id: string; full_name: string; email: string | null } | null;
  inspector: { id: string; full_name: string; email: string | null } | null;
  auditor: { id: string; full_name: string; email: string | null } | null;
  dispatcher: { id: string; full_name: string; email: string | null } | null;
  assistant: { id: string; full_name: string; email: string | null } | null;
}

const CLAIM_SELECT =
  "id, claim_number, internal_number, client_reference, company_report_number, liquidation_number, is_special_claim, claim_date, report_date, assignment_date, summary, notes, claim_address, owner_same_as_insured, policy_number, policy_item, policy_amount, policy_premium, policy_start_date, policy_end_date, recovery_type_legal, recovery_type_material, recovery_comments, broker_executive, created_at, company:companies!claims_company_id_fkey(id, name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(id, name), broker:brokers!claims_broker_id_fkey(id, name), advisor:advisors!claims_advisor_id_fkey(id, name), claim_type:claim_types!claims_claim_type_id_fkey(id, name), business_line:business_lines!claims_business_line_id_fkey(id, name), insurance_product:insurance_products!claims_insurance_product_id_fkey(id, name), claim_cause:claim_causes!claims_claim_cause_id_fkey(id, name), event:events!claims_event_id_fkey(id, name), type:lookup_catalog!claims_type_id_fkey(id, name), construction_type:lookup_catalog!claims_construction_type_id_fkey(id, name), destination_housing:housing_destinations!claims_destination_housing_id_fkey(id, name), damage_classification:damage_classifications!claims_damage_classification_id_fkey(id, name), habitability:lookup_catalog!claims_habitability_id_fkey(id, name), service_type:lookup_catalog!claims_service_type_id_fkey(id, name), billing_type:lookup_catalog!claims_billing_type_id_fkey(id, name), country:countries!claims_country_id_fkey(id, name), region:regions!claims_region_id_fkey(id, name), city:cities!claims_city_id_fkey(id, name), commune:communes!claims_commune_id_fkey(id, name), status:lookup_catalog!claims_status_id_fkey(id, name, code), currency:currencies!claims_currency_id_fkey(id, name, code, symbol, decimals), adjuster_user:profiles!claims_adjuster_id_fkey(id, full_name, email), inspector_user:profiles!claims_inspector_id_fkey(id, full_name, email), auditor_user:profiles!claims_auditor_id_fkey(id, full_name, email), dispatcher_user:profiles!claims_dispatcher_id_fkey(id, full_name, email), assistant_user:profiles!claims_assistant_id_fkey(id, full_name, email)";

interface RawParticipant {
  type: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  rut: string | null;
  email: string | null;
  phone: string | null;
  cell_phone: string | null;
  address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  commune: string | null;
  notes: string | null;
}

interface RawAction {
  id: string;
  code: string;
  issued_on: string | null;
  action_data: Record<string, unknown> | null;
  action_template: { code: string } | null;
}

/** Mapea un participante crudo a ParticipantData */
function toParticipant(p: RawParticipant): ParticipantData {
  return {
    full_name: p.full_name ?? undefined,
    first_name: p.first_name ?? undefined,
    last_name: p.last_name ?? undefined,
    rut: p.rut ?? undefined,
    email: p.email ?? undefined,
    phone: p.phone ?? undefined,
    cell_phone: p.cell_phone ?? undefined,
    address: p.address ?? undefined,
    country: p.country ?? undefined,
    region: p.region ?? undefined,
    city: p.city ?? undefined,
    commune: p.commune ?? undefined,
    notes: p.notes ?? undefined,
  };
}

/** Mapea un usuario asignado crudo a UserData */
function toUser(u: { id: string; full_name: string; email: string | null } | null): UserData | null {
  if (!u) return null;
  return { full_name: u.full_name, display_name: u.full_name, email: u.email ?? undefined };
}

/**
 * Construye el objeto DocumentData para un siniestro dado.
 * Resuelve todos los joins a strings y obtiene TODOS los participantes.
 */
export async function buildDocumentDataForClaim(claimId: string): Promise<DocumentData> {
  const [rawClaim, participants, rawActions] = await Promise.all([
    fetchById<Record<string, unknown>>("claims", claimId, CLAIM_SELECT),
    fetchAll<RawParticipant>("claim_participants", {
      select: "type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune, notes",
      eq: { claim_id: claimId, is_active: true },
    }),
    fetchAll<RawAction>("claim_actions", {
      select: "id, code, issued_on, action_data, action_template:action_template!claim_actions_action_template_id_fkey(code)",
      eq: { claim_id: claimId, is_active: true },
      order: { column: "issued_on", ascending: false },
    }),
  ]);

  if (!rawClaim) {
    throw new Error("Siniestro no encontrado");
  }

  // Map the raw claim data — Supabase returns nested relations with their actual column names
  // The aliases (adjuster, inspector, etc.) need to be remapped from adjuster_user, inspector_user, etc.
  const claim = rawClaim as unknown as ClaimData & {
    adjuster_user: ClaimData["adjuster"];
    inspector_user: ClaimData["inspector"];
    auditor_user: ClaimData["auditor"];
    dispatcher_user: ClaimData["dispatcher"];
    assistant_user: ClaimData["assistant"];
  };

  const findParticipant = (type: string) => {
    const p = participants.find((part) => part.type === type);
    return p ? toParticipant(p) : null;
  };

  // Construir mapa de gestiones: code → última gestión emitida de ese código
  // rawActions viene ordenado por issued_on DESC, así que la primera de cada code es la más reciente
  const actions: Record<string, ActionSummary> = {};
  for (const ra of rawActions) {
    const code = ra.action_template?.code;
    if (!code) continue;
    // Solo nos quedamos con la primera (más reciente) de cada code
    if (actions[code]) continue;
    // Solo gestiones emitidas (con issued_on) cuentan como "última gestión"
    if (!ra.issued_on) continue;
    actions[code] = {
      code,
      issued_on: ra.issued_on,
      action_data: ra.action_data ?? null,
    };
  }

  return {
    claim: claim as unknown as Record<string, unknown>,
    company: claim.company,
    insurance_company: claim.insurance_company,
    broker: claim.broker,
    advisor: claim.advisor,
    claim_type: claim.claim_type,
    business_line: claim.business_line,
    insurance_product: claim.insurance_product,
    claim_cause: claim.claim_cause,
    event: claim.event,
    country: claim.country,
    region: claim.region,
    city: claim.city,
    commune: claim.commune,
    status: claim.status,
    currency: claim.currency,
    // lookup_catalog FKs
    construction_type: claim.construction_type,
    destination_housing: claim.destination_housing,
    damage_classification: claim.damage_classification,
    habitability: claim.habitability,
    claim_category: claim.type,
    service_type: claim.service_type,
    billing_type: claim.billing_type,
    // Participantes (todos los tipos)
    insured: findParticipant("insured"),
    contractor: findParticipant("contractor"),
    beneficiary: findParticipant("beneficiary"),
    executive: findParticipant("executive"),
    contact: findParticipant("contact"),
    // Usuarios asignados
    adjuster: toUser(claim.adjuster_user),
    inspector: toUser(claim.inspector_user),
    auditor: toUser(claim.auditor_user),
    dispatcher: toUser(claim.dispatcher_user),
    assistant: toUser(claim.assistant_user),
    // Gestiones del siniestro (mapa code → última gestión emitida)
    actions,
    today: new Date().toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  };
}

/**
 * Descarga el .docx de una plantilla desde Cloudflare R2 (URL pública)
 * y devuelve el buffer.
 */
export async function fetchTemplateBuffer(fileUrl: string): Promise<Uint8Array> {
  // Con R2, las URLs ya son públicas — solo descargar
  // Si es una ruta relativa (no empieza con http), construir URL con r2PublicUrl
  let downloadUrl = fileUrl;
  if (!fileUrl.startsWith("http")) {
    const r2PublicUrl = process.env.R2_PUBLIC_URL || "";
    downloadUrl = `${r2PublicUrl}/${fileUrl}`;
  }

  const res = await fetch(downloadUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`No se pudo descargar la plantilla (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
