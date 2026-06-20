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
        assigned_adjuster { full_name }
        inspector { full_name }
        adjuster { full_name }
        auditor { full_name }
        dispatcher { full_name }
        assistant { full_name }
        claim_participants { id type full_name first_name last_name rut email phone cell_phone address country region city commune }
        construction_type { id name }
        destination_housing { id name }
        damage_classification { id name }
        habitability { id name }
        insurance_company { id name }
        broker { id name }
        business_line { id name }
        insurance_product { id name }
        claim_cause { id name }
        claim_type { id name }
      }
    }
  `;

  type ClaimWithRelations = Claim & {
    assigned_adjuster?: { full_name: string | null } | null;
    inspector?: { full_name: string | null } | null;
    adjuster?: { full_name: string | null } | null;
    auditor?: { full_name: string | null } | null;
    dispatcher?: { full_name: string | null } | null;
    assistant?: { full_name: string | null } | null;
    claim_participants?: { id: string; type: string; full_name: string; first_name: string | null; last_name: string | null; rut: string | null; email: string | null; phone: string | null; cell_phone: string | null; address: string | null; country: string | null; region: string | null; city: string | null; commune: string | null }[];
    construction_type?: { id: string; name: string } | null;
    destination_housing?: { id: string; name: string } | null;
    damage_classification?: { id: string; name: string } | null;
    habitability?: { id: string; name: string } | null;
    insurance_company?: { id: string; name: string } | null;
    broker?: { id: string; name: string } | null;
    business_line?: { id: string; name: string } | null;
    insurance_product?: { id: string; name: string } | null;
    claim_cause?: { id: string; name: string } | null;
    claim_type?: { id: string; name: string } | null;
  };

  const data = await graphqlRequest<{ claims: ClaimWithRelations[] }>(query);
  return data.claims;
}

export async function getClaimById(id: string) {
  const query = `
    query GetClaimById($id: uuid!) {
      claims_by_pk(id: $id) {
        ${CLAIM_FIELDS}
        assigned_adjuster { full_name }
        inspector { full_name }
        adjuster { full_name }
        auditor { full_name }
        dispatcher { full_name }
        assistant { full_name }
        claim_participants { id type full_name first_name last_name rut email phone cell_phone address country region city commune }
        construction_type { id name }
        destination_housing { id name }
        damage_classification { id name }
        habitability { id name }
        insurance_company { id name }
        broker { id name }
        business_line { id name }
        insurance_product { id name }
        claim_cause { id name }
        claim_type { id name }
      }
    }
  `;

  type ClaimWithRelations = Claim & {
    assigned_adjuster?: { full_name: string | null } | null;
    inspector?: { full_name: string | null } | null;
    adjuster?: { full_name: string | null } | null;
    auditor?: { full_name: string | null } | null;
    dispatcher?: { full_name: string | null } | null;
    assistant?: { full_name: string | null } | null;
    claim_participants?: { id: string; type: string; full_name: string; first_name: string | null; last_name: string | null; rut: string | null; email: string | null; phone: string | null; cell_phone: string | null; address: string | null; country: string | null; region: string | null; city: string | null; commune: string | null }[];
    construction_type?: { id: string; name: string } | null;
    destination_housing?: { id: string; name: string } | null;
    damage_classification?: { id: string; name: string } | null;
    habitability?: { id: string; name: string } | null;
    insurance_company?: { id: string; name: string } | null;
    broker?: { id: string; name: string } | null;
    business_line?: { id: string; name: string } | null;
    insurance_product?: { id: string; name: string } | null;
    claim_cause?: { id: string; name: string } | null;
    claim_type?: { id: string; name: string } | null;
  };

  const data = await graphqlRequest<{ claims_by_pk: ClaimWithRelations }>(query, { id });
  return data.claims_by_pk;
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
