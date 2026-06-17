import { graphqlRequest } from "@/lib/nhost/graphql";
import { requestLogger } from "@/lib/request-logger";
import type { Country } from "@/types";

const COUNTRY_FIELDS = `
  id
  code
  name
  phone_prefix
  created_at
`;

export async function getCountries() {
  return requestLogger.traceAsyncMethod("getCountries", async () => {
    const query = `
      query GetCountries {
        countries(order_by: { name: asc }) {
          ${COUNTRY_FIELDS}
        }
      }
    `;
    const data = await graphqlRequest<{ countries: Country[] }>(query);
    return data.countries;
  });
}
