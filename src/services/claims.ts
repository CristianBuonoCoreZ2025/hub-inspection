import { graphqlRequest } from "@/lib/nhost/graphql";
import type { Claim, ClaimInput } from "@/types";

const CLAIM_FIELDS = `
  id
  claim_number
  policy_number
  claim_date
  status_id
  report_date
  assignment_date
  client_reference
  company_report_number
  liquidation_number
  is_special_claim
  summary
  event_id
  internal_number
  notes
  company_id
  assigned_adjuster_id
  inspector_id
  adjuster_id
  auditor_id
  dispatcher_id
  assistant_id
  insurance_company_id
  broker_id
  advisor_id
  claim_cause_id
  claim_type_id
  business_line_id
  insurance_product_id
  country_id
  region_id
  city_id
  commune_id
  construction_type_id
  destination_housing_id
  damage_classification_id
  habitability_id
  type_id
  currency_id
  service_type_id
  billing_type_id
  claim_address
  owner_same_as_insured
  policy_item
  policy_start_date
  policy_end_date
  policy_amount
  policy_premium
  recovery_type_legal
  recovery_type_material
  recovery_comments
  broker_executive
  created_at
  updated_at
`;

export async function getClaims(companyId?: string) {
  const where = companyId
    ? `{ company_id: { _eq: "${companyId}" } }`
    : `{}`;
  const query = `
    query GetClaims {
      claims(where: ${where}, order_by: { created_at: desc }) {
        ${CLAIM_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest<{ claims: Claim[] }>(query);
  return data.claims;
}

export async function checkClaimNumberExists(claimNumber: string, insuranceCompanyId: string, excludeClaimId?: string) {
  const where = excludeClaimId
    ? `{ claim_number: { _eq: "${claimNumber}" }, insurance_company_id: { _eq: "${insuranceCompanyId}" }, id: { _neq: "${excludeClaimId}" } }`
    : `{ claim_number: { _eq: "${claimNumber}" }, insurance_company_id: { _eq: "${insuranceCompanyId}" } }`;
  const query = `
    query CheckClaimNumber {
      claims(where: ${where}, limit: 1) {
        id
        claim_number
      }
    }
  `;

  const data = await graphqlRequest<{ claims: { id: string; claim_number: string }[] }>(query);
  return data.claims.length > 0;
}

export async function findParticipantByRut(rut: string, country: string) {
  if (!rut || !country) return null;
  const query = `
    query FindParticipantByRut {
      claims_participants(
        where: {
          rut: { _ilike: "${rut}" },
          country: { _ilike: "${country}" }
        },
        limit: 1,
        order_by: { created_at: desc }
      ) {
        id
        type
        full_name
        first_name
        last_name
        rut
        email
        phone
        cell_phone
        address
        country
        region
        city
        commune
      }
    }
  `;

  type ParticipantMatch = {
    id: string;
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
  };

  const data = await graphqlRequest<{ claims_participants: ParticipantMatch[] }>(query);
  return data.claims_participants[0] || null;
}

export async function getClaimsParticipants(claimIds: string[]) {
  if (claimIds.length === 0) return [];
  const ids = claimIds.map((id) => `"${id}"`).join(",");
  const query = `
    query GetClaimsParticipants {
      claims_participants(where: { claim_id: { _in: [${ids}] } }) {
        id claim_id type full_name first_name last_name rut email phone cell_phone address country region city commune
      }
    }
  `;
  type Participant = {
    id: string;
    claim_id: string;
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
  };
  const data = await graphqlRequest<{ claims_participants: Participant[] }>(query);
  return data.claims_participants;
}

export async function getClaimById(id: string) {
  const query = `
    query GetClaimById($id: uuid!) {
      claims_by_pk(id: $id) {
        ${CLAIM_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest<{ claims_by_pk: Claim }>(query, { id });
  return data.claims_by_pk;
}

export async function getClaimParticipants(id: string) {
  const query = `
    query GetClaimParticipants {
      claims_participants(where: { claim_id: { _eq: "${id}" } }) {
        id claim_id type full_name first_name last_name rut email phone cell_phone address country region city commune
      }
    }
  `;
  type Participant = {
    id: string;
    claim_id: string;
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
  };
  const data = await graphqlRequest<{ claims_participants: Participant[] }>(query);
  return data.claims_participants;
}

function buildClaimObject(input: Partial<ClaimInput> & { company_id?: string }): Record<string, unknown> {
  return {
    claim_number: input.claimNumber,
    policy_number: input.policyNumber,
    claim_date: input.claimDate,
    status_id: input.statusId || null,
    report_date: input.reportDate || null,
    assignment_date: input.assignmentDate || null,
    client_reference: input.clientReference || null,
    summary: input.summary || null,
    company_id: input.company_id,
  };
}

export async function createClaim(input: ClaimInput & { company_id: string }) {
  const mutation = `
    mutation CreateClaim($object: claims_insert_input!) {
      insert_claims_one(object: $object) {
        ${CLAIM_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest<{ insert_claims_one: Claim }>(mutation, {
    object: { ...buildClaimObject(input) },
  });
  return data.insert_claims_one;
}

// ═══════════════════════════════════════════════════════════════
// CREACIÓN MÍNIMA (modal rápido desde grilla)
// ═══════════════════════════════════════════════════════════════

export async function createClaimMinimal(
  input: {
    claimNumber: string;
    policyNumber: string;
    claimDate: string;
    clientReference?: string | null;
    assignmentDate?: string | null;
    reportDate?: string | null;
    summary?: string | null;
    statusId?: string | null;
    inspectorId?: string | null;
    adjusterId?: string | null;
    auditorId?: string | null;
    dispatcherId?: string | null;
    assistantId?: string | null;
    insuranceCompanyId?: string | null;
    claimTypeId?: string | null;
    claimCauseId?: string | null;
    businessLineId?: string | null;
    insuranceProductId?: string | null;
    advisorId?: string | null;
    brokerId?: string | null;
    eventId?: string | null;
    constructionTypeId?: string | null;
    habitabilityId?: string | null;
    destinationHousingId?: string | null;
    damageClassificationId?: string | null;
    propertyClassificationId?: string | null;
    ownerSameAsInsured?: boolean | null;
    company_id: string;
  },
  insured: {
    insuredName: string;
    lastName?: string | null;
    rut?: string | null;
    insuredEmail?: string | null;
    insuredPhone?: string | null;
    cellPhone: string;
    insuredAddress?: string | null;
    insuredCountry?: string | null;
    insuredRegion?: string | null;
    insuredCity?: string | null;
    insuredCommune?: string | null;
  },
  claimAddress: {
    claimAddress: string;
    claimCountry?: string | null;
    claimRegion?: string | null;
    claimCity: string;
    claimCommune?: string | null;
  },
  contractor?: {
    contractorName: string;
    contractorLastName?: string | null;
    contractorRut?: string | null;
    contractorEmail?: string | null;
    contractorCellPhone?: string | null;
    contractorPhone?: string | null;
    contractorAddress?: string | null;
    contractorCountry?: string | null;
    contractorRegion?: string | null;
    contractorCity?: string | null;
    contractorCommune?: string | null;
  } | null,
  beneficiary?: {
    beneficiaryName: string;
    beneficiaryLastName?: string | null;
    beneficiaryRut?: string | null;
    beneficiaryEmail?: string | null;
    beneficiaryCellPhone?: string | null;
    beneficiaryPhone?: string | null;
    beneficiaryAddress?: string | null;
    beneficiaryCountry?: string | null;
    beneficiaryRegion?: string | null;
    beneficiaryCity?: string | null;
    beneficiaryCommune?: string | null;
  } | null
) {
  // 1. Crear claim
  const mutation = `
    mutation CreateClaimMinimal($object: claims_insert_input!) {
      insert_claims_one(object: $object) {
        ${CLAIM_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest<{ insert_claims_one: Claim }>(mutation, {
    object: {
      claim_number: input.claimNumber,
      policy_number: input.policyNumber,
      claim_date: input.claimDate,
      client_reference: input.clientReference || null,
      assignment_date: input.assignmentDate || null,
      report_date: input.reportDate || null,
      status_id: input.statusId || null,
      summary: input.summary || null,
      inspector_id: input.inspectorId || null,
      adjuster_id: input.adjusterId || null,
      auditor_id: input.auditorId || null,
      dispatcher_id: input.dispatcherId || null,
      assistant_id: input.assistantId || null,
      insurance_company_id: input.insuranceCompanyId || null,
      claim_type_id: input.claimTypeId || null,
      claim_cause_id: input.claimCauseId || null,
      business_line_id: input.businessLineId || null,
      insurance_product_id: input.insuranceProductId || null,
      advisor_id: input.advisorId || null,
      broker_id: input.brokerId || null,
      event_id: input.eventId || null,
      construction_type_id: input.constructionTypeId || null,
      habitability_id: input.habitabilityId || null,
      destination_housing_id: input.destinationHousingId || null,
      damage_classification_id: input.damageClassificationId || null,
      property_classification_id: input.propertyClassificationId || null,
      owner_same_as_insured: input.ownerSameAsInsured ?? null,
      claim_address: claimAddress.claimAddress,
      claim_country: claimAddress.claimCountry || null,
      claim_region: claimAddress.claimRegion || null,
      claim_city: claimAddress.claimCity,
      claim_commune: claimAddress.claimCommune || null,
      company_id: input.company_id,
    },
  });
  const claim = data.insert_claims_one;

  // 2. Crear participant insured
  await createClaimParticipant({
    claim_id: claim.id,
    type: "insured",
    full_name: `${insured.insuredName} ${insured.lastName || ""}`.trim(),
    first_name: insured.insuredName,
    last_name: insured.lastName || null,
    rut: insured.rut || null,
    email: insured.insuredEmail || null,
    phone: insured.insuredPhone || null,
    cell_phone: insured.cellPhone,
    address: insured.insuredAddress || claimAddress.claimAddress,
    country: insured.insuredCountry || claimAddress.claimCountry || null,
    region: insured.insuredRegion || claimAddress.claimRegion || null,
    city: insured.insuredCity || claimAddress.claimCity,
    commune: insured.insuredCommune || claimAddress.claimCommune || null,
  });

  // 3. Crear participant contractor (si existe)
  if (contractor && contractor.contractorName) {
    await createClaimParticipant({
      claim_id: claim.id,
      type: "contractor",
      full_name: `${contractor.contractorName} ${contractor.contractorLastName || ""}`.trim(),
      first_name: contractor.contractorName,
      last_name: contractor.contractorLastName || null,
      rut: contractor.contractorRut || null,
      email: contractor.contractorEmail || null,
      phone: contractor.contractorPhone || null,
      cell_phone: contractor.contractorCellPhone || null,
      address: contractor.contractorAddress || null,
      country: contractor.contractorCountry || null,
      region: contractor.contractorRegion || null,
      city: contractor.contractorCity || null,
      commune: contractor.contractorCommune || null,
    });
  }

  // 4. Crear participant beneficiary (si existe)
  if (beneficiary && beneficiary.beneficiaryName) {
    await createClaimParticipant({
      claim_id: claim.id,
      type: "beneficiary",
      full_name: `${beneficiary.beneficiaryName} ${beneficiary.beneficiaryLastName || ""}`.trim(),
      first_name: beneficiary.beneficiaryName,
      last_name: beneficiary.beneficiaryLastName || null,
      rut: beneficiary.beneficiaryRut || null,
      email: beneficiary.beneficiaryEmail || null,
      phone: beneficiary.beneficiaryPhone || null,
      cell_phone: beneficiary.beneficiaryCellPhone || null,
      address: beneficiary.beneficiaryAddress || null,
      country: beneficiary.beneficiaryCountry || null,
      region: beneficiary.beneficiaryRegion || null,
      city: beneficiary.beneficiaryCity || null,
      commune: beneficiary.beneficiaryCommune || null,
    });
  }

  return claim;
}

export async function updateClaim(id: string, input: Partial<ClaimInput>) {
  const mutation = `
    mutation UpdateClaim($id: uuid!, $set: claims_set_input!) {
      update_claims_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${CLAIM_FIELDS}
      }
    }
  `;

  const set: Record<string, unknown> = {};
  const obj = buildClaimObject(input);
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      set[key] = value;
    }
  }

  const data = await graphqlRequest<{ update_claims_by_pk: Claim }>(mutation, { id, set });
  return data.update_claims_by_pk;
}

/**
 * Actualización genérica de campos del siniestro.
 * Acepta cualquier combinación de columnas de la tabla claims.
 * Los valores null se incluyen en el _set (para limpiar campos).
 * Los valores undefined se omiten (no se modifican).
 */
export async function updateClaimFields(id: string, set: Record<string, unknown>) {
  const mutation = `
    mutation UpdateClaimFields($id: uuid!, $set: claims_set_input!) {
      update_claims_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${CLAIM_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ update_claims_by_pk: Claim }>(mutation, { id, set });
  return data.update_claims_by_pk;
}

export async function updateClaimStatus(id: string, statusId: string) {
  const mutation = `
    mutation UpdateClaimStatus($id: uuid!, $statusId: uuid!) {
      update_claims_by_pk(pk_columns: { id: $id }, _set: { status_id: $statusId }) {
        ${CLAIM_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest<{ update_claims_by_pk: Claim }>(mutation, { id, statusId });
  return data.update_claims_by_pk;
}

export async function deleteClaim(id: string) {
  const mutation = `
    mutation DeleteClaim($id: uuid!) {
      delete_claims_by_pk(id: $id) {
        id
      }
    }
  `;
  await graphqlRequest(mutation, { id });
}

// ═══════════════════════════════════════════════════════════════
// CLAIMS PARTICIPANTS
// ═══════════════════════════════════════════════════════════════

export async function createClaimParticipant(input: {
  claim_id: string;
  type: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  rut?: string | null;
  email?: string | null;
  phone?: string | null;
  cell_phone?: string | null;
  address?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  commune?: string | null;
}) {
  const mutation = `
    mutation CreateClaimParticipant($object: claims_participants_insert_input!) {
      insert_claims_participants_one(object: $object) {
        id claim_id type full_name first_name last_name rut email phone cell_phone address country region city commune
      }
    }
  `;
  const data = await graphqlRequest<{ insert_claims_participants_one: { id: string } }>(mutation, { object: input });
  return data.insert_claims_participants_one;
}

export async function updateClaimParticipant(id: string, input: Partial<{
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
}>) {
  const mutation = `
    mutation UpdateClaimParticipant($id: uuid!, $set: claims_participants_set_input!) {
      update_claims_participants_by_pk(pk_columns: { id: $id }, _set: $set) {
        id claim_id type full_name first_name last_name rut email phone cell_phone address country region city commune
      }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_claims_participants_by_pk: { id: string } }>(mutation, { id, set });
  return data.update_claims_participants_by_pk;
}
