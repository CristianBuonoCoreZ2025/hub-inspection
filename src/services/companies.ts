import { graphqlRequest } from "@/lib/nhost/graphql";
import type { Company, CompanyInput } from "@/types";

const COMPANY_FIELDS = `
  id
  name
  slug
  logo_url
  primary_color
  settings
  created_at
  updated_at
`;

export async function getCompanies() {
  const query = `
    query GetCompanies {
      companies(order_by: { created_at: desc }) {
        ${COMPANY_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ companies: Company[] }>(query);
  return data.companies;
}

export async function getCompanyById(id: string) {
  const query = `
    query GetCompanyById($id: uuid!) {
      companies_by_pk(id: $id) {
        ${COMPANY_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ companies_by_pk: Company }>(query, { id });
  return data.companies_by_pk;
}

export async function createCompany(input: CompanyInput) {
  const mutation = `
    mutation CreateCompany($object: companies_insert_input!) {
      insert_companies_one(object: $object) {
        ${COMPANY_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_companies_one: Company }>(mutation, {
    object: {
      name: input.name,
      slug: input.slug,
      primary_color: input.primaryColor || null,
    },
  });
  return data.insert_companies_one;
}

export async function updateCompany(id: string, input: Partial<CompanyInput>) {
  const mutation = `
    mutation UpdateCompany($id: uuid!, $set: companies_set_input!) {
      update_companies_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${COMPANY_FIELDS}
      }
    }
  `;
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.slug !== undefined) set.slug = input.slug;
  if (input.primaryColor !== undefined) set.primary_color = input.primaryColor;

  const data = await graphqlRequest<{ update_companies_by_pk: Company }>(mutation, { id, set });
  return data.update_companies_by_pk;
}

export async function deleteCompany(id: string) {
  const mutation = `
    mutation DeleteCompany($id: uuid!) {
      delete_companies_by_pk(id: $id) {
        id
      }
    }
  `;
  await graphqlRequest(mutation, { id });
}
