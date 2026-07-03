import { getNhostClient } from "./client";
import { logger } from "@/lib/logger";
import { requestLogger } from "@/lib/request-logger";

export async function graphqlRequest<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const nhost = getNhostClient();

  // Extraer nombre de la operación (query/mutation nombre) para el log
  const opMatch = query.match(/(?:query|mutation)\s+(\w+)/);
  const opName = opMatch?.[1] || "anonymous";
  const opType = query.trim().startsWith("mutation") ? "mutation" : "query";
  const logId = requestLogger.startLog(
    "db",
    `GraphQL ${opType}: ${opName}`,
    { query: query.slice(0, 300), variables },
  );

  const start = performance.now();
  try {
    const response = await nhost.graphql.request({ query, variables });
    const duration = Math.round(performance.now() - start);

    if (response.body.errors && response.body.errors.length > 0) {
      const message = response.body.errors.map((e) => e.message).join("; ");
      logger.error("GraphQL error", new Error(message), {
        component: "graphqlRequest",
        action: `graphql.${opType}.${opName}`,
        metadata: { query: query.slice(0, 200), variables, errors: response.body.errors },
      });
      requestLogger.endLog(
        logId,
        "error",
        { duration, errors: response.body.errors },
        message,
      );
      throw new Error(message);
    }

    requestLogger.endLog(logId, "success", { duration, data: response.body.data });
    return response.body.data as T;
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Si ya fue logueado como error GraphQL arriba, no re-loguear
    if (!errorMsg.includes("; ") || !requestLogger.getLogs().some(l => l.id === logId && l.status === "error")) {
      requestLogger.endLog(logId, "error", { duration }, errorMsg);
    }
    throw err;
  }
}
