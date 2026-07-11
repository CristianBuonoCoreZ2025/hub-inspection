import "server-only";

import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchById, fetchAll } from "@/lib/supabase/db";
import type { DocumentData, ParticipantData, UserData, CatalogRef } from "@/lib/document-fields";

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
  currency: (CatalogRef & { code: string }) | null;
  adjuster: { id: string; display_name: string; email: string | null } | null;
  inspector: { id: string; display_name: string; email: string | null } | null;
  auditor: { id: string; display_name: string; email: string | null } | null;
  dispatcher: { id: string; display_name: string; email: string | null } | null;
  assistant: { id: string; display_name: string; email: string | null } | null;
}

const CLAIM_SELECT =
  "id, claim_number, internal_number, client_reference, company_report_number, liquidation_number, is_special_claim, claim_date, report_date, assignment_date, summary, notes, claim_address, owner_same_as_insured, policy_number, policy_item, policy_amount, policy_premium, policy_start_date, policy_end_date, recovery_type_legal, recovery_type_material, recovery_comments, broker_executive, created_at, company(id, name), insurance_company(id, name), broker(id, name), advisor(id, name), claim_type(id, name), business_line(id, name), insurance_product(id, name), claim_cause(id, name), event(id, name), type(id, name), construction_type(id, name), destination_housing(id, name), damage_classification(id, name), habitability(id, name), service_type(id, name), billing_type(id, name), country(id, name), region(id, name), city(id, name), commune(id, name), status(id, name, code), currency(id, name, code), adjuster_user(id, display_name, email), inspector_user(id, display_name, email), auditor_user(id, display_name, email), dispatcher_user(id, display_name, email), assistant_user(id, display_name, email)";

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
function toUser(u: { id: string; display_name: string; email: string | null } | null): UserData | null {
  if (!u) return null;
  return { full_name: u.display_name, display_name: u.display_name, email: u.email ?? undefined };
}

/**
 * Construye el objeto DocumentData para un siniestro dado.
 * Resuelve todos los joins a strings y obtiene TODOS los participantes.
 */
export async function buildDocumentDataForClaim(claimId: string): Promise<DocumentData> {
  const [rawClaim, participants] = await Promise.all([
    fetchById<Record<string, unknown>>("claims", claimId, CLAIM_SELECT),
    fetchAll<RawParticipant>("claim_participants", {
      select: "type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune, notes",
      eq: { claim_id: claimId, is_active: true },
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
    today: new Date().toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  };
}

/**
 * Descarga el .docx de una plantilla desde Supabase Storage (signed URL)
 * y devuelve el buffer.
 */
export async function fetchTemplateBuffer(fileUrl: string): Promise<Uint8Array> {
  const supabase = getSupabaseClient();

  // Si la URL es una ruta de Supabase Storage, generar signed URL
  // El fileUrl puede ser una ruta relativa dentro del bucket o una URL completa
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "documents";
  let downloadUrl = fileUrl;

  // Si es una ruta relativa (no empieza con http), generar signed URL
  if (!fileUrl.startsWith("http")) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(fileUrl, 60);
    if (error) throw new Error(`No se pudo generar URL firmada: ${error.message}`);
    downloadUrl = data.signedUrl;
  }

  const res = await fetch(downloadUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`No se pudo descargar la plantilla (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
