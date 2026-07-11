import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL!;
const secret = process.env.NHOST_ADMIN_SECRET!;

(async () => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hasura-admin-secret": secret },
    body: JSON.stringify({ query: "{ __type(name: \"mutation_root\") { fields { name } } }" }),
  });
  const data = await res.json();
  const fields = data.data.__type.fields.map((f: any) => f.name).filter((n: string) => n.includes("gestion_screen"));
  console.log("Mutations con gestion_screen:", fields);
})();
