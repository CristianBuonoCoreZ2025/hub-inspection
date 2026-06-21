import { getNhostClient } from "./client";
import { logger } from "@/lib/logger";

export async function graphqlRequest<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const nhost = getNhostClient();
  const response = await nhost.graphql.request({ query, variables });

  if (response.body.errors && response.body.errors.length > 0) {
    const message = response.body.errors.map((e) => e.message).join("; ");
    logger.error("GraphQL error", new Error(message), {
      component: "graphqlRequest",
      action: "graphql.request",
      metadata: { query: query.slice(0, 200), variables, errors: response.body.errors },
    });
    throw new Error(message);
  }

  return response.body.data as T;
}
