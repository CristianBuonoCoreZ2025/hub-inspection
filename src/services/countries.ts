import { graphqlRequest } from "@/lib/nhost/graphql";
import type { Country } from "@/types";

const COUNTRY_FIELDS = `
  id
  code
  name
  phone_prefix
  created_at
`;

export async function getCountries() {
  const query = `
    query GetCountries {
      countries(order_by: { name: asc }) {
        ${COUNTRY_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ countries: Country[] }>(query);
  return data.countries;
}
