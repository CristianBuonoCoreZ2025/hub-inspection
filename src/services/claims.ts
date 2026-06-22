import { graphqlRequest } from "@/lib/nhost/graphql";
import type { Claim, ClaimInput, ClaimStatus } from "@/types";

const CLAIM_FIELDS = `
  id
  claim_number
  policy_number
  claim_date
  status
  status_id
  report_date
  assignment_date
  client_reference
  company_report_number
  liquidation_number
  is_special_claim
  summary
  event
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
  claim_country
  claim_region
  claim_city
  claim_commune
  owner_same_as_insured
  policy_item
  policy_start_date
  policy_end_date
  policy_currency
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
    status: "created" as ClaimStatus,
    report_date: input.reportDate || null,
    assignment_date: input.assignmentDate || null,
    client_reference: input.clientReference || null,
    company_report_number: input.companyReportNumber || null,
    liquidation_number: input.liquidationNumber || null,
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
    object: { ...buildClaimObject(input), status: "created" as ClaimStatus },
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
    summary?: string | null;
    inspectorId?: string | null;
    adjusterId?: string | null;
    insuranceCompanyId?: string | null;
    claimTypeId?: string | null;
    claimCauseId?: string | null;
    liquidationNumber?: string | null;
    companyReportNumber?: string | null;
    company_id: string;
  },
  insured: {
    insuredName: string;
    lastName?: string | null;
    rut?: string | null;
    insuredEmail?: string | null;
    insuredPhone?: string | null;
    cellPhone: string;
    address: string;
    country?: string | null;
    region?: string | null;
    city: string;
    commune?: string | null;
  },
  contractor?: {
    contractorName: string;
    contractorLastName?: string | null;
    contractorRut?: string | null;
    contractorEmail?: string | null;
    contractorCellPhone?: string | null;
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
      status: "created" as ClaimStatus,
      summary: input.summary || null,
      inspector_id: input.inspectorId || null,
      adjuster_id: input.adjusterId || null,
      insurance_company_id: input.insuranceCompanyId || null,
      claim_type_id: input.claimTypeId || null,
      claim_cause_id: input.claimCauseId || null,
      liquidation_number: input.liquidationNumber || null,
      company_report_number: input.companyReportNumber || null,
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
    address: insured.address,
    country: insured.country || null,
    region: insured.region || null,
    city: insured.city,
    commune: insured.commune || null,
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
      phone: null,
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
      phone: null,
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

export async function updateClaimStatus(id: string, status: ClaimStatus) {
  const mutation = `
    mutation UpdateClaimStatus($id: uuid!, $status: String!) {
      update_claims_by_pk(pk_columns: { id: $id }, _set: { status: $status }) {
        ${CLAIM_FIELDS}
      }
    }
  `;

  const data = await graphqlRequest<{ update_claims_by_pk: Claim }>(mutation, { id, status });
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
