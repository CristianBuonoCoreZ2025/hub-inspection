import { config } from "dotenv";
config({ path: ".env.local" });

const graphqlUrl = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL!;
const url = new URL(graphqlUrl);
url.hostname = url.hostname.replace(/\.graphql\./, ".hasura.");
url.pathname = "/v1/metadata";
const metadataUrl = url.toString();
const adminSecret = process.env.NHOST_ADMIN_SECRET!;

const tables = [
  { schema: "public", name: "gestion_screens" },
  { schema: "public", name: "action_features" },
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

async function trackRelationship(schema: string, table: string, relName: string, column: string) {
  const res = await fetch(metadataUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify({
      type: "pg_create_object_relationship",
      args: {
        source: "default",
        table: { schema, name: table },
        name: relName,
        using: { foreign_key_constraint_on: [column] },
      },
    }),
  });
  const data = await res.json();
  console.log(`Rel ${table}.${relName}:`, JSON.stringify(data, null, 2));
}

async function createSelectPermission(schema: string, table: string, role: string) {
  const res = await fetch(metadataUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify({
      type: "pg_create_select_permission",
      args: {
        source: "default",
        table: { schema, name: table },
        role,
        permission: {
          columns: "*",
          filter: {},
          allow_aggregations: false,
        },
      },
    }),
  });
  const data = await res.json();
  console.log(`Select permission ${table}.${role}:`, JSON.stringify(data, null, 2));
}

(async () => {
  console.log("metadata URL:", metadataUrl);
  for (const table of tables) {
    await trackTable(table.schema, table.name);
  }
  await trackRelationship("public", "action_features", "screen", "screen_id");
  await trackRelationship("public", "characteristic", "screen", "screen_id");
  await trackRelationship("public", "characteristic_screens", "characteristic", "characteristic_id");
  await trackRelationship("public", "characteristic_screens", "screen", "screen_id");
  await createSelectPermission("public", "gestion_screens", "user");
  await createSelectPermission("public", "characteristic_screens", "user");
})();
