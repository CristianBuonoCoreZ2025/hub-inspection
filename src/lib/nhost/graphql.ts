import { getNhostClient } from "./client";

export async function graphqlRequest<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const nhost = getNhostClient();
  const response = await nhost.graphql.request({ query, variables });

  if (response.body.errors && response.body.errors.length > 0) {
    const message = response.body.errors.map((e) => e.message).join("; ");
    throw new Error(message);
  }

  return response.body.data as T;
}
