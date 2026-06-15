import { createClient } from "@nhost/nhost-js";
import type { NhostClient } from "@nhost/nhost-js";

let client: NhostClient | null = null;

export function getNhostClient() {
  if (client) return client;

  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;

  if (subdomain && region) {
    client = createClient({
      subdomain,
      region,
      configure: [],
    });
  } else {
    const authUrl = process.env.NEXT_PUBLIC_NHOST_AUTH_URL || "http://placeholder.local";
    const graphqlUrl = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL || "http://placeholder.local";
    const storageUrl = process.env.NEXT_PUBLIC_NHOST_STORAGE_URL;
    const functionsUrl = process.env.NEXT_PUBLIC_NHOST_FUNCTIONS_URL;

    client = createClient({
      authUrl,
      graphqlUrl,
      storageUrl,
      functionsUrl,
      configure: [],
    });
  }

  return client;
}
