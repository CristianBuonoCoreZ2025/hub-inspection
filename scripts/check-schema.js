require('dotenv').config({ path: '.env.local' });
const s = process.env.NHOST_ADMIN_SECRET;
const sub = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const r = process.env.NEXT_PUBLIC_NHOST_REGION;
const url = `https://${sub}.hasura.${r}.nhost.run/v1/graphql`;

const query = `{ __type(name: "action_template") { fields { name } } }`;

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': s },
  body: JSON.stringify({ query }),
})
  .then((res) => res.json())
  .then((d) => {
    if (d.errors) {
      console.error('GraphQL errors:', JSON.stringify(d.errors, null, 2));
      return;
    }
    const fields = d.data.__type.fields.map((f) => f.name).sort();
    console.log('action_template columns:', fields.join(', '));
  })
  .catch((e) => console.error(e.message));
