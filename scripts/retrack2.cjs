require("dotenv").config({ path: ".env.local" });

const metaUrl = "https://tfejikhjszwowlvsxupb.hasura.eu-central-1.nhost.run/v1/metadata";
const gqlUrl = "https://tfejikhjszwowlvsxupb.hasura.eu-central-1.nhost.run/v1/graphql";
const secret = process.env.NHOST_ADMIN_SECRET;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(body, retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(metaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hasura-admin-secret": secret },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (text.startsWith("<")) { await sleep(3000); continue; }
      return JSON.parse(text);
    } catch (e) { await sleep(3000); }
  }
  return null;
}

(async () => {
  // 1. Untrack
  console.log("Untrack...");
  let d = await api({ type: "pg_untrack_table", args: { source: "default", table: { schema: "public", name: "claim_action_history" }, cascade: true } });
  console.log("  ", d?.message || d?.code || "done");

  await sleep(3000);

  // 2. Track
  console.log("Track...");
  d = await api({ type: "pg_track_table", args: { source: "default", table: { schema: "public", name: "claim_action_history" } } });
  console.log("  ", d?.message || d?.code || "done");

  await sleep(2000);

  // 3. Permissions
  const perms = [
    ["select", { columns: "*", filter: {} }],
    ["insert", { check: {}, columns: "*" }],
    ["update", { filter: {}, columns: "*" }],
  ];
  for (const [pt, pc] of perms) {
    for (const role of ["user", "anonymous"]) {
      d = await api({ type: `pg_create_${pt}_permission`, args: { source: "default", table: { schema: "public", name: "claim_action_history" }, role, permission: pc } });
      console.log(`  ${pt} ${role}:`, d?.message === "success" ? "OK" : d?.code || d?.message || "done");
    }
  }

  await sleep(2000);

  // 4. Test schema
  console.log("\nTesting schema...");
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch(gqlUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "{__typename}" }) });
      const text = await r.text();
      if (text.startsWith("<")) { console.log("  GraphQL 503, retry..."); await sleep(3000); continue; }
      // Now test the actual mutation field
      const q = { query: '{ __type(name: "mutation_root") { fields { name } } }' };
      const r2 = await fetch(gqlUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) });
      const d2 = await r2.json();
      const fields = d2.data?.__type?.fields?.map((f) => f.name) || [];
      const found = fields.filter((f) => f.includes("claim_action_history"));
      console.log("  Mutations:", found.join(", ") || "NONE");

      // Also test query
      const q2 = { query: '{ __type(name: "query_root") { fields { name } } }' };
      const r3 = await fetch(gqlUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q2) });
      const d3 = await r3.json();
      const qfields = d3.data?.__type?.fields?.map((f) => f.name) || [];
      const qfound = qfields.filter((f) => f.includes("claim_action_history"));
      console.log("  Queries:", qfound.join(", ") || "NONE");
      return;
    } catch (e) { console.log("  Error:", e.message.substring(0, 60)); await sleep(3000); }
  }
  console.log("  Could not test - backend unstable");
})();
