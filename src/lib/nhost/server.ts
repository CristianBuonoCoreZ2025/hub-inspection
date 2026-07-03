import { createServerClient } from "@nhost/nhost-js";
import type { StoredSession } from "@nhost/nhost-js/session";
import { cookies } from "next/headers";
import type { NhostClient } from "@nhost/nhost-js";

const SESSION_COOKIE = "nhostSession";

export async function getNhostServerClient(): Promise<NhostClient> {
  const cookieStore = await cookies();

  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;

  const baseOptions = {
    ...(subdomain && region
      ? {
          subdomain,
          region,
          // Nhost usa "hasura." para GraphQL, no "graphql." que es el default del SDK
          graphqlUrl: `https://${subdomain}.hasura.${region}.nhost.run/v1/graphql`,
        }
      : {
          authUrl: process.env.NEXT_PUBLIC_NHOST_AUTH_URL || "http://placeholder.local",
          graphqlUrl: process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL || "http://placeholder.local",
          storageUrl: process.env.NEXT_PUBLIC_NHOST_STORAGE_URL,
          functionsUrl: process.env.NEXT_PUBLIC_NHOST_FUNCTIONS_URL,
        }),
  };

  const client = createServerClient({
    ...baseOptions,
    storage: {
      get(): StoredSession | null {
        const raw = cookieStore.get(SESSION_COOKIE)?.value;
        if (!raw) return null;
        try {
          return JSON.parse(raw) as StoredSession;
        } catch {
          return null;
        }
      },
      set(value: StoredSession) {
        cookieStore.set(SESSION_COOKIE, JSON.stringify(value), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });
      },
      remove() {
        cookieStore.set(SESSION_COOKIE, "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
      },
    },
    configure: [],
  });

  return client;
}
