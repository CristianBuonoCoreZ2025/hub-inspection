import { graphqlRequest } from "@/lib/nhost/graphql";
import type { Claim, ClaimInput, ClaimStatus } from "@/types";

const CLAIM_FIELDS = `
  id
  claim_number
  policy_number
  insurance_company
  insured_name
  last_name
  rut
  insured_email
  insured_phone
  cell_phone
  address
  city
  commune
  region
  country
  claim_date
  claim_time
  report_date
  assignment_date
  claim_type
  claim_cause
  summary
  contact_name
  contact_role
  contact_email
  status
  assigned_adjuster_id
  inspector_id
  adjuster_id
  broker_name
  broker_number
  advisor
  client_reference
  company_report_number
  liquidation_number
  is_special_claim
  recovery_type_legal
  recovery_type_material
  recovery_comments
  company_id
  notes
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
      }
    }
  `;

  type ClaimWithProfiles = Claim & {
    assigned_adjuster?: { full_name: string | null } | null;
    inspector?: { full_name: string | null } | null;
    adjuster?: { full_name: string | null } | null;
    auditor?: { full_name: string | null } | null;
    dispatcher?: { full_name: string | null } | null;
    assistant?: { full_name: string | null } | null;
  };

  const data = await graphqlRequest<{ claims: ClaimWithProfiles[] }>(query);
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
      }
    }
  `;

  type ClaimWithProfiles = Claim & {
    assigned_adjuster?: { full_name: string | null } | null;
    inspector?: { full_name: string | null } | null;
    adjuster?: { full_name: string | null } | null;
    auditor?: { full_name: string | null } | null;
    dispatcher?: { full_name: string | null } | null;
    assistant?: { full_name: string | null } | null;
  };

  const data = await graphqlRequest<{ claims_by_pk: ClaimWithProfiles }>(query, { id });
  return data.claims_by_pk;
}

function buildClaimObject(input: Partial<ClaimInput> & { company_id?: string }): Record<string, unknown> {
  return {
    claim_number: input.claimNumber,
    policy_number: input.policyNumber,
    insurance_company: input.insuranceCompany || null,
    insured_name: input.insuredName,
    last_name: input.lastName || null,
    rut: input.rut || null,
    insured_email: input.insuredEmail || null,
    insured_phone: input.insuredPhone || null,
    cell_phone: input.cellPhone || null,
    address: input.address,
    city: input.city,
    commune: input.commune || null,
    region: input.region || null,
    country: input.country || "Chile",
    claim_date: input.claimDate,
    claim_time: input.claimTime || null,
    report_date: input.reportDate || null,
    assignment_date: input.assignmentDate || null,
    claim_type: input.claimType,
    claim_cause: input.claimCause || null,
    summary: input.summary || null,
    contact_name: input.contactName || null,
    contact_role: input.contactRole || null,
    contact_email: input.contactEmail || null,
    assigned_adjuster_id: input.assignedAdjusterId || null,
    inspector_id: input.inspectorId || null,
    adjuster_id: input.adjusterId || null,
    broker_name: input.brokerName || null,
    broker_number: input.brokerNumber || null,
    advisor: input.advisor || null,
    client_reference: input.clientReference || null,
    company_report_number: input.companyReportNumber || null,
    liquidation_number: input.liquidationNumber || null,
    is_special_claim: input.isSpecialClaim ?? false,
    recovery_type_legal: input.recoveryTypeLegal || null,
    recovery_type_material: input.recoveryTypeMaterial || null,
    recovery_comments: input.recoveryComments || null,
    notes: input.notes || null,
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
