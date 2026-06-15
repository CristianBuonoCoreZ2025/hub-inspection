import { graphqlRequest } from "@/lib/nhost/graphql";
import type { Claim, ClaimInput, ClaimStatus } from "@/types";

const CLAIM_FIELDS = `
  id
  claim_number
  policy_number
  insurance_company
  insured_name
  insured_email
  insured_phone
  address
  city
  claim_date
  claim_type
  status
  assigned_adjuster_id
  company_id
  notes
  created_at
  updated_at
`;

export async function getClaims(companyId?: string) {
  const query = `
    query GetClaims($companyId: uuid) {
      claims(where: { company_id: { _eq: $companyId } }, order_by: { created_at: desc }) {
        ${CLAIM_FIELDS}
        assigned_adjuster {
          full_name
        }
      }
    }
  `;

  const data = await graphqlRequest<{ claims: (Claim & { assigned_adjuster?: { full_name: string | null } })[] }>(
    query,
    { companyId: companyId || null }
  );
  return data.claims;
}

export async function getClaimById(id: string) {
  const query = `
    query GetClaimById($id: uuid!) {
      claims_by_pk(id: $id) {
        ${CLAIM_FIELDS}
        assigned_adjuster {
          full_name
        }
      }
    }
  `;

  const data = await graphqlRequest<{ claims_by_pk: Claim & { assigned_adjuster?: { full_name: string | null } } }>(
    query,
    { id }
  );
  return data.claims_by_pk;
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
    object: {
      claim_number: input.claimNumber,
      policy_number: input.policyNumber,
      insurance_company: input.insuranceCompany || null,
      insured_name: input.insuredName,
      insured_email: input.insuredEmail || null,
      insured_phone: input.insuredPhone || null,
      address: input.address,
      city: input.city,
      claim_date: input.claimDate,
      claim_type: input.claimType,
      assigned_adjuster_id: input.assignedAdjusterId || null,
      notes: input.notes || null,
      status: "created" as ClaimStatus,
      company_id: input.company_id,
    },
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
  if (input.claimNumber !== undefined) set.claim_number = input.claimNumber;
  if (input.policyNumber !== undefined) set.policy_number = input.policyNumber;
  if (input.insuranceCompany !== undefined) set.insurance_company = input.insuranceCompany;
  if (input.insuredName !== undefined) set.insured_name = input.insuredName;
  if (input.insuredEmail !== undefined) set.insured_email = input.insuredEmail;
  if (input.insuredPhone !== undefined) set.insured_phone = input.insuredPhone;
  if (input.address !== undefined) set.address = input.address;
  if (input.city !== undefined) set.city = input.city;
  if (input.claimDate !== undefined) set.claim_date = input.claimDate;
  if (input.claimType !== undefined) set.claim_type = input.claimType;
  if (input.assignedAdjusterId !== undefined) set.assigned_adjuster_id = input.assignedAdjusterId;
  if (input.notes !== undefined) set.notes = input.notes;

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
