import "server-only";
import { logger } from "@/lib/logger";

/**
 * Ejecuta una query/mutation GraphQL contra Nhost/Hasura usando el admin secret.
 *
 * SOLO server-side (route handlers, server actions, RSC).
 * Nunca exponer el admin secret al cliente.
 *
 * Requiere la variable de entorno NHOST_ADMIN_SECRET.
 */
export async function adminGraphqlRequest<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const adminSecret = process.env.NHOST_ADMIN_SECRET;
  if (!adminSecret) {
    throw new Error("Falta NHOST_ADMIN_SECRET en el entorno del servidor");
  }

  // Formato correcto de Nhost Cloud: https://<subdomain>.<service>.<region>.nhost.run
  // Ej: https://tfejikhjszwowlvsxupb.graphql.eu-central-1.nhost.run/v1
  // NO es https://graphql.<subdomain>.nhost.run (ese formato no existe).
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  const graphqlUrl =
    (subdomain && region
      ? `https://${subdomain}.graphql.${region}.nhost.run/v1`
      : process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL) || null;

  if (!graphqlUrl) {
    throw new Error("Falta configuración de GraphQL URL de Nhost");
  }

  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error("adminGraphqlRequest: HTTP no ok", new Error(`HTTP ${res.status}`), {
      component: "adminGraphqlRequest",
      action: "graphql.admin",
      metadata: { status: res.status, body: text.slice(0, 300) },
    });
    throw new Error(`GraphQL admin request falló (HTTP ${res.status})`);
  }

  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };

  if (body.errors && body.errors.length > 0) {
    const message = body.errors.map((e) => e.message).join("; ");
    logger.error("adminGraphqlRequest: errores GraphQL", new Error(message), {
      component: "adminGraphqlRequest",
      action: "graphql.admin",
      metadata: { query: query.slice(0, 200), variables, errors: body.errors },
    });
    throw new Error(message);
  }

  return body.data as T;
}
