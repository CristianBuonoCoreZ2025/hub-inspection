import { config } from "dotenv";
config({ path: ".env.local" });

const graphqlUrl = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL!;
const metadataUrl = graphqlUrl
  .replace("/v1/graphql", "/v1/metadata")
  .replace("//graphql.", "//hasura.");
const adminSecret = process.env.NHOST_ADMIN_SECRET!;

const tables = [
  { schema: "public", name: "gestion_screens" },
  { schema: "public", name: "characteristic_screens" },
];

async function trackTable(schema: string, name: string) {
  const res = await fetch(metadataUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify({
      type: "pg_track_table",
      args: { source: "default", table: { schema, name } },
    }),
  });
  const data = await res.json();
  console.log(`Track ${name}:`, JSON.stringify(data, null, 2));
}

(async () => {
  for (const table of tables) {
    await trackTable(table.schema, table.name);
  }
})();
